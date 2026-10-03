import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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
 'src/prototype/rules.mjs',
 'src/prototype/score-client.mjs',
 'src/prototype/api-config.mjs',
 'src/prototype/score-preview.css',
 'docs/public-data-sources.md',
];
export async function buildSite(destination=path.join(root,'output/site')){
 const roster=JSON.parse(await readFile(path.join(root,'src/prototype/roster.json'),'utf8'));
 if(roster.teams.length!==30||roster.players.length!==620)throw Error('Unexpected roster coverage');
 const sources=await Promise.all(publicFiles.map(async relative=>[
  relative,Buffer.from((await readFile(path.join(root,relative),'utf8')).replace(/\r\n/g,'\n')),
 ]));
 const hash=createHash('sha256');
 hash.update((await readFile(fileURLToPath(import.meta.url),'utf8')).replace(/\r\n/g,'\n'));
 for(const [relative,bytes] of sources)hash.update(relative).update('\0').update(bytes);
 const revision=hash.digest('hex').slice(0,12);
 for(const [relative,bytes] of sources){
  const target=path.join(destination,relative);
  await mkdir(path.dirname(target),{recursive:true});
  let content=bytes;
  if(relative.endsWith('.html')){
   content=bytes.toString('utf8').replace(/(\.\/[^"'<>\s]+\.(?:html|css|mjs))(?=["'])/g,`$1?v=${revision}`)
    .replace('</head>',`<meta name="game-build" content="${revision}">\n</head>`);
  }else if(relative.endsWith('.mjs')){
   content=bytes.toString('utf8').replace(/(["'])(\.\/[^"'\s]+\.(?:mjs|json))\1/g,(_,quote,url)=>`${quote}${url}?v=${revision}${quote}`);
  }
  await writeFile(target,content);
 }
 await writeFile(path.join(destination,'.nojekyll'),'');
 return {files:publicFiles.length+1,teams:roster.teams.length,players:roster.players.length,revision};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildSite()));
