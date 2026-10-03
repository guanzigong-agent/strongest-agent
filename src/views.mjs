import {dateAt} from './data.mjs';import {quote} from './pricing.mjs';import {settle} from './engine.mjs';
export function buildView(s,g,tab){
 const date=dateAt(s,g.day),team=s.teams.find(t=>t.id===g.teamId);
 return {tab,date,team,day:g.day,cash:g.cash,ended:g.ended,summary:settle(s,g),
  market:s.players.filter(p=>g.owners[p.id]===g.teamId).map(p=>({...p,price:quote(s,g,g.teamId,p.id)})),
  holdings:g.holdings.map(h=>({...s.players.find(p=>p.id===h.playerId),cost:h.cost,price:quote(s,g,g.teamId,h.playerId)})),
  teams:s.teams.map(t=>({...t,history:g.visitedQuotes[t.id]??null,current:t.id===g.teamId})),
  news:s.news.filter(n=>n.date<=date).sort((a,b)=>b.date.localeCompare(a.date)),
  performances:s.dailyFacts.filter(f=>f.type==='game'&&f.date===date).sort((a,b)=>b.payload.points-a.payload.points),
 };
}
