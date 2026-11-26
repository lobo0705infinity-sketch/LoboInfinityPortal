"""Remove just the four low collar segments that crossed the existing commons doorway."""
from base import *
def clear_lintel(src,dst):
    lines=src.read_text().splitlines();v=[];group='';ids={};current=[]
    for l in lines:
        f=l.split()
        if not f:continue
        if f[0]=='v':v.append(list(map(float,f[1:4])))
        if f[0] in ['o','g']:group=f[1]
        if f[0]=='f':ids.setdefault(group,set()).update(int(t.split('/')[0])-1 for t in f[1:])
    ar=np.asarray(v);bad=set()
    for k,i in ids.items():
        p=ar[list(i)];lo=p.min(0);hi=p.max(0)
        if lo[1]>=.64 and hi[1]<=.82 and lo[2]<-1.60 and hi[2]<-1.30 and abs((hi[0]+lo[0])/2)<.65:bad.add(k)
    assert len(bad)==4,(src,bad)
    group='';out=[]
    for l in lines:
        f=l.split()
        if f and f[0] in ('o','g'):group=f[1]
        if group in bad and f and f[0] in ('o','g','f'):continue
        out.append(l)
    dst.write_text('\n'.join(out)+'\n')
if __name__=='__main__':
    o=next(o for o in ORIGINAL['ContainedObjects'] if o['GUID']=='c70030')
    for k,suffix in [('MeshURL',''),('ColliderURL','-collider')]:
        clear_lintel(local(o['CustomMesh'][k]),ASSETS/('commons-door'+suffix+'.obj'))
