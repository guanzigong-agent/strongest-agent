import test from 'node:test';
import assert from 'node:assert/strict';
import {createScoreClient} from '../src/prototype/score-client.mjs';
const config={nickname:'队长',difficultyId:'standard',teamId:'1'};
const storage=()=>{const rows=new Map();return{getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v),rows};};
test('reload resets transient syncing status without losing actions',()=>{
 const store=storage();store.setItem('nba-agent-runs-v1',JSON.stringify({currentId:'id',runs:[{id:'id',config,events:[{type:'finish'}],syncing:true,created:true,syncedCount:1}]}));
 const client=createScoreClient('',{storage:store});
 assert.equal(client.status().state,'saved');assert.equal(client.current().events.length,1);
});
test('storage failure does not silently discard an action',()=>{
 const client=createScoreClient('',{storage:{getItem:()=>null,setItem:()=>{throw Error('full');}}});
 assert.throws(()=>client.start(config,'version'),/无法保存/);assert.equal(client.current(),null);
});
test('a stale tab cannot overwrite another tab action',()=>{
 const store=storage(),a=createScoreClient('',{storage:store});a.start(config,'v');
 const b=createScoreClient('',{storage:store});a.append({type:'move',teamId:'2'});
 assert.throws(()=>b.append({type:'move',teamId:'3'}),/标签/);
 assert.equal(JSON.parse(store.getItem('nba-agent-runs-v1')).runs[0].events[0].teamId,'2');
});
test('quota failure notifies UI and keeps previous events',()=>{
 const store=storage();let notices=0;
 const client=createScoreClient('',{storage:store,onChange:()=>notices++});client.start(config,'v');
 store.setItem=()=>{throw Error('quota');};
 assert.throws(()=>client.append({type:'finish'}),/无法保存/);
 assert.ok(notices>0);assert.equal(client.current().events.length,0);
});
test('corrupt storage is retained and recovery backs it up before reset',()=>{
 const store=storage(),raw=JSON.stringify({currentId:'bad',runs:[null]});store.setItem('nba-agent-runs-v1',raw);
 const client=createScoreClient('',{storage:store});assert.equal(client.current(),null);
 assert.throws(()=>client.start(config,'v'),/异常/);
 assert.equal(store.getItem('nba-agent-runs-v1'),raw);
 client.recover();assert.ok([...store.rows.entries()].some(([k,v])=>k.includes('backup')&&v===raw));
});
test('new run created during prior synchronization is also synchronized',async()=>{
 const store=storage(),original=globalThis.fetch;let client,nextId,created=[];
 globalThis.fetch=async(url,options)=>{
  if(options.method==='PUT'){
   created.push(url.split('/').at(-1));
   if(created.length===1)nextId=client.start({...config,nickname:'第二局'},'v').id;
  }
  return new Response(JSON.stringify({run:{ended:false}}),{status:200});
 };
 try{
  client=createScoreClient('http://test/api',{storage:store});client.start(config,'v');await client.flush();
  await new Promise(r=>setTimeout(r,20));assert.ok(created.includes(nextId));
 }finally{globalThis.fetch=original;}
});
