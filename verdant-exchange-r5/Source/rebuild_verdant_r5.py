import json,pathlib,copy,math,re,random
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import MultiPoint,box,Point
from shapely import affinity

R=pathlib.Path(__file__).parent;D=R/'verdant-r5-preserved';A=D/'Assets';A.mkdir(parents=True,exist_ok=True)
source=json.loads((R/'verdant-source.json').read_bytes())['ObjectStates'][0];bag=copy.deepcopy(source)
old={}
for l in source['LuaScript'].splitlines():
 m=re.match('--([a-f0-9]{6}),(.+)',l)
 if m:old[m[1]]=[float(v) for v in m[2].split(',')]
places=copy.deepcopy(old);tag='LoboMap:VerdantExchangeR1GeneralFinal';gid=0xe94000
def allocate():
 global gid
 gid+=1;return f'{gid:06x}'
def states(o):
 yield o
 for st in o.get('States',{}).values():yield from states(st)
def place(o,x,z,yaw):
 for st in states(o):
  p=places[st['GUID']];p[0]=x;p[2]=z;p[4]=yaw;st['Transform']['rotY']=yaw
def clone(o,name,x,z,yaw):
 o=copy.deepcopy(o)
 for st in states(o):
  original=st['GUID'];st['GUID']=allocate();places[st['GUID']]=copy.deepcopy(old.get(original,[0,1,0,0,0,0]));st['Nickname']=name+(' | '+st['Nickname'].split(' | ',1)[1] if ' | ' in st['Nickname'] else '')
 place(o,x,z,yaw);return o

# Preserve the approved mat, buildings, textures, interior detail, colliders and states.
# Remove the two peripheral open propagation houses and both long bridges.
remove_prefix=['Western Propagation House','Eastern Propagation House','Covered service walkway']
removed=[o for o in bag['ContainedObjects'] if any(o['Nickname'].startswith(p) for p in remove_prefix)]
bag['ContainedObjects']=[o for o in bag['ContainedObjects'] if o not in removed]
for o in removed:
 for st in states(o):places.pop(st['GUID'],None)
layout={
 'Botanical Genetics Laboratory':(-18,-17,0),
 'Research Administration':(18.5,16.5,90),
 'Tropical Conservatory':(3.5,-18,0),
 'Temperate Conservatory':(-3,18.25,90),
 'Uplink Data Exchange':(-5,-5,45),
 'Signal Analysis Laboratory':(6,8.5,0),
 'Seed Vault':(-19,-3,90),
 'Specimen Archive':(-18,15,0),
 'Nutrient Control':(-11,20,90),
 'Irrigation Control':(18,4,90),
 'Southern Service Annex':(18,-20,0),
 'Northern Service Annex':(20,-9,90),
}
role_names={'Botanical Genetics Laboratory':'Genetics Research','Research Administration':'Cold-Chain Dispatch','Seed Vault':'Seed Library','Specimen Archive':'Botanical Health Clinic','Nutrient Control':'Public Seed Exchange','Irrigation Control':'Receiving and Biosecurity','Southern Service Annex':'Utility Dispatch','Northern Service Annex':'Water Services'}
building=[];protected=[]
def verts(o):
 p=R/'verdant-assets'/o['CustomMesh']['MeshURL'].split('/')[-1]
 return np.array([[float(v) for v in l.split()[1:4]] for l in p.read_text().splitlines() if l.startswith('v ')])
for o in bag['ContainedObjects']:
 original=o['Nickname'].split(' | ')[0]
 if original not in layout:continue
 if 'Removable roof glazing' not in o['Nickname']:place(o,*layout[original])
 protected.append(o['GUID'])
 if 'Ground floor exposed' in o['Nickname']:
  v=verts(o);foot=MultiPoint(v[:,[0,2]]).convex_hull
  building.append({'guid':o['GUID'],'name':role_names.get(original,original),'x':layout[original][0],'z':layout[original][1],'yaw':layout[original][2],'levels':2 if 'Laboratory' in original and original=='Signal Analysis Laboratory' or original=='Uplink Data Exchange' else 1,'footprint':list(foot.exterior.coords)})
 if original in role_names:
  for st in states(o):st['Nickname']=st['Nickname'].replace(original,role_names[original])

