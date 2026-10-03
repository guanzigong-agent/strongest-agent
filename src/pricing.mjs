import {dateAt} from './data.mjs';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function playerImpact(s,state,id){
 const today=dateAt(s,state.day),facts=s.dailyFacts.filter(f=>f.playerId===id&&f.date<=today);
 const games=facts.filter(f=>f.type==='game').slice(-5);const baseline=s.baselines[id];let impact=0;
 if(games.length&&Number.isFinite(baseline)){
  const mean=games.reduce((n,f)=>n+f.payload.gameScore,0)/games.length,delta=(mean-baseline)/Math.max(Math.abs(baseline),5);
  impact=Math.abs(delta)>=.25?Math.sign(delta)*.06:Math.abs(delta)>=.1?Math.sign(delta)*.03:0;
 }
 for(const f of facts.filter(f=>f.type==='news')){
  const age=(Date.parse(today)-Date.parse(f.date))/86400000;
  impact+=(f.payload.impact??0)*Math.max(0,1-age/7);
 }
 return clamp(impact,-.22,.22);
}
export function teamPreference(s,teamId,position){
 const counts=s.teams.map(t=>s.players.filter(p=>p.teamId===t.id&&p.position===position).length);
 const average=counts.reduce((a,b)=>a+b,0)/counts.length;
 const local=s.players.filter(p=>p.teamId===teamId&&p.position===position).length;
 return clamp((average-local)*.02,-.08,.08);
}
export function referenceValue(s,state,id){const p=s.players.find(p=>p.id===id);return p?.salaryUsd?Math.round(p.salaryUsd*(1+playerImpact(s,state,id))):null;}
export function quote(s,state,teamId,id){
 const p=s.players.find(p=>p.id===id);if(!p?.salaryUsd||!s.teams.some(t=>t.id===teamId))return null;
 return Math.round(p.salaryUsd*clamp(1+playerImpact(s,state,id)+teamPreference(s,teamId,p.position),.7,1.3));
}
