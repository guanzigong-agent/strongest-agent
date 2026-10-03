// Shared, deterministic game rules. The server calculates scores from actions.
export const RULES_VERSION = 'market-20261003-v1';
export const CAPACITY = 15;
export const DIFFICULTIES = [
 {id:'easy',name:'轻松',cash:30e6,label:'3000万美元',note:'更充足的周转资金'},
 {id:'standard',name:'标准',cash:10e6,label:'1000万美元',note:'在资金与机会间取舍'},
 {id:'challenge',name:'挑战',cash:5e6,label:'500万美元',note:'从小额交易起步'},
];
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
export const bucket=p=>p.position.includes('C')?'C':p.position.includes('G')?'G':'F';
const player=(data,id)=>data.players.find(p=>p.id===id);
function random(key){
 let n=2166136261;
 for(const c of key)n=Math.imul(n^c.charCodeAt(0),16777619);
 n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;
 return(n>>>0)/4294967296;
}
export function validateConfig(data,config){
 if(!config||Object.keys(config).some(k=>!['nickname','difficultyId','teamId'].includes(k)))throw Error('开局信息格式无效');
 const nickname=typeof config.nickname==='string'?config.nickname.trim():'';
 if(!nickname||[...nickname].length>12||/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(nickname))throw Error('请输入1～12字的游戏昵称');
 if(!DIFFICULTIES.some(d=>d.id===config.difficultyId))throw Error('难度无效');
 if(!data.teams.some(t=>t.id===config.teamId))throw Error('球队无效');
 return{nickname,difficultyId:config.difficultyId,teamId:config.teamId};
}
export function createRun(data,config){
 const valid=validateConfig(data,config),difficulty=DIFFICULTIES.find(d=>d.id===valid.difficultyId);
 const game={...valid,day:1,initialCash:difficulty.cash,cash:difficulty.cash,holdings:[],realized:0,transactions:0,
  owners:Object.fromEntries(data.players.map(p=>[p.id,p.teamId])),daily:{},visits:{},ended:false,arrival:'start'};
 newDay(data,game);visit(data,game);return game;
}
function newDay(data,game){
 const factors={},previous=game.daily[game.day-1];
 for(const p of data.players){
  if(!previous)factors[p.id]=.65+random('start:'+p.id)*.8;
  else{
   const tier=random(`tier:${p.id}:${game.day}`),magnitude=random(`size:${p.id}:${game.day}`);
   const change=tier<.72?.05+magnitude*.1:tier<.95?.15+magnitude*.1:.25+magnitude*.15;
   const old=previous.factors[p.id],downChance=old>1.9?.6:old<.5?.4:.5;
   factors[p.id]=clamp(old*(1+(random(`direction:${p.id}:${game.day}`)<downChance?-1:1)*change),.3,2.5);
  }
 }
 const counts=Object.fromEntries(data.teams.map(t=>[t.id,{G:0,F:0,C:0}]));
 for(const p of data.players)if(counts[game.owners[p.id]])counts[game.owners[p.id]][bucket(p)]++;
 const average=Object.fromEntries(['G','F','C'].map(pos=>[pos,data.teams.reduce((n,t)=>n+counts[t.id][pos],0)/data.teams.length]));
 const demand=Object.fromEntries(data.teams.map(t=>[t.id,Object.fromEntries(['G','F','C'].map(pos=>[pos,clamp((average[pos]-counts[t.id][pos])*.03,-.15,.15)]))]));
 game.daily[game.day]={factors,demand};
}
export function quote(data,game,p,teamId=game.teamId,day=game.day){
 if(!p?.salaryUsd)return null;
 const daily=game.daily[day];
 return Math.round(p.salaryUsd*clamp(daily.factors[p.id]*(1+daily.demand[teamId][bucket(p)]),.3,2.5));
}
function visit(data,game){
 game.visits[game.teamId]={day:game.day,prices:Object.fromEntries(data.players.map(p=>[p.id,quote(data,game,p)])),local:data.players.filter(p=>game.owners[p.id]===game.teamId).map(p=>p.id)};
}
export function referenceAssets(data,game){
 return game.cash+game.holdings.reduce((n,h)=>n+Math.round(player(data,h.id).salaryUsd*game.daily[game.day].factors[h.id]),0);
}
export function applyEvent(data,game,event){
 if(game.ended)throw Error('本局已结算');
 if(!event||typeof event!=='object'||Array.isArray(event))throw Error('操作格式无效');
 const expected={buy:['type','id'],sell:['type','id'],move:['type','teamId'],finish:['type']}[event.type];
 if(!expected||Object.keys(event).sort().join(',')!==[...expected].sort().join(','))throw Error('操作格式无效');
 if(event.type==='buy'){
  const p=player(data,event.id),cost=quote(data,game,p);
  if(!p||game.owners[p.id]!==game.teamId||cost==null||cost>game.cash||game.holdings.length>=CAPACITY)throw Error('无法买入该球员');
  game.cash-=cost;game.owners[p.id]='warehouse';game.holdings.push({id:p.id,cost,day:game.day,teamId:game.teamId});game.transactions++;
 }else if(event.type==='sell'){
  const h=game.holdings.find(h=>h.id===event.id);if(!h)throw Error('未持有该球员');
  const price=quote(data,game,player(data,h.id));game.cash+=price;game.realized+=price-h.cost;game.owners[h.id]=game.teamId;
  game.holdings=game.holdings.filter(x=>x.id!==h.id);game.transactions++;
 }else if(event.type==='move'){
  if(game.day>=30||game.teamId===event.teamId||!data.teams.some(t=>t.id===event.teamId))throw Error('无法移动到该球队');
  game.day++;game.teamId=event.teamId;newDay(data,game);visit(data,game);game.arrival='move';
 }else game.ended=true;
 return game;
}
export function replayRun(data,config,events){
 if(!Array.isArray(events)||events.length>4000)throw Error('操作记录过长或无效');
 const game=createRun(data,config);for(const event of events)applyEvent(data,game,event);return game;
}
