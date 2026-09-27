import re,sys,subprocess,collections,os
lo,hi=int(sys.argv[1]),int(sys.argv[2]); N=int(sys.argv[3]) if len(sys.argv)>3 else 700
stop=set('i you we they he she it the a an to is are am do does not and of in on at this that'.split())
for l in open('targets_all.txt'):
    n,v=l.strip().split('|'); n=int(n)
    if n<lo or n>hi: continue
    f=f'subs/{v}.ru.vtt'
    if not os.path.exists(f): print(f'## {n} {v}: NOSUB'); continue
    t=subprocess.run(['python3','ext.py',f,'0','900'],capture_output=True,text=True).stdout
    en=re.findall(r"\b[A-Za-z][A-Za-z']*\b",t)
    c=collections.Counter(w.lower() for w in en)
    top=' '.join(f'{w}:{k}' for w,k in c.most_common(30))
    m=re.search(r'(в этом уроке|этом уроке|сегодня мы|новое правило|новая тема|важн\w+ тем|правило|разбер\w+|перейд\w+ к|переходим к)',t[250:])
    p=(m.start()+250) if m else 400
    print(f'## {n} {v} [EN] {top}\n   [RU] {t[max(0,p-100):p+N]}')
