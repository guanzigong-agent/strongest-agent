import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {requestJson} from '../src/prototype/network.mjs';
async function withServer(callback,handler){
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await callback(`http://127.0.0.1:${server.address().port}`);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
}
test('JSON requests work without AbortSignal.timeout and preserve HTTP errors',async t=>{
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
 Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
 t.after(()=>Object.defineProperty(AbortSignal,'timeout',descriptor));
 await withServer(async url=>{
  const {response,body}=await requestJson(url,{},1000);
  assert.equal(response.status,401);assert.equal(body.error,'请重试');
 },(_req,res)=>{res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'请重试'}));});
});
test('deadline also aborts a stalled JSON body after response headers',async()=>{
 let started=false,closed=false;
 await withServer(async url=>{
  await requestJson(url+'/ready',{},1000);
  await assert.rejects(requestJson(url+'/slow',{},40),error=>error.name==='TimeoutError');
  assert.equal(started,true);
  await new Promise(r=>setTimeout(r,20));assert.equal(closed,true);
 },(req,res)=>{
  res.writeHead(200,{'Content-Type':'application/json'});
  if(req.url==='/ready'){res.end('{}');return;}
  started=true;res.flushHeaders();res.write('{"ok":');
  const timer=setTimeout(()=>res.end('true}'),1000);
  res.on('close',()=>{closed=true;clearTimeout(timer);});
 });
});
