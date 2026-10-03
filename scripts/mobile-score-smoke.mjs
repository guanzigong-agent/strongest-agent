import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from './serve.mjs';
import {createScoreServer} from '../server/local.mjs';
import {createRun,quote,RULES_VERSION} from '../src/prototype/rules.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const output='output/playwright/mobile-scores';await mkdir(output,{recursive:true});
const variants=['none','timeout','structuredClone','both'];
const cases=process.env.MOBILE_CASE?variants.filter(v=>v===process.env.MOBILE_CASE):variants;
if(!cases.length)throw Error('Unknown MOBILE_CASE');
const roster=JSON.parse(await readFile(new URL('../src/prototype/roster.json',import.meta.url),'utf8'));
const server=process.env.SITE_URL?null:createServer();if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.SITE_URL??`http://127.0.0.1:${server.address().port}/src/prototype/index.html`;
const apiServer=process.env.SCORE_API_URL?null:await createScoreServer(':memory:',[new URL(url).origin]);
if(apiServer)await new Promise(r=>apiServer.listen(0,'127.0.0.1',r));
const api=process.env.SCORE_API_URL??`http://127.0.0.1:${apiServer.address().port}/api`;
const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER?{executablePath:process.env.TEST_BROWSER}:{})});
const checks=[],diagnostics=[],cleanup=[];
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
const ua='Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 MicroMessenger/8.0.50 NetType/WIFI Language/zh_CN';
try{
 for(const missing of cases){
  const ctx=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,userAgent:ua});
  const page=await ctx.newPage(),errors=[];let requests=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  page.on('request',r=>{if(r.url().startsWith(api))requests++;});
  await page.route('**/api-config.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`export const SCORE_API=${JSON.stringify(api)};`}));
  const config={nickname:'手机兼容验收',difficultyId:'challenge',teamId:'1'},game=createRun(roster,config);
  const player=roster.players.find(p=>p.teamId==='1'&&p.salaryUsd&&quote(roster,game,p)<game.cash);
  const run={id:crypto.randomUUID(),key:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),config,rulesVersion:RULES_VERSION,rosterVersion:roster.databaseSha256,events:[{type:'buy',id:player.id},{type:'move',teamId:'24'}],created:false,syncedCount:0,error:null};
  await page.addInitScript(({missing,run})=>{
   if(missing==='timeout'||missing==='both')Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
   if(missing==='structuredClone'||missing==='both')Object.defineProperty(globalThis,'structuredClone',{value:undefined,configurable:true});
   if(!sessionStorage.getItem('mobile-fixture')){
    localStorage.setItem('nba-agent-runs-v1',JSON.stringify({currentId:run.id,runs:[run]}));sessionStorage.setItem('mobile-fixture','1');
   }
  },{missing,run});
  cleanup.push({page,run});
  await page.goto(url);await page.locator('#cash').waitFor();
  check(await page.locator('#capacity').innerText()==='1 / 15',missing+'恢复未上传的第2天持仓');
  try{await page.locator('[data-score-status="saved"]').waitFor({timeout:process.env.SITE_URL?25000:3000});}
  catch{
   const detail={missing,scoreApiRequests:requests,syncText:await page.locator('#game-sync').innerText(),errors};diagnostics.push(detail);
   console.log(JSON.stringify({reproduced:detail}));throw Error(missing+'：未上传记录无法补交');
  }
  check(requests>0,missing+'实际发送了成绩请求');
  await page.locator('#open-leaderboard').click();await page.locator('[data-board-me]').waitFor();
  check((await page.locator('[data-board-me]').innerText()).includes('手机兼容验收'),missing+'可读排行榜');
  await page.locator('[data-board-close]').click();await page.reload();await page.locator('[data-score-status="saved"]').waitFor();
  check(await page.locator('#capacity').innerText()==='1 / 15',missing+'刷新后持仓未丢失');
  await page.locator('[data-finish]').click();await page.locator('[data-score-status="saved"]').waitFor();
  await page.locator('[data-open-board]').click();await page.locator('[data-board-me]').waitFor();
  check((await page.locator('[data-board-me]').innerText()).includes('已结算'),missing+'结算成绩保留');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),missing+'手机无横向溢出');
  check(errors.length===0,missing+'无未处理脚本异常');
  diagnostics.push({missing,scoreApiRequests:requests,errors});
 }
 const report={ok:true,url,checks:checks.length,labels:checks,diagnostics};
 await writeFile(`${output}/${process.env.SITE_URL?'online-report':'local-report'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 try{
  const statuses=[];
  for(const {page,run} of cleanup){
   const status=await page.evaluate(async({api,run})=>{
    const r=await fetch(api+'/runs/'+run.id,{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+run.key,'X-Rules-Version':run.rulesVersion,'X-Roster-Version':run.rosterVersion},body:'{}'});return r.status;
   },{api,run});
   if(status!==200&&status!==404)throw Error('无法清理本次自己的验收记录');statuses.push(status);
  }
  console.log(JSON.stringify({testRecordCleanupStatuses:statuses}));
 }finally{await browser.close();if(server)await new Promise(r=>server.close(r));if(apiServer)await new Promise(r=>apiServer.close(r));}
}
