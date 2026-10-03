import {RULES_VERSION,DIFFICULTIES,validateConfig,createRun,replayRun,referenceAssets} from '../src/prototype/rules.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY=256000;
const fail=(status,message)=>{const error=Error(message);error.status=status;throw error;};
async function digest(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');}
function publicRun(row){return{id:row.id,nickname:row.nickname,difficultyId:row.difficulty,assets:row.assets,day:row.day,ended:Boolean(row.ended),initialCash:row.initial_cash,updatedAt:row.updated_at};}
export function createRankingHandler(db,roster,{origins=['https://guanzigong-agent.github.io'],now=()=>new Date().toISOString()}={}){
 const version=roster.databaseSha256;
 return async function handle(request){
  const origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if(origins.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET,PUT,POST,DELETE,OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type,Authorization,X-Rules-Version,X-Roster-Version';}
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   const url=new URL(request.url),pathname=url.pathname.replace(/^\/api(?=\/)/,'');
   if(pathname==='/health')return json({ok:true,rulesVersion:RULES_VERSION,rosterVersion:version});
   if(pathname==='/leaderboard'&&request.method==='GET'){
    const difficulty=url.searchParams.get('difficulty'),own=url.searchParams.get('own');
    if(!DIFFICULTIES.some(d=>d.id===difficulty))fail(400,'难度无效');
    const where='rules_version=? AND roster_version=? AND difficulty=?';
    const rows=(await db.prepare(`SELECT id,nickname,difficulty,assets,day,ended,initial_cash,updated_at FROM runs WHERE ${where} ORDER BY assets DESC,created_at,id LIMIT 50`).bind(RULES_VERSION,version,difficulty).all()).results;
    let me=null;
    if(own&&UUID.test(own)){
     const row=await db.prepare(`SELECT * FROM runs WHERE id=? AND ${where}`).bind(own,RULES_VERSION,version,difficulty).first();
     if(row){
      const count=await db.prepare(`SELECT COUNT(*) AS n FROM runs WHERE ${where} AND (assets>? OR (assets=? AND (created_at<? OR (created_at=? AND id<?))))`).bind(RULES_VERSION,version,difficulty,row.assets,row.assets,row.created_at,row.created_at,row.id).first();
      me={...publicRun(row),rank:Number(count.n)+1};
     }
    }
    return json({difficultyId:difficulty,rows:rows.map((r,i)=>({...publicRun(r),rank:i+1})),me,updatedAt:now(),rulesVersion:RULES_VERSION,rosterVersion:version});
   }
   const match=pathname.match(/^\/runs\/([^/]+)(\/sync)?$/);
   if(!match||!UUID.test(match[1]))fail(404,'接口不存在');
   const id=match[1],token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
   if(!token)fail(401,'本局写入凭证无效');
   if(request.headers.get('X-Rules-Version')!==RULES_VERSION||request.headers.get('X-Roster-Version')!==version)fail(409,'该局属于旧规则或名单版本，请使用最新页面重新开局');
   if(Number(request.headers.get('Content-Length'))>MAX_BODY)fail(413,'操作记录过长');
   const text=await request.text();if(new TextEncoder().encode(text).length>MAX_BODY)fail(413,'操作记录过长');
   let body;try{body=JSON.parse(text);}catch{fail(400,'请求格式无效');}
   const tokenHash=await digest(token),timestamp=now();
   const row=await db.prepare('SELECT * FROM runs WHERE id=?').bind(id).first();
   if(row&&row.token_hash!==tokenHash)fail(403,'本局写入凭证不匹配');
   if(row&&(row.rules_version!==RULES_VERSION||row.roster_version!==version))fail(409,'该局属于旧规则或名单版本');
   // Used to remove our own release-verification records; no game UI exposes this.
   if(!match[2]&&request.method==='DELETE'){
    if(!row)fail(404,'本局不存在');
    await db.prepare('DELETE FROM runs WHERE id=? AND token_hash=?').bind(id,tokenHash).run();
    return json({deleted:true});
   }
   if(!match[2]&&request.method==='PUT'){
    let config;try{config=validateConfig(roster,body);}catch(error){fail(400,error.message);}
    const game=createRun(roster,config);
    if(row){
     if(row.nickname!==config.nickname||row.difficulty!==config.difficultyId||row.start_team!==config.teamId)fail(409,'本局开局信息已固定');
     return json({run:publicRun(row)});
    }
    await db.prepare('INSERT OR IGNORE INTO runs(id,token_hash,nickname,difficulty,start_team,rules_version,roster_version,assets,initial_cash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,tokenHash,config.nickname,config.difficultyId,config.teamId,RULES_VERSION,version,referenceAssets(roster,game),game.initialCash,timestamp,timestamp).run();
    const created=await db.prepare('SELECT * FROM runs WHERE id=?').bind(id).first();
    if(created.token_hash!==tokenHash)fail(403,'本局写入凭证不匹配');
    return json({run:publicRun(created)},201);
   }
   if(match[2]&&request.method==='POST'){
    if(!row)fail(404,'本局尚未创建');
    if(!body||Object.keys(body).join(',')!=='events'||!Array.isArray(body.events))fail(400,'仅接受操作记录');
    const old=JSON.parse(row.events),events=body.events;
    if(events.length<old.length||old.some((e,i)=>JSON.stringify(e)!==JSON.stringify(events[i])))fail(409,'不能改写已提交的操作，请恢复本局记录');
    let game;try{game=replayRun(roster,{nickname:row.nickname,difficultyId:row.difficulty,teamId:row.start_team},events);}catch(error){fail(400,error.message);}
    if(events.length===old.length)return json({run:publicRun(row)});
    const updated=await db.prepare('UPDATE runs SET events=?,revision=?,assets=?,day=?,ended=?,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(events),events.length,referenceAssets(roster,game),game.day,Number(game.ended),timestamp,id,row.revision).run();
    if(updated.meta.changes!==1)fail(409,'本局正在同步，请重试');
    return json({run:publicRun({...row,assets:referenceAssets(roster,game),day:game.day,ended:Number(game.ended),updated_at:timestamp})});
   }
   fail(405,'请求方法不支持');
  }catch(error){return json({error:error.status?error.message:'成绩服务暂时不可用，请重试'},error.status??503);}
 };
}
