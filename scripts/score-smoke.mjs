import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from './serve.mjs';
import {createScoreServer} from '../server/local.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve('output/playwright/m4-real');await mkdir(output,{recursive:true});
const server=process.env.SITE_URL?null:createServer();if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.SITE_URL??`http://127.0.0.1:${server.address().port}/src/prototype/index.html`;
const api=process.env.SCORE_API_URL?null:await createScoreServer(':memory:',[new URL(url).origin]);if(api)await new Promise(r=>api.listen(0,'127.0.0.1',r));
const apiUrl=process.env.SCORE_API_URL??`http://127.0.0.1:${api.address().port}/api`;
const cleanup=[];
async function collect(page){
 if(!process.env.SCORE_API_URL)return;
 const runs=await page.evaluate(()=>JSON.parse(localStorage.getItem('nba-agent-runs-v1')??'{"runs":[]}').runs);
 for(const run of runs)if(!cleanup.some(r=>r.id===run.id))cleanup.push(run);
}
const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER?{executablePath:process.env.TEST_BROWSER}:{})});
const context=await browser.newContext({viewport:{width:375,height:812}}),errors=[],checks=[];
async function pageFor(ctx){
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api-config.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`export const SCORE_API=${JSON.stringify(apiUrl)};`}));
 return page;
}
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
try{
 const page=await pageFor(context);await page.goto(url);await page.locator('[data-start]').waitFor();
 await page.locator('[data-start]').click();check(await page.locator('#nickname-error').isVisible(),'昵称必填阻止开局');
 await page.locator('#nickname').fill('真实测试经理');await page.locator('[data-start]').click();await page.locator('#cash').waitFor();
 await page.locator('[data-buy]:not([disabled])').first().click();await page.locator('nav [data-tab="map"]').click();
 await page.locator('[data-move]:not([disabled])').first().click();await page.locator('[data-sell]').click();
 await page.locator('[data-finish]').click();await page.locator('[data-score-status="saved"]').waitFor();
 const assets=await page.locator('.result .big').innerText();
 check((await page.locator('.result').innerText()).includes('真实测试经理'),'结算显示游戏名字');
 await page.locator('[data-open-board]').click();await page.locator('[data-board-me]').waitFor();
 check((await page.locator('[data-board-me]').innerText()).includes('已结算'),'结算后榜上保留');
 check((await page.locator('#leaderboard-dialog').innerText()).includes(assets),'服务端资产与结算一致');
 check(!(await page.locator('#leaderboard-dialog').innerText()).includes('演示·'),'真实榜无虚构玩家');
 await page.locator('[data-board-difficulty="easy"]').click();await page.waitForFunction(()=>document.querySelector('.board-status').innerText.includes('已读取最新成绩'));
 check(await page.locator('[data-board-me]').count()===0,'标准成绩不进入轻松榜');
 await page.locator('[data-board-close]').click();await page.reload();await page.locator('.result').waitFor();
 check((await page.locator('.result').innerText()).includes('真实测试经理'),'刷新恢复结算及名字');
 await page.locator('[data-open-board]').click();await page.locator('[data-board-me]').waitFor();
 check(await page.locator('[data-board-me]').count()===1,'刷新重试不重复入榜');
 const secondTab=await pageFor(context);await secondTab.goto(url);await secondTab.locator('.result').waitFor();
 await secondTab.locator('[data-restart]').click();
 check((await secondTab.locator('#toast').innerText()).includes('另一个标签'),'同浏览器第二标签禁止覆盖存档');
 check(await secondTab.locator('.result').count()===1,'被锁标签未清除结算进度');await secondTab.close();
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'手机无横向溢出');
 await page.screenshot({path:path.join(output,'mobile-board.png'),fullPage:true});
 const other=await browser.newContext(),p2=await pageFor(other);await p2.goto(url);await p2.locator('[data-start]').waitFor();
 await p2.locator('#open-leaderboard').click();await p2.locator('[data-board-player]').waitFor();
 check((await p2.locator('#leaderboard-dialog').innerText()).includes('真实测试经理'),'另一独立浏览器读取同一成绩');
 await p2.locator('[data-board-close]').click();await p2.locator('#nickname').fill('断网经理');
 await p2.locator('[data-difficulty="challenge"]').click();await p2.locator('[data-start]').click();
 await p2.locator('[data-buy]:not([disabled])').first().click();
 await other.setOffline(true);await p2.locator('[data-finish]').click();await p2.locator('[data-score-retry]').waitFor();
 check((await p2.locator('.score-submit').innerText()).includes('未入榜'),'断网明确未入榜且可重试');
 await other.setOffline(false);await p2.reload();await p2.locator('[data-score-status="saved"]').waitFor();
 await p2.locator('[data-open-board]').click();await p2.locator('[data-board-me]').waitFor();
 check((await p2.locator('[data-board-me]').innerText()).includes('断网经理'),'刷新后补交断网结算');
 await p2.setViewportSize({width:1280,height:900});check(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'桌面无横向溢出');
 await p2.screenshot({path:path.join(output,'desktop-board.png'),fullPage:true});
 await collect(p2);await other.close();check(errors.length===0,'脚本异常为零');
 const full=await browser.newContext(),p3=await pageFor(full);await p3.goto(url);await p3.locator('[data-start]').waitFor();
 await p3.locator('#nickname').fill('存储测试');await p3.locator('[data-start]').click();await p3.locator('[data-score-status="saved"]').waitFor();
 await p3.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
 await p3.locator('[data-buy]:not([disabled])').first().click();
 check((await p3.locator('#toast').innerText()).includes('本次操作未执行'),'存储满时操作显示失败');
 check(await p3.locator('#capacity').innerText()==='0 / 15','保存失败不改变持仓');
 check((await p3.locator('#game-sync').innerText()).includes('无法保存'),'存储失败持续提示');await collect(p3);await full.close();
 const broken=await browser.newContext(),p4=await pageFor(broken);
 await broken.addInitScript(()=>localStorage.setItem('nba-agent-runs-v1','{"currentId":"broken","runs":[null]}'));
 await p4.goto(url);await p4.locator('[data-recover-save]').waitFor();
 check((await p4.locator('.warning[role="alert"]').innerText()).includes('存档异常'),'损坏存档有恢复入口');
 await p4.locator('[data-recover-save]').click();
 check(await p4.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('backup'))),'重开前保留异常存档备份');await broken.close();
 check(errors.length===0,'异常分支无脚本异常');await collect(page);
 const report={ok:true,url,checks:checks.length,labels:checks,errors};await writeFile(path.join(output,process.env.SITE_URL?'online-report.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 for(const ctx of browser.contexts())for(const page of ctx.pages())try{await collect(page);}catch{}
 try{
  const cleanupPage=context.pages()[0];
  for(const run of cleanup){
   const status=await cleanupPage.evaluate(async({apiUrl,run})=>{
    const response=await fetch(apiUrl+'/runs/'+run.id,{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+run.key,'X-Rules-Version':run.rulesVersion,'X-Roster-Version':run.rosterVersion},body:'{}'});return response.status;
   },{apiUrl,run});
   if(status!==200&&status!==404)throw Error('Could not remove our own release-check row');
  }
  if(cleanup.length)console.log(JSON.stringify({releaseCheckRowsRemoved:cleanup.length}));
 }finally{await browser.close();if(server)await new Promise(r=>server.close(r));if(api)await new Promise(r=>api.close(r));}
}
