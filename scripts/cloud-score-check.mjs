import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {RULES_VERSION,createRun,replayRun,quote,referenceAssets} from '../src/prototype/rules.mjs';
import {createRequire} from 'node:module';
const api=process.env.SCORE_API_URL;if(!api)throw Error('Set SCORE_API_URL');
const roster=JSON.parse(await readFile(new URL('../src/prototype/roster.json',import.meta.url))),rows=[],checks=[];
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER?{executablePath:process.env.TEST_BROWSER}:{})});
const page=await browser.newPage();await page.goto('https://guanzigong-agent.github.io/strongest-agent/');
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
async function call(path,method='GET',body,key){
 const result=await page.evaluate(async({url,options})=>{
  const response=await fetch(url,options);return{status:response.status,ok:response.ok,body:await response.json()};
 },{url:api+path,options:{method,headers:{...(key?{Authorization:'Bearer '+key,'X-Rules-Version':RULES_VERSION,'X-Roster-Version':roster.databaseSha256,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}});
 return{response:{status:result.status,ok:result.ok},body:result.body};
}
try{
 const health=await call('/health');check(health.response.ok&&health.body.rulesVersion===RULES_VERSION&&health.body.rosterVersion===roster.databaseSha256,'云服务规则与名单版本一致');
 check(health.response.ok,'GitHub页面可跨域读取排行榜服务');
 for(const difficultyId of ['easy','standard','challenge']){
  const id=crypto.randomUUID(),key=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');rows.push({id,key});
  const config={nickname:'系统上线验收',difficultyId,teamId:'1'},game=createRun(roster,config);
  const p=roster.players.find(p=>p.teamId==='1'&&p.salaryUsd&&quote(roster,game,p)<game.cash);
  const events=[{type:'buy',id:p.id},{type:'move',teamId:'2'},{type:'sell',id:p.id},{type:'finish'}];
  const created=await call('/runs/'+id,'PUT',config,key);check(created.response.status===201,difficultyId+'云端创建本局');
  const synced=await call('/runs/'+id+'/sync','POST',{events},key);check(synced.response.ok&&synced.body.run.assets===referenceAssets(roster,replayRun(roster,config,events)),difficultyId+'云端重算交易成绩');
  check((await call('/runs/'+id+'/sync','POST',{events},key)).response.ok,difficultyId+'重复提交成功且幂等');
  const board=await call('/leaderboard?difficulty='+difficultyId+'&own='+id);
  check(board.body.me?.ended&&board.body.rows.filter(r=>r.id===id).length===1,difficultyId+'另一请求读取已结算记录');
  check((await call('/leaderboard?difficulty='+(difficultyId==='easy'?'standard':'easy')+'&own='+id)).body.me===null,difficultyId+'记录不跨难度');
  check((await call('/runs/'+id,'DELETE',{},'b'.repeat(64))).response.status===403,difficultyId+'其他凭证不能移除该局');
 }
 await mkdir('output/playwright/m4-real',{recursive:true});
 const report={ok:true,api,checks:checks.length,labels:checks};await writeFile('output/playwright/m4-real/cloud-api-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 try{
  for(const row of rows){const result=await call('/runs/'+row.id,'DELETE',{},row.key);if(!result.response.ok&&result.response.status!==404)throw Error('Release check cleanup failed');}
  console.log(JSON.stringify({releaseCheckRowsRemoved:rows.length}));
 }finally{await browser.close();}
}
