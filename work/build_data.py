import json,re,pathlib
base=pathlib.Path('.')
lex={}
for fname in ['work/jyutping-chars.yaml','work/jyutping-words.yaml']:
 for l in pathlib.Path(fname).read_text().splitlines():
  p=l.split('\t')
  if len(p)>1 and re.fullmatch(r'[a-z1-6 ]+',p[1]):
   weight=float(p[2].strip('%')) if len(p)>2 and re.fullmatch(r'[0-9.]+%?',p[2]) else 100
   lex.setdefault(p[0],[]).append((p[1],weight))
selected={}
groups=[]
for line in pathlib.Path('work/content.txt').read_text().splitlines():
 if line.startswith('#'): groups.append({'title':line[1:],'chars':[]});continue
 t,s,j,c,m,w,e=line.split('|')
 if j not in [v[0] for v in lex.get(t,[])]: print('CHECK',t,j)
 selected[t]=j
 groups[-1]['chars'].append({'t':t,'s':s,'jp':j,'parts':c,'meaning':m,'wordtexts':w.split(','),'example':e})
overrides={'係':'hai6','嘅':'ge3','咗':'zo2','呢':'ni1','啲':'di1','喺':'hai2','畀':'bei2','佢':'keoi5','哋':'dei6','咩':'me1','唔':'m4','吓':'haa5','嚿':'gau6','緊':'gan2','睇':'tai2','喇':'laa3','點':'dim2','會':'wui5','幾':'gei2','落':'lok6','間':'gaan1','支':'zi1','本':'bun2','張':'zoeng1','個':'go3','鐘':'zung1','陣':'zan6','一齊':'jat1 cai4','巴士車':'baa1 si2 ce1','我哋':'ngo5 dei6','你哋':'nei5 dei6','好好':'hou2 hou2'}
def romanize(s):
 result=[];i=0
 while i<len(s):
  if re.match(r'[\W\d]',s[i],re.ASCII) and ord(s[i])<128 or s[i] in '，。？！：「」、': i+=1;continue
  found=False
  for n in range(min(6,len(s)-i),1,-1):
   word=s[i:i+n]
   if word in overrides or word in lex:
    result.append(overrides.get(word) or max(lex[word],key=lambda a:a[1])[0]);i+=n;found=True;break
  if found:continue
  ch=s[i]
  if ch in overrides or ch in selected or ch in lex: result.append(overrides.get(ch) or selected.get(ch) or max(lex[ch],key=lambda a:a[1])[0])
  else: print('MISSING',ch,s);result.append(ch)
  i+=1
 return ' '.join(result)
for g in groups:
 for c in g['chars']:
  c['words']=[{'t':w,'jp':romanize(w)} for w in c.pop('wordtexts')]
  c['exampleJP']=romanize(c['example'])
  parts=c['parts'];c['stroke']='先觀察字形，再照範字寫三次。'
  if '獨體' in parts or '橫' in parts:c['stroke']+='留意橫、豎、撇、捺的位置與長短。'
  else:c['stroke']+='按部件分區：一般先上後下、先左後右；包圍結構先外後內，封口最後。'
lessons=[]
for n in range(60):
 g=groups[n if n<30 else (n-30)%30]
 title=g['title'] if n<30 else ('拆字重溫 · ' if n<40 else '生活應用 · ')+g['title']
 lessons.append({'id':n,'week':n//5+1,'day':n%5+1,'title':title,'characters':[c['t'] for c in g['chars']],'sentences':[{'t':c['example'],'jp':c['exampleJP']} for c in g['chars'][:3]],'review':n>=30})
chars={c['t']:c for g in groups for c in g['chars']}
cj=[['日','A','日'],['月','B','月'],['木','D','木'],['水','E','水'],['火','F','火'],['土','G','土'],['人','O','人'],['口','R','口'],['山','U','山'],['田','W','田'],['明','AB','日月'],['林','DD','木木'],['森','DDD','木木木'],['休','OD','人木'],['好','VND','女子木'],['字','JND','十弓木'],['早','AJ','日十'],['多','NINI','弓戈弓戈'],['安','JV','十女'],['信','OYMR','人卜一口']]
actual={}
for l in pathlib.Path('work/cangjie5-base.yaml').read_text().splitlines():
 p=l.split('\t')
 if len(p)>1:actual.setdefault(p[0],[]).append(p[1].upper())
for t,code,r in cj:
 if code not in actual.get(t,[]):print('CJ CHECK',t,code,actual.get(t))
pathlib.Path('dist/data.js').write_text('const DATA='+json.dumps({'chars':chars,'lessons':lessons,'cj':cj},ensure_ascii=False,separators=(',',':'))+';\n')
print('Lessons',len(lessons),'Unique chars',len(chars))
