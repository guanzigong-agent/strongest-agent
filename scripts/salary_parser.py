import re,datetime,html
def parse_salary(content,cutoff):
 values=[];limit=datetime.date.fromisoformat(cutoff)
 for match in re.finditer(r'<tr\b[^>]*>.*?</tr>',content,re.S):
  row=match.group()
  if not re.search(r'>\s*2025-26\s*<',row):continue
  prefix=html.unescape(re.sub('<[^>]+>',' ',content[:match.start()]))
  dates=list(re.finditer(r'Signing Date\s*:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})',prefix))
  if not dates:continue
  m=dates[-1]
  if 'DEAD CAP' in prefix[m.end():]:continue
  signed=datetime.datetime.strptime(m.group(1),'%B %d, %Y').date()
  if signed>limit:continue
  amounts=re.findall(r'\$([\d,]+)',row)
  if len(amounts)>=2:values.append((signed,int(amounts[1].replace(',',''))))
 return max(values,key=lambda x:x[0])[1] if values else None
