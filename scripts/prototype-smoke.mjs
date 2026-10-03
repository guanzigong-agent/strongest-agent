import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {createServer} from './serve.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless: true, ...(process.env.TEST_BROWSER ? {executablePath: process.env.TEST_BROWSER} : {})});
const context = await browser.newContext({viewport: {width: 375, height: 812}});
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
const url = `http://127.0.0.1:${server.address().port}/src/prototype/index.html`;
const output = 'output/playwright/m2';
await mkdir(output, {recursive: true});
const checks = [];
const check = (condition, label) => {if (!condition) throw new Error(label); checks.push(label);};
async function noOverflow(label) {
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
}
try {
  await page.goto(url); await page.locator('[data-start]').waitFor();
  for (const [id, cash] of [['easy', '$30.00M'], ['standard', '$10.00M'], ['challenge', '$5.00M']]) {
    await page.locator('[data-start]').waitFor();
    await page.locator('#start-team').selectOption('27');
    await page.locator(`[data-difficulty="${id}"]`).click();
    check(await page.locator('#start-team').inputValue() === '27', `${id}切换难度保留球队选择`);
    await page.locator('#nickname').fill('玩法检查'); await page.locator('[data-start]').click();
    check(await page.locator('#cash').innerText() === cash, `${id}初始资金正确`);
    check(await page.locator('#capacity').innerText() === '0 / 15', `${id}背包容量15人`);
    check((await page.locator('.stats .stat').last().innerText()).includes('+$0K'), `${id}开局总盈亏为零`);
    await page.locator('[data-finish]').click();
    check((await page.locator('#result-profit').innerText()).includes('+$0K · +0.0%'), `${id}结算按本档本金计算`);
    await page.locator('[data-restart]').click();
  }
  await page.locator('[data-difficulty="easy"]').click();
  await page.locator('#start-team').selectOption('24');
  await page.locator('#nickname').fill('玩法检查'); await page.locator('[data-start]').click();
  for (let i = 0; i < 15; i++) {
    if (await page.locator('[data-buy]:not([disabled])').count() === 0) {
      await page.locator('nav [data-tab="map"]').click();
      await page.locator('[data-move]:not([disabled])').first().click();
      await page.locator('nav [data-tab="market"]').click();
    }
    await page.locator('[data-buy]:not([disabled])').last().click();
  }
  check(await page.locator('#capacity').innerText() === '15 / 15', '允许持有15人');
  check(await page.locator('[data-buy]:not([disabled])').count() === 0, '满15人后禁止继续买入');
  await page.locator('nav [data-tab="warehouse"]').click();
  check(await page.locator('[data-holding]').count() === 15, '仓库显示全部15名持有球员');
  await noOverflow('375px满仓15人无横向溢出');
  await page.locator('[data-sell]').first().click();
  await page.locator('nav [data-tab="market"]').click();
  check(await page.locator('[data-buy]:not([disabled])').count() > 0, '卖出腾出背包栏后可继续买入');
  await page.locator('[data-restart]').click();
  await page.locator('[data-difficulty="standard"]').click();
  await page.locator('#start-team').selectOption('24');
  await page.screenshot({path: `${output}/mobile-start.png`, fullPage: true});
  await noOverflow('375px开局无横向溢出');
  await page.locator('#nickname').fill('玩法检查'); await page.locator('[data-start]').click();
  await page.screenshot({path: `${output}/mobile-market.png`, fullPage: true});
  await noOverflow('375px市场无横向溢出');
  const buy = page.locator('[data-buy]:not([disabled])').first();
  const id = await buy.getAttribute('data-buy');
  const purchasePrice = await buy.locator('xpath=ancestor::article').locator('.quote-row strong').innerText();
  await buy.click();
  check(await page.locator(`[data-player-card="${id}"]`).count() === 0, '买入球员从球队市场移除');
  await page.locator('nav [data-tab="warehouse"]').click();
  check(await page.locator(`[data-holding="${id}"] .holding-price strong`).first().innerText() === purchasePrice, '仓库记录实际购入成本');
  const day1Sell = await page.locator(`[data-holding="${id}"] .holding-price strong`).nth(1).innerText();
  await page.locator('nav [data-tab="map"]').click();
  await noOverflow('375px地图无横向溢出');
  await page.locator('[data-move="27"]').click();
  check(await page.locator('nav [data-tab="warehouse"]').getAttribute('aria-current') === 'page', '移动后自动进入仓库比较报价');
  const day2Sell = await page.locator(`[data-holding="${id}"] .holding-price strong`).nth(1).innerText();
  check(day1Sell !== day2Sell, '第二天当地卖价出现变化');
  check(await page.locator(`[data-holding="${id}"] .holding-price strong`).first().innerText() === purchasePrice, '移动后购入成本保持不变');
  await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'));
  await page.screenshot({path: `${output}/mobile-warehouse.png`, fullPage: true});
  await noOverflow('375px仓库无横向溢出');
  await page.locator('nav [data-tab="market"]').click();
  await page.locator('#search').fill('Anthony Davis');
  check(await page.locator('[data-player-card="6583"]').count() === 1, '新名单戴维斯属于奇才');
  await page.locator('#search').fill('Steve Settle');
  check(await page.locator('[data-buy]').isDisabled(), '工资待核实球员暂不可交易');
  await page.locator('nav [data-tab="map"]').click();
  const sasCard = page.locator('[data-move="24"]').locator('xpath=ancestor::article');
  check((await sasCard.innerText()).includes('第1天 · 已过期'), '其他球队仍展示旧报价日期');
  await page.locator('nav [data-tab="warehouse"]').click();
  check(await page.locator(`[data-holding="${id}"] .holding-price strong`).nth(1).innerText() === day2Sell, '切换页面不重新抽取报价');
  await page.locator(`[data-sell="${id}"]`).click();
  check(await page.locator('[data-holding]').count() === 0, '卖出后仓库移除球员');
  await page.locator('nav [data-tab="market"]').click();
  check(await page.locator(`[data-player-card="${id}"]`).count() === 1, '卖出球员进入当地球队');
  await page.setViewportSize({width: 1280, height: 900});
  await page.locator('#search').fill('');
  await page.screenshot({path: `${output}/desktop-market.png`, fullPage: true});
  await noOverflow('1280px桌面无横向溢出');
  await page.locator('nav [data-tab="map"]').click();
  await page.screenshot({path: `${output}/desktop-map.png`, fullPage: true});
  for (let day = 2; day < 30; day++) {
    await page.locator('[data-move]:not([disabled])').first().click();
    await page.locator('nav [data-tab="map"]').click();
  }
  check(await page.locator('[data-move]:not([disabled])').count() === 0, '第30天停止移动');
  await page.locator('[data-finish]').click();
  await page.locator('.result').waitFor();
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('nba-agent-runs-v1')).runs.some(r=>r.events.at(-1)?.type==='finish')), '当前结算操作已写入本机恢复存档');
  check(errors.length === 0, '浏览器无脚本异常');
  const report = {checks, quoteExample: {purchasePrice, day1Sell, day2Sell}, errors};
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
