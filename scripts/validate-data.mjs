import {readFileSync} from 'node:fs';
import {validateSnapshot} from '../src/data.mjs';
const s=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url)));
const errors=validateSnapshot(s,{allowIncomplete:process.argv.includes('--allow-incomplete')});
console.log(JSON.stringify({teams:s.teams.length,players:s.players.length,performances:s.dailyFacts.filter(f=>f.type==='game').length,missingSalaries:s.coverage.missingSalaries.length,errors},null,2));
if(errors.length)process.exitCode=1;
