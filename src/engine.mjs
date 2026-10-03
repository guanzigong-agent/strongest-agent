import {quote,referenceValue} from './pricing.mjs';import {dateAt} from './data.mjs';
function visit(s,g){g.visitedQuotes[g.teamId]={day:g.day,date:dateAt(s,g.day),prices:Object.fromEntries(s.players.map(p=>[p.id,quote(s,g,g.teamId,p.id)]))};return g;}
export function createGame(s,startTeamId='13'){
 const teamId=s.teams.some(t=>t.id===startTeamId)?startTeamId:s.teams[0].id;
 return visit(s,{version:s.version,day:1,teamId,cash:15000000,owners:Object.fromEntries(s.players.map(p=>[p.id,p.teamId])),holdings:[],realizedProfit:0,visitedQuotes:{},ended:false,transactions:[]});
}
export function act(s,state,action){
 const fail=error=>({ok:false,state,error});if(state.ended)return fail('本局已结束，请重新开局');
 const id=action.playerId,price=quote(s,state,state.teamId,id),holding=state.holdings.find(h=>h.playerId===id);
 if(action.type==='buy'){
  if(state.owners[id]!==state.teamId)return fail('球员已不在当前球队');
  if(price===null)return fail('当赛季合同薪资待核实，暂不能交易');
  if(state.holdings.length>=5)return fail('仓库已满，最多持有5名球员');
  if(state.cash<price)return fail('资金不足');
 }else if(action.type==='sell'){
  if(!holding||state.owners[id]!=='warehouse')return fail('仓库中没有该球员');if(price===null)return fail('报价不可用');
 }else if(action.type==='move'){
  if(state.day>=30)return fail('已到第30天，请完成交易并结算');
  if(action.teamId===state.teamId||!s.teams.some(t=>t.id===action.teamId))return fail('请选择另一支球队');
 }else if(action.type!=='finish')return fail('未知操作');
 const g=structuredClone(state);
 if(action.type==='buy'){g.cash-=price;g.owners[id]='warehouse';g.holdings.push({playerId:id,cost:price});}
 if(action.type==='sell'){g.cash+=price;g.owners[id]=g.teamId;g.holdings=g.holdings.filter(h=>h.playerId!==id);g.realizedProfit+=price-holding.cost;}
 if(action.type==='buy'||action.type==='sell')g.transactions.push({type:action.type,playerId:id,teamId:g.teamId,day:g.day,price});
 if(action.type==='move'){g.day++;g.teamId=action.teamId;visit(s,g);}
 if(action.type==='finish')g.ended=true;
 return {ok:true,state:g,error:null};
}
export function settle(s,g){
 const inventoryValue=g.holdings.reduce((n,h)=>n+(referenceValue(s,g,h.playerId)??0),0),cost=g.holdings.reduce((n,h)=>n+h.cost,0);
 return {cash:g.cash,inventoryValue,totalAssets:g.cash+inventoryValue,totalProfit:g.cash+inventoryValue-15000000,realizedProfit:g.realizedProfit,unrealizedProfit:inventoryValue-cost};
}
