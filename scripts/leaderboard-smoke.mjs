import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from './serve.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server = createServer(); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true,...(process.env.TEST_BROWSER ? {executablePath:process.env.TEST_BROWSER} : {})});
const page = await browser.newPage({viewport:{width:375,height:812}}), errors=[], requests=[], checks=[];
page.on('pageerror',error=>errors.push(error.message)); page.on('dialog',dialog=>dialog.accept());
page.on('request',request=>requests.push(request.url()));
const url=`http://127.0.0.1:${server.address().port}/src/prototype/index.html`;
const output='output/playwright/m3'; await mkdir(output,{recursive:true});
const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
const dialog=page.locator('#leaderboard-dialog');
async function open(){await page.locator('#open-leaderboard').click();await dialog.waitFor({state:'visible'});}
async function close(){await dialog.locator('[data-board-close]').click();}
async function noOverflow(label){check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);}
try{
 await page.goto(url); await page.locator('[data-start]').waitFor(); await open();
 check(await dialog.locator('[data-board-player="me"]').count()===0,'未开局不虚构本人成绩');
 for(const id of ['easy','standard','challenge']){
  await dialog.locator(`[data-board-difficulty="${id}"]`).click();
  const ids=await dialog.locator('[data-board-player]').evaluateAll(rows=>rows.map(row=>row.dataset.boardPlayer));
  check(ids.length===6&&ids.every(row=>row.startsWith(`demo-${id}-`)),`${id}难度独立排行`);
 }
 check((await dialog.innerText()).includes('未连接线上排行榜'),'明确标注模拟数据与未连接线上');
 await close();
 await page.locator('#nickname').fill('测试经纪人');
 await page.locator('[data-difficulty="easy"]').click();
 check(await page.locator('#nickname').inputValue()==='测试经纪人','切换难度保留昵称');
 await page.locator('[data-difficulty="standard"]').click();
 await page.locator('[data-start]').click(); await open();
 check((await dialog.locator('[data-board-player="me"]').innerText()).includes('测试经纪人'),'当前局显示本人昵称');
 const initial=Number(await dialog.locator('[data-board-player="me"]').getAttribute('data-assets'));
 check(initial===10e6,'标准榜当前局初始资产1000万');
 check(await dialog.locator('#my-rank').innerText()==='#5','按当前总资产正确排序');
 await dialog.locator('[data-board-difficulty="easy"]').click();
 check(await dialog.locator('[data-board-player="me"]').count()===0,'当前局不混入其他难度');
 await dialog.locator('[data-board-difficulty="standard"]').click();
 await noOverflow('375px排行榜无页面横向溢出');
 check(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),'375px排行榜弹窗内部无横向溢出');
 await dialog.screenshot({path:`${output}/mobile-leaderboard.png`}); await close();
 await page.locator('[data-buy]:not([disabled])').first().click(); await open();
 const afterBuy=Number(await dialog.locator('[data-board-player="me"]').getAttribute('data-assets'));
 check(afterBuy!==initial,'买入后更新统一参考总资产'); await close();
 await page.locator('nav [data-tab="map"]').click(); await page.locator('[data-move="27"]').click(); await open();
 const afterMove=Number(await dialog.locator('[data-board-player="me"]').getAttribute('data-assets'));
 check(afterMove!==afterBuy,'移动后更新行情与资产');
 check((await dialog.locator('[data-board-player="me"]').innerText()).includes('第2 / 30天'),'排行榜显示实际游戏天数');
 const otherBefore=await dialog.locator('[data-board-player^="demo-standard-"]').first().getAttribute('data-assets');
 await dialog.locator('summary').click(); await dialog.locator('[data-board-other]').click();
 await page.waitForFunction(()=>document.querySelector('#leaderboard-dialog .board-status').textContent.includes('本页更新'));
 const otherAfter=await dialog.locator('[data-board-player^="demo-standard-"]').first().getAttribute('data-assets');
 check(otherBefore!==otherAfter,'可演示其他玩家资产变动');
 check(Number(await dialog.locator('[data-board-player="me"]').getAttribute('data-assets'))===afterMove,'其他玩家演示更新不改本人资产');
 await dialog.locator('summary').click(); await dialog.locator('[data-board-error]').click();
 check((await dialog.locator('.board-status').innerText()).includes('连接中断'),'显示演示断线与重试状态');
 check(await dialog.locator('[data-board-player]').count()===7,'断线保留已有榜单');
 await dialog.locator('[data-board-refresh]').click();
 await page.waitForFunction(()=>document.querySelector('#leaderboard-dialog .board-status').textContent.includes('本页更新'));
 check((await dialog.locator('.board-status').innerText()).includes('演示数据'),'重试恢复演示状态');
 await page.setViewportSize({width:1280,height:900});
 await dialog.screenshot({path:`${output}/desktop-leaderboard.png`}); await noOverflow('1280px排行榜无横向溢出'); await close();
 await page.locator('[data-sell]').first().click(); await open();
 check(await dialog.locator('#my-board-assets').innerText()===await page.locator('#cash').innerText(),'清仓后榜单资产等于现金'); await close();
 await page.locator('[data-finish]').click(); await page.locator('.result').waitFor(); await page.locator('[data-open-board]').click();
 check(await dialog.locator('[data-board-player="me"]').count()===0,'结束后退出进行中排行榜');
 check((await dialog.innerText()).includes('本局已结束'),'结束后说明不再参与当前榜单');
 check(!requests.some(request=>!request.startsWith(`http://127.0.0.1:${server.address().port}/`)),'原型无外部成绩上传请求');
 check(errors.length===0,'浏览器无脚本异常');
 const report={checks,assets:{initial,afterBuy,afterMove},errors};
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
