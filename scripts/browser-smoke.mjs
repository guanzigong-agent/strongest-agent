import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';import {createServer} from './serve.mjs';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/test-repo/';
const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER?{executablePath:process.env.TEST_BROWSER}:{})});const errors=[];const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await mkdir('output/playwright',{recursive:true});
try{
 await page.goto(url);await page.locator('[data-start]').waitFor();await page.screenshot({path:'output/playwright/mobile-start.png',fullPage:true});
 await page.locator('[data-start]').click();await page.locator('[data-action="buy"]:not([disabled])').last().click();
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('quota');};});
 await page.locator('[data-action="buy"]:not([disabled])').last().click();
 if(await page.locator('#save-warning').count()!==1)throw new Error('存档失败未保留持续警告');
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
 await page.locator('[data-tab="warehouse"]').click();if(await page.locator('[data-action="sell"]').count()!==2)throw new Error('买入后仓库数量异常');
 await page.locator('[data-tab="map"]').click();await page.locator('[data-action="move"]:not([disabled])').first().click();await page.locator('[data-tab="warehouse"]').click();await page.locator('[data-action="sell"]').first().click();await page.locator('[data-action="sell"]').first().click();
 const key='strongest-agent-save-v1';let state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);if(state.day!==2||state.holdings.length!==0||state.transactions.length!==4)throw new Error('交易循环异常');
 await page.locator('[data-tab="market"]').click();await page.screenshot({path:'output/playwright/mobile-market.png',fullPage:true});
 for(const tab of ['market','warehouse','map','news']){await page.locator(`[data-tab="${tab}"]`).click();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('375px横向溢出 '+tab);}
 await page.locator('[data-tab="map"]').click();while(state.day<30){await page.locator('[data-action="move"]:not([disabled])').first().click();state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
 if(await page.locator('[data-action="move"]:not([disabled])').count()!==0)throw new Error('30天仍能移动');await page.locator('[data-action="finish"]').click();await page.locator('.results').waitFor();await page.screenshot({path:'output/playwright/mobile-result.png',fullPage:true});
 await page.reload();await page.locator('[data-resume]').click();await page.locator('.results').waitFor();await page.locator('[data-restart]').click();await page.locator('[data-start]').click();
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'output/playwright/desktop-market.png',fullPage:true});
 await page.locator('#search').fill('zzzz-no-player');await page.locator('[data-restart]').click();await page.locator('[data-start]').click();if(await page.locator('#search').inputValue()!=='')throw new Error('重新开局仍残留搜索条件');
 await page.locator('#search').fill('zzzz-no-player');await page.locator('[data-restart]').click();await page.locator('[data-start]').click();if(await page.locator('#search').inputValue()!=='')throw new Error('重新开局仍残留搜索条件');
 if(errors.length)throw new Error(errors.join('\n'));const report={ok:true,url,mobileViewport:'375x812',desktopViewport:'1280x900',completeLoop:true,day30:true,saveReload:true,consoleErrors:errors};await writeFile('output/playwright/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
