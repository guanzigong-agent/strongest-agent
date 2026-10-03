import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {RULES_VERSION,createRun,applyEvent,replayRun,quote,referenceAssets} from '../src/prototype/rules.mjs';
import {createRankingHandler} from '../server/ranking.mjs';
import {openDatabase} from '../server/sqlite.mjs';
const roster=JSON.parse(await readFile(new URL('../src/prototype/roster.json',import.meta.url)));
const config={nickname:'小鹰经理',difficultyId:'standard',teamId:'1'};
const origin='https://guanzigong-agent.github.io';
const key='a'.repeat(64);
function request(handler,url,method='GET',body,token=key){
 return handler(new Request('https://ranking.test'+url,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json',Authorization:'Bearer '+token,'X-Rules-Version':RULES_VERSION,'X-Roster-Version':roster.databaseSha256}:{})},...(body?{body:JSON.stringify(body)}:{})}));
}
async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'nba-ranking-'));
 const file=path.join(dir,'scores.sqlite');
 const db=await openDatabase(file);
 return {db,file,handler:createRankingHandler(db,roster,{origins:[origin]}),cleanup:async()=>{db.close();await rm(dir,{recursive:true,force:true});}};
}
test('three difficulty cash values; validated nickname and team',()=>{
 for(const [difficultyId,cash] of [['easy',30e6],['standard',10e6],['challenge',5e6]]){
  assert.equal(createRun(roster,{...config,difficultyId}).cash,cash);
 }
 for(const invalid of [{nickname:'  '},{nickname:'a'.repeat(13)},{difficultyId:'bad'},{teamId:'999'}])assert.throws(()=>createRun(roster,{...config,...invalid}));
});
test('buy, move, sell replay gives identical authoritative assets',()=>{
 const game=createRun(roster,config);
 const p=roster.players.find(p=>p.teamId==='1'&&p.salaryUsd&&quote(roster,game,p)<=game.cash);
 const events=[{type:'buy',id:p.id},{type:'move',teamId:'2'},{type:'sell',id:p.id},{type:'finish'}];
 const originalCash=game.cash,cost=quote(roster,game,p);
 applyEvent(roster,game,events[0]);assert.equal(game.cash,originalCash-cost);
 applyEvent(roster,game,events[1]);const sellPrice=quote(roster,game,p);
 applyEvent(roster,game,events[2]);applyEvent(roster,game,events[3]);
 assert.equal(game.cash,originalCash-cost+sellPrice);
 assert.equal(referenceAssets(roster,game),referenceAssets(roster,replayRun(roster,config,events)));
 assert.equal(game.day,2);assert.equal(game.ended,true);
 assert.throws(()=>applyEvent(roster,game,{type:'move',teamId:'1'}));
});
test('invalid transactions and day 30 movement are rejected',()=>{
 const game=createRun(roster,config);
 assert.throws(()=>applyEvent(roster,game,{type:'sell',id:'unknown'}));
 assert.throws(()=>applyEvent(roster,game,{type:'move',teamId:'1'}));
 for(let i=0;i<29;i++)applyEvent(roster,game,{type:'move',teamId:game.teamId==='1'?'2':'1'});
 assert.equal(game.day,30);assert.throws(()=>applyEvent(roster,game,{type:'move',teamId:'3'}));
});
test('real SQLite scores survive restart, separate tiers, and finished row remains',async()=>{
 const f=await fixture();try{
  for(const difficultyId of ['easy','standard','challenge']){
   const id=crypto.randomUUID();
   assert.equal((await request(f.handler,'/runs/'+id,'PUT',{...config,difficultyId})).status,201);
   const finished=await request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'finish'}]});
   assert.equal(finished.status,200);assert.equal((await finished.json()).run.ended,true);
   assert.equal((await request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'finish'}]})).status,200);
  }
  f.db.close();const reopened=await openDatabase(f.file);
  try{
   const handler=createRankingHandler(reopened,roster,{origins:[origin]});
   for(const [tier,cash] of [['easy',30e6],['standard',10e6],['challenge',5e6]]){
    const response=await request(handler,'/leaderboard?difficulty='+tier);
    const board=await response.json();assert.equal(board.rows.length,1);
    assert.equal(board.rows[0].assets,cash);assert.equal(board.rows[0].ended,true);
    assert.equal(board.rows[0].nickname,config.nickname);
    assert.equal(JSON.stringify(board).includes(key),false);
   }
  }finally{reopened.close();}
 }finally{await f.cleanup();}
});
test('authenticated append-only events reject tampering and fabricated scores',async()=>{
 const f=await fixture();try{
  const id=crypto.randomUUID();await request(f.handler,'/runs/'+id,'PUT',config);
  assert.equal((await request(f.handler,'/runs/'+id+'/sync','POST',{events:[]},'b'.repeat(64))).status,403);
  assert.equal((await request(f.handler,'/runs/'+id+'/sync','POST',{events:[],assets:999999999})).status,400);
  assert.equal((await request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'move',teamId:'2'}]})).status,200);
  assert.equal((await request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'move',teamId:'3'}]})).status,409);
  assert.equal((await request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'move',teamId:'2'},{type:'finish'}]})).status,200);
  assert.equal((await request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'move',teamId:'2'},{type:'finish'},{type:'buy',id:'1'}]})).status,400);
 }finally{await f.cleanup();}
});
test('stale retries cannot roll scores back, CORS and input validation',async()=>{
 const f=await fixture();try{
  const id=crypto.randomUUID();await request(f.handler,'/runs/'+id,'PUT',config);
  await request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'move',teamId:'2'}]});
  assert.equal((await request(f.handler,'/runs/'+id+'/sync','POST',{events:[]})).status,409);
  assert.equal((await request(f.handler,'/leaderboard?difficulty=bogus')).status,400);
  const denied=await f.handler(new Request('https://ranking.test/leaderboard?difficulty=easy',{headers:{Origin:'https://untrusted.test'}}));
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
  const accepted=await request(f.handler,'/leaderboard?difficulty=easy');
  assert.equal(accepted.headers.get('Access-Control-Allow-Origin'),origin);
 }finally{await f.cleanup();}
});
test('old version writes are rejected and concurrent sync has one winner',async()=>{
 const f=await fixture();try{
  const id=crypto.randomUUID();
  const bad=new Request('https://ranking.test/runs/'+id,{method:'PUT',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Rules-Version':'old','X-Roster-Version':roster.databaseSha256},body:JSON.stringify(config)});
  assert.equal((await f.handler(bad)).status,409);
  await request(f.handler,'/runs/'+id,'PUT',config);
  const responses=await Promise.all([request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'move',teamId:'2'}]}),request(f.handler,'/runs/'+id+'/sync','POST',{events:[{type:'move',teamId:'3'}]})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 }finally{await f.cleanup();}
});
test('capacity 15, unaffordable players and missing salaries',()=>{
 const data={teams:[{id:'1'},{id:'2'}],players:Array.from({length:17},(_,i)=>({id:String(i),teamId:'1',salaryUsd:i===16?null:100,position:'G'}))};
 const game=createRun(data,config);
 for(let i=0;i<15;i++)applyEvent(data,game,{type:'buy',id:String(i)});
 assert.throws(()=>applyEvent(data,game,{type:'buy',id:'15'}));
 applyEvent(data,game,{type:'sell',id:'0'});applyEvent(data,game,{type:'buy',id:'15'});
 assert.equal(game.holdings.length,15);assert.throws(()=>applyEvent(data,game,{type:'buy',id:'16'}));
});
test('cleanup removes only the authenticated run, never other player records',async()=>{
 const f=await fixture();try{
  const id=crypto.randomUUID();await request(f.handler,'/runs/'+id,'PUT',config);
  assert.equal((await request(f.handler,'/runs/'+id,'DELETE',{},'b'.repeat(64))).status,403);
  assert.equal((await request(f.handler,'/runs/'+id,'DELETE',{})).status,200);
  assert.equal((await (await request(f.handler,'/leaderboard?difficulty=standard')).json()).rows.length,0);
 }finally{await f.cleanup();}
});
