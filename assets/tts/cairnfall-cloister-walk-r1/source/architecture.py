"""Attach the canopy to the existing roof state and widen the uppermost stair tread."""
from pathlib import Path
from materials import ROOT,OUT
from mesh import fmt
def cached(s):return next((ROOT/'cache').glob('*-'+s))
def merge(original,extra,outname,collider=False):
    dest=[];v0=u0=0
    for line in cached(original).read_text().splitlines():
        if line.startswith('v '):v0+=1
        if line.startswith('vt '):
            uv=list(map(float,line.split()[1:3]));line='vt '+fmt(uv[0]/2)+' '+fmt(uv[1]);u0+=1
        dest.append(line)
    if not collider:dest.append('g receiving-canopy')
    # Canopy model origin is at (17,4,-6.4). Clinic origin is (17,4.75,-10.5), yaw 180.
    for l in (OUT/extra).read_text().splitlines():
        key,_,r=l.partition(' ')
        if key=='v':
            x,y,z=map(float,r.split());dest.append('v '+' '.join(map(fmt,(-x,y-.75,-4.1-z))))
        elif key=='vt':
            u,v=map(float,r.split());dest.append('vt '+fmt(.5+u*.5)+' '+fmt(v))
        elif key=='o':dest.append('o canopy-'+r)
        elif key=='f':
            new=[]
            for item in r.split():
                k=item.split('/');v=int(k[0])+v0;new.append(str(v) if collider else f'{v}/{int(k[1])+u0}')
            dest.append('f '+' '.join(new))
    (OUT/outname).write_text('\n'.join(dest)+'\n')
def landing(original,out):
    result=[];count=0
    for line in cached(original).read_text().splitlines():
        if line.startswith('v '):
            x,y,z=map(float,line.split()[1:]);wz=-10.5-z;wx=17+x
            if 15.5<=wx<=18.5 and -5.8501<wz<=-3.84:
                # Existing top step and body are continuous with the terrace. Keep its foot and stair width.
                wz2=(-5.85+(wz+5.85)*(.63/(2/12))) if wz < -5.85+2/12 else (-5.22+(wz+5.85-2/12)*((2-.63)/(2-2/12)))
                line='v '+' '.join(map(fmt,(x,y,-10.5-wz2)));count+=1
        result.append(line)
    assert count>12
    (OUT/out).write_text('\n'.join(result)+'\n')
def build():
    merge('clinic-roof.obj','receiving-canopy.obj','clinic-roof-porch.obj')
    merge('clinic-roof-collider.obj','receiving-canopy-col.obj','clinic-roof-porch-col.obj',True)
    landing('clinic-terrace.obj','clinic-landing.obj');landing('clinic-terrace-collider.obj','clinic-landing-col.obj')
if __name__=='__main__':build()
