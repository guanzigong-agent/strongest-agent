import {RULES_VERSION} from './rules.mjs';
const STORAGE_KEY='nba-agent-runs-v1';
export function createScoreClient(api,{onChange=()=>{},storage}={}){
 let state={currentId:null,runs:[]},storageError=null,running=null,lastRaw=null,corrupt=false,readOnly=false;
 try{
  storage??=globalThis.localStorage;lastRaw=storage.getItem(STORAGE_KEY);
  if(lastRaw){
   const parsed=JSON.parse(lastRaw);
   if(!parsed||!Array.isArray(parsed.runs)||!parsed.runs.every(r=>r&&typeof r.id==='string'&&r.config&&Array.isArray(r.events)))throw Error();
   state={...parsed,runs:parsed.runs.map(r=>({...r,syncing:false}))};
  }
 }catch{corrupt=lastRaw!==null;storageError=corrupt?'本机存档异常，原始记录仍保留，请备份后重新开局':'浏览器存档无法读取，请检查存储权限';}
 let unlock;
 const ready=globalThis.document&&globalThis.navigator?.locks?new Promise(resolve=>{
  navigator.locks.request('nba-agent-writer-v1',{ifAvailable:true},async lock=>{
   if(!lock){readOnly=true;storageError='另一个标签正在运行游戏，请关闭该标签后刷新';resolve();return;}
   resolve();await new Promise(release=>{unlock=release;});
  }).catch(()=>{readOnly=true;storageError='浏览器无法锁定游戏存档，请刷新后重试';resolve();});
 }):Promise.resolve();
 globalThis.addEventListener?.('pagehide',()=>{readOnly=true;unlock?.();});
 globalThis.addEventListener?.('pageshow',e=>{if(e.persisted)location.reload();});
 function persist(next){
  try{
   if(readOnly)throw Error('另一个标签正在运行游戏，请关闭该标签后刷新');
   if(corrupt)throw Error('本机存档异常，原始记录仍保留，请备份后重新开局');
   if(storage.getItem(STORAGE_KEY)!==lastRaw)throw Error('其他标签已更新进度，请刷新后继续');
   const serialized=JSON.stringify(next);storage.setItem(STORAGE_KEY,serialized);lastRaw=serialized;state=next;storageError=null;
  }catch(error){storageError=/标签|异常/.test(error.message)?error.message:'浏览器无法保存本局，请检查存储空间或权限';onChange();throw Error(storageError);}
 }
 const current=()=>state.runs.find(r=>r.id===state.currentId)??null;
 function patch(id,fields){persist({...state,runs:state.runs.map(r=>r.id===id?{...r,...fields}:r)});onChange();}
 async function call(path,run,method,body){
  if(!api)throw Error('线上成绩服务尚未配置');
  const response=await fetch(api+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+run.key,'X-Rules-Version':run.rulesVersion,'X-Roster-Version':run.rosterVersion},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  const result=await response.json();if(!response.ok)throw Error(result.error??'成绩同步失败');return result;
 }
 function flush(){
  if(readOnly||corrupt)return Promise.resolve();
  if(running)return running;
  running=(async()=>{
   const ids=state.runs.filter(r=>r.rulesVersion===RULES_VERSION&&(!r.created||r.syncedCount<r.events.length)).map(r=>r.id);
   for(const id of ids){
    try{
     let run=state.runs.find(r=>r.id===id);patch(id,{syncing:true,error:null});
     if(!run.created){await call('/runs/'+id,run,'PUT',run.config);patch(id,{created:true});}
     do{
      run=state.runs.find(r=>r.id===id);const events=structuredClone(run.events);
      const result=await call('/runs/'+id+'/sync',run,'POST',{events});
      patch(id,{syncedCount:events.length,ack:result.run});
      run=state.runs.find(r=>r.id===id);
     }while(run.syncedCount<run.events.length);
     patch(id,{syncing:false,error:null});
    }catch(error){try{patch(id,{syncing:false,error:storageError??(error.name==='TypeError'?'网络连接失败':error.message)});}catch{}onChange();}
   }
  })().finally(()=>{running=null;});return running;
 }
 function schedule(){setTimeout(()=>flush(),0);}
 return{
  current,flush,ready,
  issue:()=>storageError,
  quarantine(){corrupt=true;storageError='本局记录异常，原始存档仍保留，请备份后重新开局';},
  recover(){
   if(lastRaw)storage.setItem(STORAGE_KEY+'-backup-'+Date.now(),lastRaw);
   corrupt=false;persist({currentId:null,runs:[]});
  },
  start(config,rosterVersion){
   const key=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
   const run={id:crypto.randomUUID(),key,config,rosterVersion,rulesVersion:RULES_VERSION,events:[],created:false,syncedCount:0,error:null};
   persist({...state,currentId:run.id,runs:[...state.runs,run]});schedule();return run;
  },
  append(event){const run=current();if(!run)throw Error('本局不存在');patch(run.id,{events:[...run.events,event]});schedule();},
  clearCurrent(){persist({...state,currentId:null});},
  status(){
   if(storageError)return{state:'error',message:storageError};
   const run=current();if(!run)return{state:'idle'};
   if(run.syncing)return{state:'syncing'};
   if(run.error)return{state:'error',message:run.error};
   return{state:run.created&&run.syncedCount===run.events.length?'saved':'pending'};
  },
 };
}
