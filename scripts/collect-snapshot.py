"""Read-only public ESPN data collection; caches are excluded from publication."""
import urllib.request, json, pathlib, datetime, concurrent.futures, time, hashlib, re, unicodedata, html
from salary_parser import parse_salary
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache'; CACHE.mkdir(exist_ok=True)
START=datetime.date(2025,10,21); END=START+datetime.timedelta(days=29)
SITE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/'
CORE='https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/'
def fetch(url):
 url=url.replace('http://','https://'); p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
 if p.exists(): return json.loads(p.read_text(encoding='utf-8'))
 for attempt in range(3):
  try:
   value=json.load(urllib.request.urlopen(url,timeout=30)); p.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8');return value
  except Exception:
   if attempt==2: raise
   time.sleep(1)
def parallel(fn,items):
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:return list(pool.map(fn,items))
names={'ATL':'老鹰','BOS':'凯尔特人','BKN':'篮网','CHA':'黄蜂','CHI':'公牛','CLE':'骑士','DAL':'独行侠','DEN':'掘金','DET':'活塞','GS':'勇士','HOU':'火箭','IND':'步行者','LAC':'快船','LAL':'湖人','MEM':'灰熊','MIA':'热火','MIL':'雄鹿','MIN':'森林狼','NO':'鹈鹕','NY':'尼克斯','OKC':'雷霆','ORL':'魔术','PHI':'76人','PHX':'太阳','POR':'开拓者','SAC':'国王','SA':'马刺','TOR':'猛龙','UTAH':'爵士','WSH':'奇才'}
teams=[]
for entry in fetch(SITE+'teams?limit=100')['sports'][0]['leagues'][0]['teams']:
 t=entry['team'];teams.append({'id':t['id'],'name':names.get(t['abbreviation'],t['displayName']),'englishName':t['displayName'],'abbr':t['abbreviation'],'color':'#'+t['color']})
dates=[START+datetime.timedelta(days=i) for i in range(-10,30)]
def board(d):return d,fetch(SITE+'scoreboard?dates='+d.strftime('%Y%m%d'))
boards=parallel(board,dates); events={}
for d,b in boards:
 for e in b.get('events',[]):
  if e.get('status',{}).get('type',{}).get('completed'):events[e['id']]=(d.isoformat(),e)
print('boards',len(boards),'events',len(events),flush=True)
def summary(item):
 eid,(date,event)=item;return eid,date,fetch(SITE+'summary?event='+eid)
games=parallel(summary,events.items());games.sort(key=lambda x:(x[1],x[0]));print('summaries',len(games),flush=True)
sources={}; roster={};last_roster={}; facts=[];baseline={};news=[]; assigned=set()
def source(id,url,label): sources[id]={'id':id,'url':url,'label':label,'provider':'SalarySwish' if 'salaryswish.com' in url else 'NBA' if 'nba.com' in url else 'GitHub' if 'github.com' in url else 'ESPN','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
for eid,date,g in games:
 sid='game-'+eid;source(sid,'https://www.espn.com/nba/boxscore/_/gameId/'+eid,'比赛技术统计')
 for team in g.get('boxscore',{}).get('players',[]):
  tid=team['team']['id'];players=[e for e in team.get('statistics',[{}])[0].get('athletes',[]) if e.get('athlete',{}).get('id')]
  if date<START.isoformat():last_roster[tid]=players
  elif tid not in roster:roster[tid]=last_roster.get(tid,players)
  labels=team.get('statistics',[{}])[0].get('labels',[])
  for entry in players:
   a=entry['athlete'];pid=a['id'];stats=dict(zip(labels,entry.get('stats',[])))
   if entry.get('didNotPlay') or not stats:continue
   try:
    num=lambda k:float(stats.get(k,'0'))
    pair=lambda k:[float(x) for x in stats.get(k,'0-0').split('-')]
    fg,fga=pair('FG');ft,fta=pair('FT');score=round(num('PTS')+.4*fg-.7*fga-.4*(fta-ft)+.7*num('OREB')+.3*num('DREB')+num('STL')+.7*num('AST')+.7*num('BLK')-.4*num('PF')-num('TO'),2)
   except ValueError:continue
   if date<START.isoformat():baseline.setdefault(pid,[]).append(score)
   else:facts.append({'date':date,'playerId':pid,'type':'game','payload':{'gameScore':score,'points':num('PTS'),'rebounds':num('REB'),'assists':num('AST'),'teamId':tid,'opponent':next((t['team']['displayName'] for t in g['boxscore']['players'] if t['team']['id']!=tid),'')},'sourceId':sid})
 if date>=START.isoformat():
  # Summarize numerical facts only; game article is linked, never copied.
  h=g.get('header',{});c=h.get('competitions',[{}])[0];cs=c.get('competitors',[])
  if len(cs)==2:
   title=' · '.join(t['team']['displayName']+' '+str(t.get('score','')) for t in cs)
   news.append({'date':date,'title':title,'summary':'真实比赛结果；球员技术统计可在原始战报核对。','sourceId':sid,'type':'result'})
def norm(name):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower())
opening_path=CACHE/'opening-roster.json'
if not opening_path.exists():
 opening_path.write_text(json.dumps(fetch('https://raw.githubusercontent.com/alexnoob/BasketBall-GM-Rosters/3ee24e048ebcc1ba851b13f32309929bf82ea521/2025-26.NBA.Roster.json')),encoding='utf-8')