# Three compact modules form differently shaped compounds using the approved assets.
index={o['GUID']:o for o in source['ContainedObjects']}
for guid,name,x,z,yaw in [('e80002','Propagation Clinic',-18,6,90),('e80028','Sample Accession',17,-3,90),('e8002e','Tissue Culture Laboratory',-5,-15,0)]:
 o=clone(index[guid],name,x,z,yaw);bag['ContainedObjects'].append(o);protected.append(o['GUID']);v=verts(o)
 building.append({'guid':o['GUID'],'name':name,'x':x,'z':z,'yaw':yaw,'levels':1,'footprint':list(MultiPoint(v[:,[0,2]]).convex_hull.exterior.coords)})

# Functional dressing uses the original detailed equipment and growing beds.
dressing=[o for o in bag['ContainedObjects'] if o['GUID'] in {v['GUID'] for v in source['ContainedObjects'][37:69]}]
preferences=[(-11,-9,0),(12,15,90),(-23,-17,90),(23,16,90),(-11,1,45),(11,7,0),(-1,4,45),(4,-3,0),(-12,-11,90),(-12,13,0),(12,-16,90),(10,-20,0),(-10,18,90),(-23,10,0),(23,-12,0),(-23,-8,0),(23,8,0),(1,-8,90),(-2,10,45),(-23,-23,0),(23,23,90),(-11,23,90),(11,-23,0),(-8,12,0),(10,-5,90),(-13,-23,0),(14,23,0),(-23,4,0),(23,0,0),(-13,8,90),(20,-13,90),(10,12,45)]
for o,pref in zip(dressing,preferences):place(o,*pref)
for i,(guid,name,x,z,yaw) in enumerate([('e80043','Boundary research garden',-23,18,0),('e80045','South garden barrier',-8,-23,90),('e80044','Dispatch green buffer',23,12,0),('e80036','Nutrient pressure vessels',13,-11,90),('e80038','Dispatch cold storage plant',19,11,90),('e8003a','Seed data storage',-12,-19,0),('e8003f','Biosecurity wash vessels',12,1,0),('e80047','Accession protective screen',2,-15,0),('e8003c','Northern nursery wind screen',7,20,90),('e80043','Signal research garden',3,7,0),('e8003a','Central seed data cabinet',-3,2.5,45)]):
 o=clone(index[guid],name,x,z,yaw);bag['ContainedObjects'].append(o);dressing.append(o)

# Reserve building footprints, then resolve equipment clashes without mirroring.
def footprint(o):
 v=verts(o);x,y,z,_,yaw,_=places[o['GUID']];c=math.cos(math.radians(yaw));s=math.sin(math.radians(yaw));v=v[:,[0,2]]@np.array([[c,-s],[s,c]])
 return affinity.translate(MultiPoint(v).convex_hull,xoff=x,yoff=z)
hard=[]
for rec in building:
 o=next(o for o in bag['ContainedObjects'] if o['GUID']==rec['guid']);p=footprint(o)
 assert box(-24,-24,24,24).covers(p),(rec['name'],p.bounds)
 for name,other in hard:assert p.intersection(other).area<.03,(rec['name'],name,p.intersection(other).area)
 hard.append((rec['name'],p))
placed=[];moves=[]
for o in sorted(dressing,key=lambda o:-footprint(o).area):
 pp=footprint(o);pref=places[o['GUID']][:]
 def fits(p):return box(-23.96,-23.96,23.96,23.96).covers(p) and all(p.distance(q)>.16 for _,q in hard) and all(p.distance(q)>.25 for _,q in placed) and all(p.distance(Point(0,z))>1.5 for z in [-12,0,12])
 found=None
 for dx,dz in sorted([(float(x),float(z)) for x in np.arange(-6,6.01,.25) for z in np.arange(-6,6.01,.25)],key=lambda p:p[0]**2+p[1]**2):
  test=affinity.translate(pp,xoff=dx,yoff=dz)
  if fits(test):found=(dx,dz,test);break
 assert found is not None,('No safe location',o['Nickname'])
 dx,dz,pp=found;place(o,pref[0]+dx,pref[2]+dz,pref[4]);placed.append((o['GUID'],pp))
 if dx or dz:moves.append({'name':o['Nickname'],'dx':dx,'dz':dz})

