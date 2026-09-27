import re,sys
# usage: ext.py vtt start_sec end_sec
f,a,b=sys.argv[1],float(sys.argv[2]),float(sys.argv[3])
txt=open(f).read()
out=[];last=''
for blk in txt.split('\n\n'):
    m=re.search(r'(\d+):(\d+):(\d+)\.\d+ -->',blk)
    if not m: continue
    t=int(m[1])*3600+int(m[2])*60+int(m[3])
    if t<a or t>b: continue
    lines=[re.sub(r'<[^>]+>','',l).strip() for l in blk.split('\n')[1:]]
    for l in lines:
        if l and l!=last and '<' not in l:
            if out and l.startswith(out[-1]): out[-1]=l
            elif l not in out[-3:]: out.append(l)
            last=l
print(' '.join(out))
