import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {buildSite,publicFiles} from './build-site.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve('output/playwright/cache');await mkdir(output,{recursive:true});
const destination=path.join(output,'site');const build=await buildSite(destination);
const oldFiles=new Map(await Promise.all(publicFiles.map(async file=>[file,await readFile(file)])));
const main='src/prototype/prototype.mjs';
oldFiles.set(main,Buffer.from(oldFiles.get(main).toString().replace("t.abbr === 'ATL'","t.abbr === 'SAS'")));
const requests=[];let updated=false;
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),relative=url.pathname.replace(/^\/test-repo\//,'')||'index.html';
 if(!publicFiles.includes(relative))throw Error('Not public');
 requests.push({updated,file:relative,query:url.search});
 const body=updated?await readFile(path.join(destination,relative)):oldFiles.get(relative);
 res.writeHead(200,{'Content-Type':mime[path.extname(relative)]??'text/plain','Cache-Control':'public, max-age=600'});res.end(body);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER?{executablePath:process.env.TEST_BROWSER}:{})});
try{
 const page=await browser.newPage({viewport:{width:375,height:812}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}/test-repo/`;
 await page.goto(url);await page.locator('[data-start]').waitFor();
 assert.equal(await page.locator('#start-team').inputValue(),'24','先加载并缓存旧版马刺默认脚本');
 updated=true;await page.goto('about:blank');await page.goto(url);await page.locator('[data-start]').waitFor();
 assert.equal(await page.locator('#start-team').inputValue(),'24','原入口及页面缓存仍能复现旧版马刺');
 await page.goto('about:blank');await page.goto(`${url}?v=${build.revision}`);await page.locator('[data-start]').waitFor();
 const selected=await page.locator('#start-team').inputValue();
 assert.equal(selected,'1',`保留旧缓存后访问新版应默认老鹰，实际球队ID=${selected}`);
 assert.ok(requests.some(r=>r.updated&&r.file===main&&r.query),'新版脚本必须采用不同的缓存地址');
 assert.deepEqual(errors,[]);
 const report={ok:true,revision:build.revision,oldDefault:'SAS',cachedOldEntry:'SAS',newDefault:'ATL',requests,errors};
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
