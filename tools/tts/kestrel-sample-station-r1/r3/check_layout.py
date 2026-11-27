from plan import *
from build_station import build,SHIELDS
from shapely.geometry import Polygon,Point,LineString,box
from shapely.ops import unary_union
import check_geometry as qc, survey
import numpy as np
qc.local=resource;survey.local=resource
GRADE=6.25
def bodies(o):
 yield o
 for child in o.get('ChildObjects',[]):
  t=child['Transform']
  if not any(abs(t[k])>.00001 for k in ('posX','posY','posZ','rotX','rotY','rotZ')):
   q=dict(child,Transform=o['Transform']);yield q
def contact(g,by,ht):
 return unary_union([p for sub in bodies(by[g]) for p in qc.component_sections(sub,GRADE+ht)])
ENDS={
 'e53201':('c70007','c70025'),'e53202':('e53101','c70025'),'e53203':('e53101','c7a300'),
 'e53204':('c70025','c7002b'),'e53205':('c7002b','e53102'),'e53206':('e53102','e53103'),
 'e53207':('e53208','e51009'),'e53208':('e53103','acd6a1'),
}
def summary(verbose=False):
 b=build();by={o['GUID']:o for o in b['ContainedObjects']}
 fp=survey.footprints(b)
 if verbose:
  for g,p in fp.items():
   for k,r in fp.items():
    if k<=g or {k,g}=={'c70033','c70035'}:continue
    area=p.intersection(r).area
    if area>.11:print('CROSS',g,k,round(area,2))
 rows={}
 links={**LINKS,CREW_LINK[0]:CREW_LINK[1:]}
 for ht in [.27,.75,1.38]:
  for g,(p,q) in ENDS.items():
   name,a,b1=links[g];aa=np.array(a);bb=np.array(b1);u=(bb-aa)/np.linalg.norm(bb-aa)
   ln=LineString([list((aa-u*.23)[::-1]),list((bb+u*.23)[::-1])])
   for part in [p,g,q]:
    dist=round(2*ln.distance(contact(part,by,ht)),3)
    row=rows.setdefault((g,part),[]);row.append(dist)
 if verbose:
  for (g,part),row in rows.items():
   if part!=g:print(g,part,row)
 return rows
if __name__=='__main__':summary(True)
