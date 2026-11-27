import json,math
from shapely import box,Point,union_all
from shapely.affinity import rotate,translate
from hillside import *
from mesh import ROOT
# Start with R1 centres. These corrections keep the yard furnishings on their newly terraced streets.
MOVED={'fitting-27':(-7.65,20.15),'fitting-29':(18.7,18.65),'fitting-11':(-12.25,-11.15),'fitting-15':(-8.20,-15.68),'fitting-19':(-4.2,-14.25),'fitting-26':(-12.05,12.55),'fitting-33':(4.35,22.10),'fitting-12':(.90,-6.40),'fitting-39':(11.52,-6.32)}
def geom(o):
 x,z=MOVED.get(o['key'],(o['x'],o['z']))
 if o['kind']=='arcade':return union_all([box(x-4.20,z-2.25,x+4.2,z+2.25),box(x+4.2,z-2.25,x+5.86,z+2.25)])
 base=translate(rotate(box(-o['w']/2,-o['d']/2,o['w']/2,o['d']/2),-o['rot'],origin=(0,0)),x,z)
 if o['kind']=='building':
  for f in o['doors']:
   w,d=o['w'],o['d'];span=w if f in 'NS' else d-.19;u=(-.23 if f in 'SE' else .24)*span
   if f in 'NS':xx=x+u;zz=z+(1 if f=='N' else -1)*(d/2+.69)
   else:xx=x+(1 if f=='E' else -1)*(w/2+.69);zz=z+u
   base=base.union(Point(xx,zz).buffer(.55))
 if o['kind']=='terrace':
  st=1.85 if o['key']=='staff-terrace' else -3.98
  base=base.union(box(x+st-1.02,z-o['d']/2-1.77,x+st+1.02,z-o['d']/2))
 return base
if __name__=='__main__':
 s=json.load(open(ROOT/'build/scene-site.json'))['objects']
 polys=[geom(o).buffer(.13) for o in s if o['kind'] in ('building','arcade','terrace','scatter','edge')]
 polys+=[Point(x,z).buffer(1.88) for x,z in [(-12,0),(12,0),(0,-12),(0,12)]]
 occ=union_all(polys)
 for side,lim in [('south',(-22.4,.7)),('north',(10.7,22.65))]:
  for k,line in enumerate(LINES[side]):
   ok=[]
   for z in np.arange(*lim,.30):
    seam=cut(line,z)
    if abs(cut(line,z+1.18)-cut(line,z-1.18))>.15:continue
    for offset in np.linspace(.60,STAIR_LENGTH-.60,18):
     a=seam-offset
     footprint=box(a-.63,z-1.11,a+STAIR_LENGTH+.63,z+1.11)
     if not footprint.intersects(occ):
      ok.append((round(a,2),round(z,2),k,round(footprint.distance(occ),2)))
   if len(ok):
    first=max(ok,key=lambda r:r[3]);others=[r for r in ok if abs(r[1]-first[1])>4.5];second=max(others,key=lambda r:r[3]) if others else None
    print(side,k,first,second)
   else: print(side,k,'none')
