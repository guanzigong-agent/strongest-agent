import http from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase} from './sqlite.mjs';
import {createRankingHandler} from './ranking.mjs';
export async function createScoreServer(filename,origins=['http://127.0.0.1:4173','http://localhost:4173']){
 if(filename!==':memory:')await mkdir(path.dirname(path.resolve(filename)),{recursive:true});
 const db=await openDatabase(filename),roster=JSON.parse(await readFile(new URL('../src/prototype/roster.json',import.meta.url),'utf8'));
 const handler=createRankingHandler(db,roster,{origins});
 const server=http.createServer(async(req,res)=>{
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>256000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
   const body=Buffer.concat(chunks),request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});
   const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'成绩服务暂时不可用，请重试'}));}
 });
 server.on('close',()=>db.close());return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=await createScoreServer(path.resolve('output/ranking/scores.sqlite'));
 server.listen(Number(process.env.SCORE_PORT??4174),'127.0.0.1',()=>console.log('本地持久成绩服务 http://127.0.0.1:'+server.address().port+'/api'));
}
