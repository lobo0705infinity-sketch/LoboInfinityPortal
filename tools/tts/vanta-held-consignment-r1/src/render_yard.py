"""Render the actual saved meshes and Unity objective prefabs from the playtest."""
from yard import *
from layout import build
import UnityPy
def unity(o,t):
 url=o['CustomAssetbundle']['AssetbundleURL'];bundle=UnityPy.load(str(cache(url)));objects={r.path_id:r for r in bundle.objects}
 trs={};go_transform={};material={};filters=[]
 for pid,rec in objects.items():
  k=rec.type.name
  if k=='Transform':
   a=rec.read();m=np.eye(4);q=a.m_LocalRotation;sc=a.m_LocalScale;p=a.m_LocalPosition
   m[:3,:3]=Rotation.from_quat([q.x,q.y,q.z,q.w]).as_matrix()@np.diag([sc.x,sc.y,sc.z]);m[:3,3]=[p.x,p.y,p.z]
   trs[pid]=(a.m_Father.path_id,m);go_transform[a.m_GameObject.path_id]=pid
  elif k=='MeshFilter':
   a=rec.read();filters.append((a.m_GameObject.path_id,a.m_Mesh.path_id))
  elif k=='MeshRenderer':
   a=rec.read();material[a.m_GameObject.path_id]=a.m_Materials[0].path_id
 def apply(pid):
  p,m=trs[pid];return apply(p)@m if p else m
 result=[]
 for g,mesh_id in filters:
  mesh=objects[mesh_id].read();p=W/('native-'+str(abs(mesh_id))+'.obj')
  if not p.exists():p.write_text(mesh.export())
  mat=objects[material[g]].read();envs=mat.m_SavedProperties.m_TexEnvs
  tx=next((tex.m_Texture.path_id for k,tex in envs if k in ('_MainTex','_BaseMap') and tex.m_Texture.path_id),None)
  assert tx,mat.m_Name
  im=W/('native-'+str(abs(tx))+'.png')
  if not im.exists():objects[tx].read().image.save(im)
  result.append({'name':o['Nickname'],'mesh':str(p),'image':str(im),'t':(t@apply(go_transform[g])).tolist(),'rgba':[1,1,1,1],'glass':False})
 return result
def prepare():
 rows=[]
 def descend(o,parent):
  t=parent@matrix(o['Transform'])
  cm=o.get('CustomMesh',{})
  if cm.get('MeshURL'):
   col=o.get('ColorDiffuse',{});rows.append({'name':o['Nickname'],'mesh':str(cache(cm['MeshURL'])),'image':str(cache(cm['DiffuseURL'])) if cm.get('DiffuseURL') else '', 't':t.tolist(),'rgba':[col.get(k,1.)for k in ('r','g','b','a')],'glass':False})
  elif o.get('CustomAssetbundle'):rows.extend(unity(o,t))
  for c in o.get('ChildObjects',[]):descend(c,t)
 release=(W/'Play-Table.json')
 if release.exists():roots=[o for o in load(release)['ObjectStates']if TAG in o.get('Tags',[])]
 else:roots=build()['ContainedObjects']
 for o in roots:descend(o,np.eye(4))
 save(W/'render-scene.json',rows)
 s=(R/'src/blender_template.py').read_text()
 # Native TTS axes; four frames keep the actual apertures, materials and ground marks.
 views=[('overview',(-59,83,0),(0,4.9,0),55.4,1340,1090),('hold',(-.4,21,-3.7),(10.7,5,-15.2),17.1,1240,780),('intake',(-30,11,-7.9),(-20.0,4.9,-.2),9.1,1050,670),('release',(9.9,10.8,2.2),(8.55,4.8,-4.17),7.9,1050,670),('seal',(-20.68,7.53,-6.84),(-17.89,5.27,-9.23),3.95,1020,650)]
 s=s[:s.index('views=')]+'views='+repr(views)+'\n'+s[s.index("if '--'"):]
 s=s.replace('sc.cycles.samples=16','sc.cycles.samples=24')
 # Neutral industrial daylight approximates the day environment and shows grout, stencils and wheel detail.
 s=s.replace("(.29,.34,.40,1)","(.58,.64,.72,1)").replace("default_value=.58","default_value=.78")
 (W/'blender.py').write_text(s)
if __name__=='__main__':prepare()
