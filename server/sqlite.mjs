import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
// D1-compatible adapter for local, restart-persistent integration tests.
export async function openDatabase(filename){
 const sqlite=new DatabaseSync(filename);
 sqlite.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 let closed=false;
 return{
  prepare(sql){let args=[];return{
   bind(...values){args=values;return this;},
   async first(){return sqlite.prepare(sql).get(...args)??null;},
   async all(){return{results:sqlite.prepare(sql).all(...args)};},
   async run(){const result=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(result.changes)}};},
  };},
  close(){if(!closed){sqlite.close();closed=true;}},
 };
}
