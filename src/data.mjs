export const dateAt=(s,day)=>new Date(Date.parse(s.startDate+'T00:00:00Z')+(day-1)*86400000).toISOString().slice(0,10);
export function validateSnapshot(s,{allowIncomplete=false}={}) {
 const errors=[],seen=new Set(),teams=new Set((s.teams??[]).map(t=>t.id)),sources=new Set((s.sources??[]).map(x=>x.id));
 const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 if(!validDate(s.startDate)||!validDate(s.endDate)||Date.parse(s.endDate)-Date.parse(s.startDate)!==29*86400000)errors.push('日期区间必须为连续30天');
 if(teams.size!==30||s.teams?.length!==30)errors.push('需要30支唯一球队');
 for(const p of s.players??[]){
  if(seen.has(p.id))errors.push('重复球员 '+p.id);seen.add(p.id);
  if(!teams.has(p.teamId))errors.push('未知归属 '+p.id);
  if(!Number.isSafeInteger(p.salaryUsd)||p.salaryUsd<=0||!sources.has(p.salarySourceId)){
   if(!(allowIncomplete&&p.salaryStatus==='missing'&&p.salaryUsd===null))errors.push('薪资缺失或非法 '+p.id);
  }
 }
 for(const f of s.dailyFacts??[])if(!seen.has(f.playerId)||!validDate(f.date)||f.date<s.startDate||f.date>s.endDate||!sources.has(f.sourceId))errors.push('比赛事实非法 '+f.playerId);
 return errors;
}
