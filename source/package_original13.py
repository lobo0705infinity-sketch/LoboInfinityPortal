"""Integrate regenerated models, matching terrain grids, and native bag layouts."""
from pathlib import Path
import base64,copy,hashlib,json,math,re,shutil,sys
import lz4.block
import numpy as np
from shapely.geometry import box,Polygon,Point,MultiPoint
from shapely import affinity
from audit_assets import ROOT,DATA,bags,walk,meta
ASSETS=ROOT/'original13-assets'
OUT=ROOT/'release-r12'
URLROOT='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'+(sys.argv[1] if len(sys.argv)>1 else 'PENDING')+'/original13/'
MAN=json.loads((ROOT/'asset-manifest.json').read_text())
MODELS=json.loads((ROOT/'original13-models.json').read_text());INST=json.loads((ROOT/'original13-instances.json').read_text())
def compact(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'))
def states(o):return [o,*o.get('States',{}).values()]
def descendants(o):
 for x in o.get('ContainedObjects',[]):yield x;yield from descendants(x)
def isunit(o):return any(t in o.get('Tags',[]) for t in ['LoboUnit','LoboCommander'])
def unpack(b):
 n=meta(b)
 return json.loads(lz4.block.decompress(base64.b64decode(n['r28_packed_layout']),uncompressed_size=n['r28_layout_length']))
def pack(b,l):
 n=meta(b);raw=compact(l).encode();n['r28_packed_layout']=base64.b64encode(lz4.block.compress(raw,store_size=False)).decode();n['r28_layout_length']=len(raw);b['GMNotes']=compact(n)
def vertices(o):
 p=Path(MAN[o['CustomMesh']['MeshURL']]);return np.array([[float(q) for q in l.split()[1:4]] for l in p.read_text().splitlines() if l.startswith('v ')])
class Surface:
 def __init__(self,g):self.g=g;self.H=np.array(g['heights']).reshape(g['nz']+1,g['nx']+1)
 def height(self,x,z):
  g=self.g;gx=np.clip((x-g['x0'])/g['stepX'],0,g['nx']-1e-8);gz=np.clip((z-g['z0'])/g['stepZ'],0,g['nz']-1e-8);ix=int(gx);iz=int(gz);u=gx-ix;v=gz-iz;a,b,c,d=self.H[iz,ix],self.H[iz,ix+1],self.H[iz+1,ix],self.H[iz+1,ix+1]
  return float(a*(1-v)+c*(v-u)+d*u if v>=u else a*(1-u)+d*v+b*(u-v))
 def footprint(self,t,command=False):
  p=Point(0,0).buffer(1,resolution=32) if command else box(-1.5,-1.5,1.5,1.5)
  p=affinity.scale(p,t['scaleX'],t['scaleZ'],origin=(0,0));return affinity.translate(affinity.rotate(p,-t['rotY'],origin=(0,0)),t['posX'],t['posZ'])
 def seat(self,t,command=False):
  x,z,yaw=t['posX'],t['posZ'],t['rotY'];g=self.g;r=1 if command else 1.5;dx,dz=r*t['scaleX']*.7,r*t['scaleZ']*.7
  a=(self.height(x+dx,z)-self.height(x-dx,z))/(2*dx);b=(self.height(x,z+dz)-self.height(x,z-dz))/(2*dz)
  normal=np.array([-a,1,-b]);normal/=np.linalg.norm(normal);angle=math.radians(yaw);fx,fz=math.sin(angle),math.cos(angle);za=np.array([fx,a*fx+b*fz,fz]);za/=np.linalg.norm(za);xa=np.cross(normal,za)
  base=[(math.cos(i*math.pi/32)/math.cos(math.pi/64),math.sin(i*math.pi/32)/math.cos(math.pi/64)) for i in range(64)] if command else [(-1.5,-1.5),(1.5,-1.5),(1.5,1.5),(-1.5,1.5)]
  p=Polygon([(x+xa[0]*u*t['scaleX']+za[0]*v*t['scaleZ'],z+xa[2]*u*t['scaleX']+za[2]*v*t['scaleZ']) for u,v in base]);minx,minz,maxx,maxz=p.bounds
  ix0=max(0,int(math.floor((minx-g['x0'])/g['stepX'])));ix1=min(g['nx']-1,int(math.floor((maxx-g['x0'])/g['stepX'])));iz0=max(0,int(math.floor((minz-g['z0'])/g['stepZ'])));iz1=min(g['nz']-1,int(math.floor((maxz-g['z0'])/g['stepZ'])))
  det=xa[0]*za[2]-za[0]*xa[2];highest=-1e9;samples=[]
  for iz in range(iz0,iz1+1):
   for ix in range(ix0,ix1+1):
    def v(i,j):return (g['x0']+i*g['stepX'],g['z0']+j*g['stepZ'])
    aa,bb,cc,dd=v(ix,iz),v(ix+1,iz),v(ix,iz+1),v(ix+1,iz+1)
    for tri in [(aa,bb,dd),(aa,dd,cc)]:
     clip=p.intersection(Polygon(tri))
     if clip.is_empty:continue
     coords=list(clip.exterior.coords) if clip.geom_type=='Polygon' else list(clip.coords) if hasattr(clip,'coords') else []
     for xx,zz in coords:
      lx=((xx-x)*za[2]-(zz-z)*za[0])/det;lz=((zz-z)*xa[0]-(xx-x)*xa[2])/det;offset=xa[1]*lx+za[1]*lz;support=self.height(xx,zz)-offset;highest=max(highest,support);samples.append((xx,zz,offset))
  assert highest>-1e8
  clearance=.012;t['posY']=highest+clearance;t['rotX']=math.degrees(math.asin(-za[1]));t['rotZ']=math.degrees(math.atan2(xa[1],normal[1]))
  gaps=[t['posY']+off-self.height(xx,zz) for xx,zz,off in samples]
  return {'min_ground_clearance':min(gaps),'max_ground_clearance':max(gaps)}

def ground_mesh(o,s):
 old=vertices(o);xs=sorted(set(np.round(old[:,0],6)));zs=sorted(set(np.round(old[:,2],6)));g=s.g
 # Recover the authored patch bounds, then export the shared surface grid with
 # X reflected once for native TTS import. UVs retain the original map location.
 ix0=round((xs[0]-g['x0'])/g['stepX']);ix1=round((xs[-1]-g['x0'])/g['stepX']);iz0=round((zs[0]-g['z0'])/g['stepZ']);iz1=round((zs[-1]-g['z0'])/g['stepZ'])
 lines=['# Original 13 R12: imported terrain and runtime grid are identical'];uv=[]
 for iz in range(iz0,iz1+1):
  for ix in range(ix0,ix1+1):
   x=g['x0']+ix*g['stepX'];z=g['z0']+iz*g['stepZ'];lines.append('v %.8f %.8f %.8f'%(-x,s.H[iz,ix],z));uv.append('vt %.8f %.8f'%(ix/g['nx'],1-iz/g['nz']))
 lines+=uv;cols=ix1-ix0+1
 for j in range(iz1-iz0):
  for i in range(ix1-ix0):
   a=j*cols+i+1;b=a+1;c=a+cols;d=c+1
   lines+=['f '+' '.join(f'{k}/{k}' for k in tri) for tri in [(a,b,d),(a,d,c)]]
 data='\n'.join(lines)+'\n';name='ground-'+hashlib.sha256(data.encode()).hexdigest()[:16]+'.obj';(ASSETS/name).write_text(data)
 o['CustomMesh']['MeshURL']=o['CustomMesh']['ColliderURL']=URLROOT+name;o['CustomMesh']['Convex']=False
 # Compare old rendered native-X positions against the authored world grid.
 top=old[old[:,1]>-.02];error=max(abs(v[1]-s.height(-v[0],v[2])) for v in top)
 n=meta(o)
 if n.get('r23Surface'):n['r23Surface']['clearance']=.012
 n['grounding_revision']='R12 shared native-X mesh and height grid';o['GMNotes']=compact(n)
 return {'guid':o['GUID'],'mesh':name,'previous_max_height_mismatch':error,'new_max_height_mismatch':0.0}

def unit_models(o):
 v=MODELS[INST[o['GUID']]];n=v['metadata'];oldstates=o.get('States',{});newstates={}
 for i,filename in enumerate(v['meshes']):
  st=o if i==0 else copy.deepcopy(oldstates.get(str(i+1),{k:v for k,v in o.items() if k!='States'}))
  st.pop('States',None) if i else None
  note=meta(st);note.update({k:x for k,x in n.items() if k not in ['command','mounted','beast','quality_letter']});status=('Normal','Wounded')[i] if n['command'] else ('Full','Disordered','Shaken')[i]
  note.update({'status':status,'unit_condition':status,'unit_condition_label':status,'unit_state':i+1,'status_state':i+1,'label_revision':'Megiddo layout / Original 13 R12','art_revision':'Original 13 R12 retained audit artwork','full_figures':n['figures'],'standing_figures':v['checks'][i]['standing'],'fallen_figures':v['checks'][i]['fallen']})
  if n['command']:note['commander_name']=n['name']
  li=note.setdefault('label_identity',{});li.update({'name':n['name'],'army':n.get('army'),'quality':n['quality_letter'],'type':f"{n['formation']} {n['unit_class']} · {n['troop_type']}",'state':i+1,'commander':n['command'],'cv_foot':n.get('cv_foot'),'cv_mounted':n.get('cv_mounted'),'cb':n.get('combat_bonus'),'md':n.get('missile_defense')})
  st['GMNotes']=compact(note);st['Nickname']=n['name']+' | '+status
  st['CustomMesh'].update({'MeshURL':URLROOT+filename,'DiffuseURL':URLROOT+v['texture'],'Convex':True,'MaterialIndex':3,'TypeIndex':1,'CastShadows':False})
  st['Tags']=list(dict.fromkeys(st.get('Tags',[])+['LoboTerrainGrounding']));st['Transform']=copy.deepcopy(o['Transform']);st['Rigidbody']={'Mass':1,'Drag':10,'AngularDrag':1000,'UseGravity':False};st['Gravity']=False
  if i:newstates[str(i+1)]=st
 o['States']=newstates

def sync_layout(b):
 l=unpack(b)
 for o in b['ContainedObjects']:
  slot=l['_guidSlots'][o['GUID']];p=l[slot];t=o['Transform'];p['position']=[t['posX'],t['posY'],t['posZ']];p['rotation']=[t['rotX'],t['rotY'],t['rotZ']];p['scale']=[t['scaleX'],t['scaleY'],t['scaleZ']];p['name']=o.get('Nickname','')
  if 'CustomMesh' in o:
   cm=o['CustomMesh'];p.setdefault('assets',{}).update({'mesh':cm.get('MeshURL',''),'texture':cm.get('DiffuseURL',''),'collider':cm.get('ColliderURL','')})
 pack(b,l)

def scenery_footprint(o):
 v=vertices(o);t=o['Transform'];x=-v[:,0]*t['scaleX'];z=v[:,2]*t['scaleZ'];ang=math.radians(t['rotY']);xx=x*math.cos(ang)+z*math.sin(ang)+t['posX'];zz=-x*math.sin(ang)+z*math.cos(ang)+t['posZ'];return MultiPoint(np.column_stack([xx,zz])).convex_hull,v

def mirror_baked_water(o):
 cm=o['CustomMesh'];source=Path(MAN[cm['MeshURL']]).read_text().splitlines();lines=[]
 for line in source:
  bits=line.split()
  if bits and bits[0]=='v':bits[1]=str(-float(bits[1]));line=' '.join(bits)
  elif bits and bits[0]=='vn':bits[1]=str(-float(bits[1]));line=' '.join(bits)
  elif bits and bits[0]=='f':line='f '+' '.join(reversed(bits[1:]))
  lines.append(line)
 data='\n'.join(lines)+'\n';fn='water-'+hashlib.sha256(data.encode()).hexdigest()[:16]+'.obj';(ASSETS/fn).write_text(data);cm['MeshURL']=URLROOT+fn
 if cm.get('ColliderURL'):cm['ColliderURL']=URLROOT+fn

def main():
 D=json.loads(DATA.read_text());reports=[]
 for b in bags(D):
  l=unpack(b)
  for o in b['ContainedObjects']:
   p=l[l['_guidSlots'][o['GUID']]];t=o['Transform']
   for field,names in [('position',['posX','posY','posZ']),('rotation',['rotX','rotY','rotZ']),('scale',['scaleX','scaleY','scaleZ'])]:
    if field in p:t.update(dict(zip(names,p[field])))
  objects=list(descendants(b));ground=[o for o in b['ContainedObjects'] if 'LoboGroundMesh' in o.get('Tags',[])];g=next(meta(o)['r23Surface'] for o in ground if meta(o).get('r23Surface'));g['clearance']=.012;s=Surface(g)
  rep={'battle':b['Nickname'],'guid':b['GUID'],'terrain':[ground_mesh(o,s) for o in ground],'units':[],'scenery':[],'reserve':[],'base_collisions':[]}
  units=[o for o in objects if isunit(o)];footprints=[]
  for o in units:
   cmd='LoboCommander' in o.get('Tags',[]);seat=s.seat(o['Transform'],cmd);unit_models(o);rep['units'].append({'guid':o['GUID'],'name':o['Nickname'],**seat});footprints.append((o,s.footprint(o['Transform'],cmd)))
  for i,(o,p) in enumerate(footprints):
   for other,q in footprints[:i]:
    if p.intersection(q).area>.001:rep['base_collisions'].append([o['GUID'],other['GUID']])
   assert box(-48,-36,48,36).buffer(.01).covers(p),(b['Nickname'],o['Nickname'],'out of board')
  # Correct root/wheel grounding and clear low scenery away from deployed bases.
  for o in b['ContainedObjects']:
   if isunit(o) or 'LoboGroundMesh' in o.get('Tags',[]) or 'CustomMesh' not in o:continue
   name=o.get('Nickname','').lower();t=o['Transform'];p,v=scenery_footprint(o);oldpos=[t['posX'],t['posY'],t['posZ']]
   area='battlefield area' in name;water='river' in name or 'water' in name
   if water:mirror_baked_water(o)
   if not area and not water:
    if any(p.intersects(q.buffer(.04)) for _,q in footprints):
     moved=False
     for distance in np.arange(.5,10.1,.5):
      for angle in np.arange(0,2*math.pi,math.pi/12):
       dx,dz=distance*math.cos(angle),distance*math.sin(angle);q=affinity.translate(p,dx,dz)
       if box(-48,-36,48,36).covers(q) and all(not q.intersects(u.buffer(.06)) for _,u in footprints):
        t['posX']+=dx;t['posZ']+=dz;p=q;moved=True;break
      if moved:break
     assert moved,(b['Nickname'],name,'scenery collision')
    ymin=v[:,1].min();bottom=v[v[:,1]<=ymin+.04];yaw=math.radians(t['rotY']);heights=[]
    for vx,vy,vz in bottom:
     lx=-vx*t['scaleX'];lz=vz*t['scaleZ'];wx=t['posX']+lx*math.cos(yaw)+lz*math.sin(yaw);wz=t['posZ']-lx*math.sin(yaw)+lz*math.cos(yaw);heights.append(s.height(wx,wz)-vy*t['scaleY'])
    t['posY']=max(heights)+.004
   elif area:
    # Flat area markers remain shallow, with the centre matching the sculpted
    # terrain. They are visual boundaries, not raised physical platforms.
    t['posY']=s.height(t['posX'],t['posZ'])+.006
   for st in o.get('States',{}).values():st['Transform']=copy.deepcopy(t)
   rep['scenery'].append({'guid':o['GUID'],'name':o.get('Nickname'),'old_position':oldpos,'new_position':[t['posX'],t['posY'],t['posZ']]})
  for reserve in [o for o in b['ContainedObjects'] if 'LoboCraterusReserve' in o.get('Tags',[])]:
   positions=meta(reserve)
   for i,o in enumerate(reserve['ContainedObjects'],1):
    t=o['Transform'];pose=[t['posX'],t['posY'],t['posZ']];positions[o['GUID']]=positions[str(i)]=pose;rep['reserve'].append({'guid':o['GUID'],'position':pose,'states':1+len(o.get('States',{}))})
   reserve['GMNotes']=compact(positions)
  sync_layout(b);reports.append(rep);print('Integrated',b['Nickname'],'stands',len(units),'base collisions',len(rep['base_collisions']),flush=True)
 # All updated units use the same exact mesh/grid grounding after drop/state.
 D['SaveName']='Clash of Empires - Full Collection R12 - Original 13 Audit'
 D['Description']='Original 13 battles rebuilt to corrected Megiddo label and mesh standards. Includes alternate layouts and Hydaspes turn-two reserves. Offline geometry and deployment validation included; live TTS validation pending.'
 OUT.mkdir(exist_ok=True);shutil.copytree(ROOT/'release-r11',OUT,dirs_exist_ok=True)
 (OUT/DATA.name).write_text(json.dumps(D,ensure_ascii=False,indent=2))
 (ROOT/'original13-battle-audit.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
 print('Saved',OUT/DATA.name,flush=True)
if __name__=='__main__':main()
