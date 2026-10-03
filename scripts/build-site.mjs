import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export const publicFiles=[
 'index.html',
 'src/prototype/index.html',
 'src/prototype/prototype.css',
 'src/prototype/prototype.mjs',
 'src/prototype/roster.json',
 'src/prototype/leaderboard.css',
 'src/prototype/leaderboard.mjs',
 'docs/public-data-sources.md',
];
export async function buildSite(destination=path.join(root,'output/site')){
 const roster=JSON.parse(await readFile(path.join(root,'src/prototype/roster.json'),'utf8'));
 if(roster.teams.length!==30||roster.players.length!==620)throw Error('Unexpected roster coverage');
 for(const relative of publicFiles){
  const target=path.join(destination,relative);
  await mkdir(path.dirname(target),{recursive:true});
  await copyFile(path.join(root,relative),target);
 }
 await writeFile(path.join(destination,'.nojekyll'),'');
 return {files:publicFiles.length+1,teams:roster.teams.length,players:roster.players.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildSite()));
