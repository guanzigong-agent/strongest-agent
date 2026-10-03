import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {buildSite,publicFiles} from './build-site.mjs';
import {createScoreServer} from '../server/local.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve('output/playwright/release');
await mkdir(output,{recursive:true});
let server,apiServer,siteUrl=process.env.SITE_URL;
if(!siteUrl){
 const destination=path.join(output,'site');await buildSite(destination);
 const allowed=new Set([...publicFiles,'.nojekyll']);
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.json':'application/json','.md':'text/plain; charset=utf-8'};
 server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith('/test-repo/'))throw Error('Outside site');
  const relative=pathname.slice('/test-repo/'.length)||'index.html';
  if(!allowed.has(relative))throw Error('Not public');
  const bytes=await readFile(path.join(destination,relative));
  res.writeHead(200,{'Content-Type':mime[path.extname(relative)]??'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 siteUrl=`http://127.0.0.1:${server.address().port}/test-repo/`;
}
const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER?{executablePath:process.env.TEST_BROWSER}:{})});
const page=await browser.newPage({viewport:{width:375,height:812}}),errors=[],failed=[],checks=[];
if(server){
 apiServer=await createScoreServer(':memory:',[new URL(siteUrl).origin]);await new Promise(r=>apiServer.listen(0,'127.0.0.1',r));
 await page.route('**/api-config.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`export const SCORE_API='http://127.0.0.1:${apiServer.address().port}/api';`}));
}
page.on('pageerror',e=>errors.push(e.message));
page.on('response',response=>{if(response.status()>=400)failed.push(`${response.status()} ${response.url()}`);});
page.on('requestfailed',request=>failed.push(request.url()));
page.on('dialog',dialog=>dialog.accept());
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
try{
 const response=await page.goto(siteUrl);check(response?.ok(),'公开根入口HTTP成功');
 await page.locator('[data-start]').waitFor();
 check(page.url().startsWith(new URL('src/prototype/index.html',siteUrl).href),'根入口在仓库子路径正确进入当前版本');
 check((await page.title()).includes('最强nba人贩子'),'在线标题正确');
 check(await page.locator('#start-team').inputValue()==='1','开局默认亚特兰大老鹰');
 const rosterResponse=await page.request.get(new URL('src/prototype/roster.json',siteUrl).href);
 check(rosterResponse.ok(),'名单资源HTTP成功');
 const roster=await rosterResponse.json();check(roster.teams.length===30&&roster.players.length===620,'公开名单30队620人');
 check(await page.locator('[data-difficulty]').count()===3,'三档难度可选');
 await page.locator('#nickname').fill('发布检查');await page.locator('[data-difficulty="standard"]').click();await page.locator('[data-start]').click();
 check(await page.locator('#cash').innerText()==='$10.00M','标准本金1000万');
 check(await page.locator('#capacity').innerText()==='0 / 15','背包容量15人');
 await page.locator('[data-buy]:not([disabled])').first().click();check(await page.locator('#capacity').innerText()==='1 / 15','在线买入正常');
 await page.locator('nav [data-tab="map"]').click();await page.locator('[data-move]:not([disabled])').first().click();
 check(await page.locator('[data-sell]').count()===1,'移动后持仓可卖出');
 await page.locator('[data-sell]').click();check(await page.locator('#capacity').innerText()==='0 / 15','在线卖出正常');
 await page.locator('#open-leaderboard').click();const dialog=page.locator('#leaderboard-dialog');await dialog.waitFor({state:'visible'});
 await dialog.locator('[data-board-me]').waitFor();
 check((await dialog.locator('[data-board-me]').innerText()).includes('发布检查'),'真实排行榜显示当前局');
 check((await dialog.innerText()).includes('结算后保留成绩'),'结算保留说明正确');
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'375px无横向溢出');
 await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 await page.setViewportSize({width:1280,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'1280px无横向溢出');
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 check(errors.length===0,'页面无脚本异常');check(failed.length===0,'页面资源全部加载成功');
 const report={ok:true,url:siteUrl,revision:await page.locator('meta[name="game-build"]').getAttribute('content'),checks:checks.length,labels:checks,errors,failed};
 await writeFile(path.join(output,process.env.SITE_URL?'online-report.json':'local-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 if(process.env.SITE_URL){
  try{await page.evaluate(async()=>{
   const {SCORE_API}=await import(new URL('./api-config.mjs',location.href));
   const state=JSON.parse(localStorage.getItem('nba-agent-runs-v1')??'{"runs":[]}');
   for(const run of state.runs)await fetch(SCORE_API+'/runs/'+run.id,{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+run.key,'X-Rules-Version':run.rulesVersion,'X-Roster-Version':run.rosterVersion},body:'{}'});
  });}catch{}
 }
 await browser.close();if(server)await new Promise(resolve=>server.close(resolve));if(apiServer)await new Promise(resolve=>apiServer.close(resolve));
}
