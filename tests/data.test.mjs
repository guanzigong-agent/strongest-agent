import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot} from '../src/data.mjs';
import {readFileSync} from 'node:fs';
test('真实快照覆盖30支球队、30天及唯一球员与薪资来源',()=>{
 const s=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url)));
 assert.deepEqual(validateSnapshot(s),[]);
 assert.equal(s.teams.length,30);
 assert.ok(s.players.length>400);
 assert.ok(s.dailyFacts.length>1000);
});
test('拒绝重复球员、缺失薪资与非法日期',()=>{
 const s={startDate:'2026-02-30',endDate:'2026-03-31',teams:[{id:'a'}],players:[{id:'1',teamId:'a',salaryUsd:0},{id:'1',teamId:'x'}],sources:[],dailyFacts:[]};
 const e=validateSnapshot(s); assert.ok(e.some(x=>x.includes('日期')));assert.ok(e.some(x=>x.includes('重复')));assert.ok(e.some(x=>x.includes('薪资')));
});
