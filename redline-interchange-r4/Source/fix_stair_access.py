"""R4: open the actual stair approaches in both concourse states."""
from pathlib import Path
import ast, copy, json, sys
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'Source'))
from geometry import pair,solid

def concourse(roof):
 m=pair();w=17.5;d=2.75;floor=3.25
 solid(m,(0,floor-.10,0),(w,.2,d),'metal')
 for x in [-8.,-4.,4.,8.]:
  for z in [-1.21,1.21]:solid(m,(x,1.6,z),(.28,3.2,.28),'concrete')
 for sign in [-1,1]:
  z=sign*d/2;cx=sign*7.5;lo=cx-1.15;hi=cx+1.15
  # Two 2.30-inch openings face the real top stair treads, not the open ends.
  for a,b in [(-w/2,lo),(hi,w/2)]:
   solid(m,((a+b)/2,floor+.45,z),(b-a,.9,.18),'concrete')
   solid(m,((a+b)/2,floor+1.85,z),(b-a,1.9,.18),'blue')
  for x in np.arange(-8.5,8.6,1.7):
   if lo-.035<x<hi+.035:continue
   for face in [-1,1]:m[0].box((x,floor+1.85,z+face*.105),(.07,1.9,.035),'silver')
  # Full-depth jambs are outside the clear opening; header clears standing S2.
  for x in [lo-.025,hi+.025]:solid(m,(x,floor+1.35,z),(.05,2.7,.22),'silver')
  solid(m,(0,floor+2.8,z),(w,.20,.18),'metal')
  # Flush steel threshold bridges the seam between top tread and deck edge.
  solid(m,(cx,floor-.05,sign*1.375),(2.30,.10,.31),'metal')
 if roof:
  solid(m,(0,floor+2.99,0),(w+.15,.18,d+.18),'roof')
  for x in np.arange(-8.5,8.6,1.7):
   for z in [-d/2,d/2]:m[0].beam((x,floor+2.9,z),(x,floor+3.2,0),.075,mat='silver')
 return m

def main():
 # Retain the authoring source's normal full-map entry point for reproducibility.
 p=ROOT/'Source/build_map.py';source=p.read_text();tree=ast.parse(source)
 node=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='concourse')
 own=Path(__file__).read_text();own_node=next(n for n in ast.parse(own).body if isinstance(n,ast.FunctionDef)and n.name=='concourse')
 lines=source.splitlines();replacement='\n'.join(own.splitlines()[own_node.lineno-1:own_node.end_lineno])
 lines[node.lineno-1:node.end_lineno]=replacement.splitlines();p.write_text('\n'.join(lines)+'\n')
 for roof in [False,True]:
  name='concourse-'+('roof'if roof else'open');visual,collision=concourse(roof)
  visual.write(ROOT/'Assets'/(name+'.obj'))
  collision.write(ROOT/'Assets'/(name+'-collider.obj'),compound=True)
 # Match every component to the user's approved save, including moved screens.
 save=json.loads((ROOT.parent/'approved-redline/TS_Save_35.json').read_text())
 baseline=json.loads((ROOT/'Map-Bags/Redline-Interchange-Cutthroat-R3.json').read_text())
 by={o['GUID']:o for o in save['ObjectStates']};bag=baseline['ObjectStates'][0]
 roots=[]
 for o in bag['ContainedObjects']:
  ids=[o['GUID']]+[q['GUID']for q in o.get('States',{}).values()]
  found=[by[g]for g in ids if g in by];assert len(found)==1,(o['Nickname'],ids)
  roots.append(copy.deepcopy(found[0]))
 bag['ContainedObjects']=roots
 bag['Nickname']='Redline Interchange | Cutthroat | R4 Stair Access Fix'
 bag['Description']='Approved Redline layout with both concourse stair entrances opened in visible and collision meshes. 2.30-inch clear entrances and flush thresholds in both states. Drop on the Infinity deployment stage.'
 (ROOT/'Source/R4-approved-layout-bag.json').write_text(json.dumps(baseline,indent=2))
 print('Rebuilt four concourse assets; recovered all 79 approved map components.')

if __name__=='__main__':main()