opening=json.loads(opening_path.read_text(encoding='utf-8'))
abbr={'BRK':'BKN','CHO':'CHA','GSW':'GS','NOP':'NO','NYK':'NY','SAS':'SA','UTA':'UTAH','WAS':'WSH'}
tidmap={t['tid']:next(x['id'] for x in teams if x['abbr']==abbr.get(t['abbrev'],t['abbrev'])) for t in opening['teams'] if t['tid']<30}
active=[p for p in opening['players'] if 0<=p.get('tid',-1)<30]
slugindex=json.loads((ROOT/'data'/'salary-slugs.json').read_text(encoding='utf-8')) if (ROOT/'data'/'salary-slugs.json').exists() else {}
nameids={}
for _,_,g in games:
 for t in g.get('boxscore',{}).get('players',[]):
  for e in t.get('statistics',[{}])[0].get('athletes',[]):
   a=e.get('athlete',{});
   if a.get('id'):nameids[norm(a['displayName'])]=a['id']
def salary_player(p):
 name=p.get('name') or (p.get('firstName','')+' '+p.get('lastName','')).strip()
 clean=unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower()
 clean=re.sub(r"[^a-z0-9 ]",'',clean);slug=re.sub(r'\s+','-',clean.strip());slug=re.sub(r'-(jr|ii|iii)$',r'\1',slug)
 aliases={'nic-claxton':'nicolas-claxton','alex-sarr':'alexandre-sarr','bones-hyland':'nahshon-bones-hyland','bub-carrington':'carlton-carrington','cam-christie':'cameron-christie','gg-jacksonii':'gg-jackson-ii','jase-richardsonjr':'jase-richardson','tolu-smith':'tolu-smith-iii','yanic-konan-niederhauser':'yanic-niederhauser','nick-smithjr':'nick-smith-jr','vince-williamsjr':'vince-williams-jr','lindy-watersiii':'lindy-waters-iii','daron-holmesii':'daron-holmes','xavier-tillman':'xavier-tillman-sr','kj-simpson':'kj-simpson','nikola-djurisic':'nikola-durisic','david-jones-garcia':'david-jones'}
 slug=slugindex.get(norm(name),aliases.get(slug,slug));url='https://www.salaryswish.com/players/'+slug;pfile=CACHE/('sw-'+slug+'.html')
 try:
  if pfile.exists():content=pfile.read_text(encoding='utf-8')
  else:
   content=urllib.request.urlopen(url,timeout=25).read().decode();pfile.write_text(content,encoding='utf-8')
  value=parse_salary(content,START.isoformat())
  return p,name,url,value,None
 except Exception as e:return p,name,url,None,str(e)
players=[];missing=[]
overrides={norm(x['name']):x for x in json.loads((ROOT/'data'/'contract-overrides.json').read_text(encoding='utf-8'))}
for p,name,url,salary,error in parallel(salary_player,active):
 pid=nameids.get(norm(name),'name-'+norm(name));tid=tidmap[p['tid']];sid='salary-'+pid
 override=overrides.get(norm(name))
 if not salary and override:salary=override['salaryUsd'];url=override['url'];source('contract-'+pid,override['contractSource'],override['note'])
 if salary and salary>0:source(sid,url,'SalarySwish 2025-26 Base Salary')
 else:missing.append({'id':pid,'name':name,'teamId':tid,'error':error or '赛季合同薪资缺失'})
 pos=p.get('pos','F');pos='G' if 'G' in pos else ('C' if 'C' in pos else 'F')
 players.append({'id':pid,'name':name,'teamId':tid,'position':pos,'salaryUsd':salary if salary else None,'salarySourceId':sid if salary else None,'salaryStatus':override['status'] if override else ('single-source' if salary else 'missing')})
ids={p['id'] for p in players};facts=[f for f in facts if f['playerId'] in ids]
curated=json.loads((ROOT/'data'/'curated-news.json').read_text(encoding='utf-8'))
for i,n in enumerate(curated):
 pid=next((p['id'] for p in players if norm(p['name'])==norm(n['playerName'])),None)
 if not pid:continue
 sid='news-'+str(i);source(sid,n['url'],'NBA 官方站新闻');news.append({'date':n['date'],'title':n['title'],'summary':n['summary'],'sourceId':sid,'type':'news'})
 if n['impact']:facts.append({'date':n['date'],'playerId':pid,'type':'news','payload':{'impact':n['impact']},'sourceId':sid})
facts.sort(key=lambda f:(f['date'],f['playerId']))
source('roster-opening','https://github.com/alexnoob/BasketBall-GM-Rosters/blob/3ee24e048ebcc1ba851b13f32309929bf82ea521/2025-26.NBA.Roster.json','2025-10-22 社区开季阵容快照，仅使用姓名与球队，不使用其平均合同金额或能力评分')
source('roster-official','https://www.nba.com/news/nba-rosters-set-for-2025-26-regular-season','NBA 官方开季名单索引（球队动态链接不作为历史名单证明）')
snapshot={'version':'2025-26-opening-v1','season':'2025-26','startDate':START.isoformat(),'endDate':END.isoformat(),'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'teams':teams,'players':players,'dailyFacts':facts,'baselines':{pid:round(sum(v[-5:])/len(v[-5:]),2) for pid,v in baseline.items() if pid in ids},'news':news,'sources':list(sources.values()),'coverage':{'rosterMethod':'Community opening-night snapshot dated Oct 22, 2025; historical boxscores cross-check names/IDs. Official team-by-team full roster verification pending.','salaryMethod':'SalarySwish 2025-26 Base Salary; latest applicable historical contract row, excluding cap hit. Single-source, missing fields disabled.','missingSalaries':missing,'independentlyVerified':False,'newsScope':'Game results complete for retrieved games; injury/transaction news is curated and not complete.'}}
(ROOT/'data').mkdir(exist_ok=True);(ROOT/'data'/'snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('DONE',len(players),'players',len(facts),'performances',len(news),'results','missing salaries',len(missing),flush=True)
(CACHE/'missing-salaries.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2),encoding='utf-8')