# Add mature specimen trees using their existing detailed hosted models and states.
for i,(kind,x,z,yaw) in enumerate([('01',-12,10,30),('03',-23,11,90),('01',-12,-9,170),('01',1,22,210),('03',12,11,310),('01',21,-14,80)]):
 o=copy.deepcopy(json.load(open(R/('tree-'+kind+'.json'))));o['GUID']=allocate();scale=(.43,.5,.43) if kind=='01' else (.38,.55,.38)
 for st in states(o):
  if st is not o:st['GUID']=allocate()
  st['CustomMesh']={k:(v.replace('steamusercontent-a.akamaihd.net','cdn.steamusercontent.com') if isinstance(v,str) else v) for k,v in st['CustomMesh'].items()};st['Tags']=['LoboCanopyTrees','VerdantExchange',tag];st['Transform'].update(scaleX=scale[0],scaleY=scale[1],scaleZ=scale[2],rotY=yaw);places[st['GUID']]=[x,1,z,0,yaw,0]
 o['Nickname']='Verdant specimen tree '+str(i+1);bag['ContainedObjects'].append(o)

# Compact flush-mounted printed signs; no new building meshes or frame structures.
base='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/REVISION/verdant-exchange-r5/Assets/'
def save_planes(name,planes):
 vs=[];uv=[];fs=[]
 for quad,tile,cols,rows in planes:
  n=len(vs);vs+=quad;u=tile%cols/cols;v=1-(tile//cols+1)/rows;e=.003;uv +=[(u+e,v+e),(u+1/cols-e,v+e),(u+1/cols-e,v+1/rows-e),(u+e,v+1/rows-e)];fs +=[(n,n+1,n+2),(n,n+2,n+3)]
 text=['# Verdant Exchange R5 | wall-mounted graphics']+['v %.6f %.6f %.6f'%v for v in vs]+['vt %.6f %.6f'%v for v in uv]+['f '+' '.join(f'{i+1}/{i+1}' for i in f) for f in fs];(A/(name+'.obj')).write_text('\n'.join(text)+'\n')
def addgraphic(name,file,texture):
 o=copy.deepcopy(source['ContainedObjects'][39]);o['GUID']=allocate();o['Nickname']=name;o['Tags']=['VerdantExchange',tag];o['States']={};o['CustomMesh'].update(MeshURL=base+file,DiffuseURL=texture,ColliderURL='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/627e1d0dcd8af3ef7c6771465b6cb53122054f0b/verdant-exchange-r2/Assets/decorative-collider.obj',Convex=False);o['Transform'].update(rotY=0,scaleX=1,scaleY=1,scaleZ=1);places[o['GUID']]=[0,1,0,0,0,0];bag['ContainedObjects'].append(o)
signs=[];labels=[]
for rec in building:
 if 'Conservatory' in rec['name']:continue
 o=next(o for o in bag['ContainedObjects'] if o['GUID']==rec['guid']);v=verts(o);maxz=float(v[:,2].max());half=round(maxz*2)/2
 # Source buildings have a solid lintel band from 2.75 to 3.25 inches.
 band=v[(v[:,1]>=2.7)&(v[:,1]<=3.26)&(abs(v[:,0])<=2)]
 front=float(band[:,2].min()) if len(band) else -half
 quad=[(.95,2.8,front-.012),(-.95,2.8,front-.012),(-.95,3.12,front-.012),(.95,3.12,front-.012)]
 c=math.cos(math.radians(rec['yaw']));s=math.sin(math.radians(rec['yaw']));quad=[(rec['x']+c*x+s*z,y,rec['z']-s*x+c*z) for x,y,z in quad]
 signs.append((quad,len(labels),4,4));labels.append(rec['name'].upper())
im=Image.new('RGB',(2048,1024),'#183e35');draw=ImageDraw.Draw(im);font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for i,label in enumerate(labels):
 x=i%4*512;y=i//4*256;draw.text((22+x,30+y),'VERDANT EXCHANGE',font=ImageFont.truetype(font,22),fill='#d4dfc8');size=30
 while draw.textlength(label,font=ImageFont.truetype(font,size))>465:size-=1
 draw.text((22+x,118+y),label,font=ImageFont.truetype(font,size),fill='#faf6e9')
im.save(A/'verdant-department-signs.png',optimize=True);save_planes('verdant-signs',signs);addgraphic('Verdant department signage | flush wall signs','verdant-signs.obj',base+'verdant-department-signs.png')
art=[]
gardens=[o for o in dressing if 'Grow cluster' in o['Nickname'] or 'garden' in o['Nickname'].lower()][:8]
for i,o in enumerate(gardens):
 v=verts(o);low=v[v[:,1]<=1.05];xmin,zmin=low[:,[0,2]].min(0);xmax,zmax=low[:,[0,2]].max(0);x,y,z,_,yaw,_=places[o['GUID']];c=math.cos(math.radians(yaw));s=math.sin(math.radians(yaw));zz=(zmin+zmax)/2
 quad=[(xmax+.012,.2,zz+.55),(xmax+.012,.2,zz-.55),(xmax+.012,.9,zz-.55),(xmax+.012,.9,zz+.55)];quad=[(x+c*a+s*d,y-1+b,z-s*a+c*d) for a,b,d in quad];art.append((quad,i%4,2,2))
save_planes('verdant-botanical-plaques',art);addgraphic('Botanical collection plaques | integrated into planting beds','verdant-botanical-plaques.obj','https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/627e1d0dcd8af3ef7c6771465b6cb53122054f0b/verdant-exchange-r2/Assets/botanical-art.jpg')

# Preserve the approved roof models and expose the established floor states.
for o in bag['ContainedObjects']:
 if not any(o['GUID']==r['guid'] for r in building) or not o.get('States'):continue
 st=o['States'];closed=copy.deepcopy(st[max(st,key=int)]);closed.pop('States',None);opened=copy.deepcopy(o);opened.pop('States',None);opened['GUID']=closed['GUID'];closed['GUID']=o['GUID'];closed['States']={'2':opened}
 if len(st)>1:closed['States']['3']=copy.deepcopy(st['2'])
 o.clear();o.update(closed)
bag['Nickname']='SET_ITS18 Uplink Center — Verdant Exchange — Detailed Campus R5';bag['Description']='Verdant Exchange R5 | Original approved mat and detailed assets retained.\nDistinct research garden and dispatch-service deployment zones. Dense functional cover, botanical plaques and department signs.\nDrop on Stage DROP BAGS HERE; clear with Stage CLEAR TABLE.';bag['LuaScript']='\r\n'.join('--'+g+','+','.join(f'{v:.7g}' for v in p) for g,p in places.items())+'\r\n'
assert bag['ContainedObjects'][0]['CustomMesh']==source['ContainedObjects'][0]['CustomMesh']
def atomic_json(path,data):
 text=json.dumps(data,indent=2);json.loads(text);tmp=path.with_suffix('.complete');tmp.write_text(text);tmp.replace(path)
atomic_json(D/'Verdant-Exchange-R5.json',{'ObjectStates':[bag]});atomic_json(D/'design-manifest.json',{'buildings':building,'placements':places,'dressing':len(dressing),'dressing_moves':moves,'approved_meshes_preserved':True,'original_mat_preserved':True})
print(json.dumps({'objects':len(bag['ContainedObjects']),'buildings':len(building),'dressing':len(dressing),'new_graphics_assets':3,'original_mat_preserved':True}))
