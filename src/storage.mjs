import {dateAt} from './data.mjs';
export const SAVE_KEY='strongest-agent-save-v1';
export function validState(g,s){
 if(!g||g.version!==s.version||!Number.isInteger(g.day)||g.day<1||g.day>30||!Number.isSafeInteger(g.cash)||g.cash<0||!s.teams.some(t=>t.id===g.teamId)||typeof g.ended!=='boolean'||!Number.isSafeInteger(g.realizedProfit)||!g.visitedQuotes||!Array.isArray(g.transactions)||!Array.isArray(g.holdings)||g.holdings.length>5||!g.owners)return false;
 if(g.holdings.some(h=>!h||typeof h!=='object'))return false;
 const ids=new Set(g.holdings.map(h=>h.playerId));if(ids.size!==g.holdings.length)return false;
 if(g.holdings.some(h=>!Number.isSafeInteger(h.cost)||h.cost<=0||!s.players.some(p=>p.id===h.playerId&&p.salaryUsd>0)))return false;
 const teams=new Set(s.teams.map(t=>t.id));
 if(s.players.some(p=>ids.has(p.id)?g.owners[p.id]!=='warehouse':!teams.has(g.owners[p.id])))return false;
 if(Object.keys(g.owners).length!==s.players.length)return false;
 if(g.cash+g.holdings.reduce((n,h)=>n+h.cost,0)!==15000000+g.realizedProfit)return false;
 for(const [tid,v] of Object.entries(g.visitedQuotes)){
  if(!teams.has(tid)||!v||!Number.isInteger(v.day)||v.day<1||v.day>g.day||v.date!==dateAt(s,v.day)||!v.prices||Object.keys(v.prices).length!==s.players.length)return false;
  if(s.players.some(p=>!Object.hasOwn(v.prices,p.id)||(p.salaryUsd===null?v.prices[p.id]!==null:!Number.isSafeInteger(v.prices[p.id])||v.prices[p.id]<=0)))return false;
 }
 if(!g.visitedQuotes[g.teamId])return false;
 return true;
}
export function loadGame(storage,s){try{const raw=storage.getItem(SAVE_KEY);if(!raw)return {state:null,warning:null};const g=JSON.parse(raw);return validState(g,s)?{state:g,warning:null}:{state:null,warning:'旧存档版本不兼容或内容异常；原存档已保留。确认新开局后才覆盖。'};}catch{return {state:null,warning:'无法读取存档或存档已损坏；原存档已保留。'};}}
export function saveGame(storage,state){try{storage.setItem(SAVE_KEY,JSON.stringify(state));return {ok:true,warning:null};}catch{return {ok:false,warning:'自动保存失败，本次会话仍可继续；关闭页面可能丢失进度。'};}}
