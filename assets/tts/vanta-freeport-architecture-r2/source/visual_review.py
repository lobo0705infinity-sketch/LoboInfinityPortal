"""Prepare camera views of the actual closed and open TTS meshes."""
from map_release import *
import numpy as np
from pathlib import Path
BASE=R1/'work'
def prepare():
 original=yard.load(BASE/'render-scene.json');bag,_=build('PREVIEW')
 roots={o['GUID']:o for o in bag['ObjectStates'][0]['ContainedObjects']if o['GUID']in BY};rows=[]
 for r in original:
  b=next((o for o in roots.values()if max(abs(r['t'][i][3]-o['Transform'][axis])for i,axis in ((0,'posX'),(1,'posY'),(2,'posZ')))<.002 and ('State' in r['name'] or r['name']in ('Freight Scan Pavilion','Covered Transfer Dock'))),None)
  if not b:rows.append(r);continue
  d=BY[b['GUID']];rr=dict(r);rr.update(name=d['name'],image=str(A/'freeport-facades.jpg'),rgba=[1.,1.,1.,1.],normal=str(A/'freeport-normal.jpg'),guid=b['GUID'])
  for level in range(1,len(b.get('States',{}))+2):
   row=dict(rr);row['mesh']=str(A/(d['slug']+'-s'+str(level)+'.obj'));row['level']=level;row['high']=len(b.get('States',{}))+1;rows.append(row)
 assert len({r['guid']for r in rows if 'guid'in r})==14
 yard.save(W/'render-scene.json',rows)
 def world(g,p):
  v=yard.matrix(roots[g]['Transform'])@np.array([*p,1]);return tuple(float(i)for i in v[:3])
 def hero(name,g,eye,look,scale,w,h,mode):
  return (name,world(g,eye),world(g,look),scale,w,h,mode)
 views=[('overview',(-59,83,0),(0,4.9,0),55.4,1340,1090,'closed'),
        ('quayside',(21.6,23.2,21.9),(-.4,6.15,-.3),23.2,1440,920,'closed'),
        hero('dispatch','7a2103',(10.8,8.1,-12.3),(0,3.11,.0),15.5,1260,775,'isolated'),
        hero('sealworks','da0dca',(13.8,9.6,7.5),(0,3.06,.0),15.20,1260,775,'isolated'),
        hero('rail','7a2101',(-13.4,10.9,13.1),(-.15,1.9,.10),14.3,1050,760,'isolated'),
        hero('cold','7a2106',(12.3,9.1,11.8),(.24,1.9,-.18),13.1,1050,760,'isolated'),
        hero('desk','7a2103',(-.88,2.86,-1.00),(-.96,1.00,2.33),4.24,1070,710,'inside'),
        hero('lab','da0dca',(.49,2.81,.62),(.04,1.02,-2.39),4.15,1070,710,'inside'),
        hero('fridge','7a2106',(.78,2.96,.22),(.14,1.04,-3.13),4.32,1070,710,'inside'),
        hero('library','7a2184',(-1.42,2.92,-1.62),(-1.10,.99,1.61),4.38,1070,710,'inside')]
 template=(BASE/'blender.py').read_text();template=template[:template.index('views=')]+'views='+repr(views)+'\n'+template[template.index("if '--'"):]
 template=template.replace("(.58,.64,.72,1)","(.58,.64,.72,1)").replace('sc.cycles.samples=24','sc.cycles.samples=24')
 template=template.replace("sc.cycles.use_denoising=True","sc.cycles.use_denoising=False")
 template=template.replace("    mats[key]=m;return m","""    if path.endswith('freeport-facades.jpg'):
        img=bpy.data.images.load(str(Path(path).with_name('freeport-normal.jpg')),check_existing=True);img.colorspace_settings.name='Non-Color'
        tx=n.new('ShaderNodeTexImage');tx.image=img;nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.40
        links.new(tx.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    mats[key]=m;return m""")
 template=template.replace("ob.matrix_world=basis@Matrix(row['t'])","ob.matrix_world=basis@Matrix(row['t']);ob['guid']=row.get('guid','');ob['level']=row.get('level',0);ob['high']=row.get('high',0);ob['ground']=row['name'].startswith(('Lobo | 3-inch','Vanta Customs Yard | 48','Vanta Customs Yard | Working','Vanta Customs Yard | Freeport','Vanta Customs Yard | held')) or ('ground' in row['name'].lower() and not row.get('guid'))")
 template=template.replace("for name,eye,look,scale,w,h in views:",'''subjects={'dispatch':'7a2103','sealworks':'da0dca','rail':'7a2101','cold':'7a2106','desk':'7a2103','lab':'da0dca','fridge':'7a2106','library':'7a2184'}
for name,eye,look,scale,w,h,mode in views:
    camera.clip_start=2.03 if mode=='inside' else .09
    for ob in sc.collection.objects:
        if ob.type!='MESH':continue
        if mode=='closed': ob.hide_render=bool(ob['guid'] and ob['high']!=ob['level'])
        else:ob.hide_render=not(ob['guid']==subjects[name] and ob['level']==(1 if mode=='inside' else ob['high']) or ob['ground'])''')
 (W/'blender.py').write_text(template)
if __name__=='__main__':prepare()
