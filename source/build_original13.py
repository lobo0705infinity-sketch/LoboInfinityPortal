"""Rebuild original Clash of Empires figures from the retained audit artwork.

Geometry stays in native OBJ coordinates (TTS reflects X at import). Labels use
the proven Megiddo rear-panel vertices and UV order. Artwork is never reduced
to a geometry thumbnail; polygons are simplified independently of the texture.
"""
from pathlib import Path
import hashlib, json, math, re, sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageColor
from scipy.ndimage import label, distance_transform_edt, binary_closing
from shapely.geometry import box, Polygon
from shapely.ops import unary_union
from shapely import affinity
import mapbox_earcut
from audit_assets import DATA,ROOT,bags,walk,meta
sys.path.insert(0,str(ROOT/'release-r11/Build-notes/Megiddo-R3/source/reference'))
import geometry as G

OUT=ROOT/'original13-assets';OUT.mkdir(exist_ok=True)
ART=ROOT/'new-art';FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SHEETS={
 'greek':('Ancient Greek and Persian Infantry Atlas.png',4,4),
 'roman':('Roman and Germanic Warrior Sprite Atlas.png',4,4),
 'warriors':('Ancient Warriors Sprite Atlas.png',4,4),
 'extra':('Ancient infantry sprite atlas.png',4,2),
 'horse':('Ancient cavalry miniature atlas.png',4,4),
 'horse2':('Ancient Cavalry Miniature Sprite Atlas.png',4,4),
 'beast':('Ancient war elephants and chariots.png',2,4),
 'indian-elephant':('Twin Indian war elephants of Porus.png',2,1),
}
IMAGES={k:Image.open(ART/v[0]).convert('RGB') for k,v in SHEETS.items()}
SPRITES={};POLYS={}
def slug(s):return re.sub('[^a-z0-9]+','-',s.lower()).strip('-')
def selection(n,command=False):
 name=(n.get('name') or n.get('commander_name') or '').lower();army=(n.get('army') or '').lower();t=(n.get('troop_type') or '').lower();weapons=(n.get('weapons') or '').lower()
 mounted=command or any(x in name+' '+t for x in ['cavalry','horse','companions','mounted wing'])
 if 'elephant' in name+' '+t:
  return ('indian-elephant',0,0) if 'indian' in name else ('beast',1 if 'seleucid' in name or 'ptolemaic' in name else 0,0)
 if 'chariot' in name+' '+t:return ('beast',3 if 'scythed' in name else 2,0)
 if mounted:
  if 'cataphract' in name:return ('horse',3,2)
  if 'scythian' in name or 'horse archer' in t:return ('horse',2,0)
  if 'numidian' in name or 'masinissa' in name:return ('horse',2,2)
  if 'indian' in name or army=='india':return ('horse',1,2)
  if 'goth' in army or 'german' in army:return ('horse2',0,2)
  if 'eastern roman' in army:return ('horse2',0,0)
  if army=='roman column':return ('horse2',1,0)
  if army in ['rome','rome and pergamon','caesarian army','pompeian army'] and not any(x in name for x in ['pergamene','aetolian']):return ('horse',3,0)
  if 'carthage' in army:
   return ('horse2',2,2) if any(x in name for x in ['gallic','celtic','iberian']) else ('horse2',2,0)
  if army=='persia' or any(x in name for x in ['eastern','bactrian','arachosian','parapamisadan']):return ('horse2',3,2) if command else ('horse',1,0)
  if command:return ('horse2',3,0)
  return ('horse',0,0 if any(x in name for x in ['companion','agema','lance']) or 'lance' in weapons else 2)
 if 'bow' in name or 'archer' in name or 'bow' in weapons:
  if 'india' in army or 'indian' in name:return ('warriors',2,0)
  if army=='persia' or 'eastern foot' in name:return ('greek',3,2)
  if 'goth' in army or 'german' in army:return ('warriors',3,0)
  return ('greek',2,0)
 if 'sling' in name or 'sling' in weapons:return ('warriors',2,2)
 if 'goth' in army:return ('warriors',3,2)
 if 'german' in army:return ('roman',3,2)
 if army=='eastern roman empire':return ('roman',3,0)
 if army=='roman column':return ('extra',1,0) if 'auxiliary' in name else ('roman',2,2)
 if army in ['caesarian army','pompeian army']:return ('roman',2,0)
 if any(x in name for x in ['hastati','principes','triarii','velites','javelineers']) and army.startswith('rome'):
  return ('roman',1,2) if any(x in name for x in ['velites','javelineers']) else ('roman',1,0) if 'triarii' in name else ('roman',0,2) if 'principes' in name else ('roman',0,0)
 if 'phalanx' in name or 'pike' in name or 'silver shields' in name:return ('greek',0,0)
 if 'indian' in name:return ('warriors',1,2)
 if army=='persia':return ('greek',3,0)
 if 'numidian' in name:return ('extra',0,0)
 if 'arab' in name:return ('extra',0,2)
 if 'iberian' in name:return ('warriors',0,2)
 if any(x in name for x in ['celtic','gallic','galatian']):return ('warriors',1,0)
 if army=='carthage':return ('warriors',0,0)
 if any(x in name for x in ['triballian','illyrian','trallian']):return ('extra',1,0)
 if any(x in name for x in ['peltast','thracian','odrysian']):return ('greek',1,2)
 if any(x in name for x in ['agrianian','javelin','light','cretan']):return ('extra',1,2)
 if any(x in name for x in ['hypasp','agema']):return ('greek',1,0)
 return ('greek',0,2)

def source_sprite(sheet,row,col):
 key=(sheet,row,col)
 if key in SPRITES:return SPRITES[key]
 im=IMAGES[sheet];_,cols,rows=SHEETS[sheet];w,h=im.size
 a=np.asarray(im.crop((round(col*w/cols),round(row*h/rows),round((col+1)*w/cols),round((row+1)*h/rows))))
 mask=a.max(2)>14
 cc,_=label(mask);counts=np.bincount(cc.ravel());counts[0]=0;mask &= counts[cc]>=3
 yy,xx=np.where(mask);a=a[yy.min():yy.max()+1,xx.min():xx.max()+1].copy();mask=mask[yy.min():yy.max()+1,xx.min():xx.max()+1]
 # Find the broad head/body below an isolated vertical spear or pike.
 widths=mask.sum(1);broad=np.flatnonzero(widths>max(8,mask.shape[1]*.13));head=int(broad[0]) if len(broad) else 0
 # Preserve RGB of dark clothing inside the continuous exterior silhouette.
 mask=binary_closing(np.pad(mask,2),structure=np.ones((3,3)))[2:-2,2:-2]
 item=dict(rgb=a,mask=mask,head=head);SPRITES[key]=item;return item

def polygon(mask):
 key=hashlib.sha256(mask.tobytes()).hexdigest()
 if key in POLYS:return POLYS[key]
 runs=[]
 for y,row in enumerate(mask):
  ed=np.flatnonzero(np.diff(np.r_[False,row,False].astype(np.int8)))
  runs.extend(box(int(a),y,int(b),y+1) for a,b in zip(ed[::2],ed[1::2]))
 shape=unary_union(runs).simplify(.75,preserve_topology=True)
 result=[]
 for p in list(shape.geoms) if shape.geom_type=='MultiPolygon' else [shape]:
  if p.area<3:continue
  rings=[np.asarray(p.exterior.coords)[:-1]]+[np.asarray(h.coords)[:-1] for h in p.interiors if Polygon(h).area>5]
  points=np.concatenate(rings);tri=mapbox_earcut.triangulate_float64(points.astype(float),np.cumsum([len(r) for r in rings],dtype=np.uint32)).reshape(-1,3)
  result.append((points,tri))
 POLYS[key]=result;return result

def normalized(n,o):
 n=n.copy();li=n.get('label_identity',{});cmd='LoboCommander' in o.get('Tags',[])
 for key,other in [('name','name'),('quality','quality'),('cv_foot','cv_foot'),('cv_mounted','cv_mounted'),('combat_bonus','cb'),('missile_defense','md')]:
  if n.get(key) is None:n[key]=li.get(other)
 n['name']=n.get('commander_name') if cmd and n.get('commander_name') else n.get('name') or o.get('Nickname','').split('|')[0].strip()
 n['unit_class']=n.get('unit_class') or n.get('class') or 'Heavy';n['command']=cmd
 tt=n.get('troop_type') or '';full=' '.join([n['name'],tt]).lower()
 n['mounted']=cmd or any(x in full for x in ['cavalry','horse','companions','mounted wing','auxiliary horse'])
 n['beast']=any(x in full for x in ['elephant','chariot'])
 n['figures']=(3 if n.get('figures')==3 or 'army' in (n.get('role') or '').lower() or li.get('quality')=='AC' else 2) if cmd else 1 if n['beast'] else {'Heavy':12,'Medium':8,'Light':6,'Skirmish':4}[n['unit_class']]
 if n['mounted'] and not cmd and n['unit_class']=='Heavy':n['figures']=8
 n['quality']=(n.get('quality') or 'Regular');n['quality_letter']=n['quality'][0].upper()
 if n['quality_letter'] not in 'LRVE':n['quality_letter']='R'
 n['formation']=n.get('formation') or ('Unformed' if n['unit_class']=='Skirmish' else 'Flexible' if n['mounted'] or n['unit_class']=='Light' or n['beast'] else 'Rigid')
 n['troop_type']=tt or ('Cavalry' if n['mounted'] else 'Infantry')
 color=ImageColor.getrgb(n.get('army_label_color') or '#244DA8')
 if sum(c*w for c,w in zip(color,[.2126,.7152,.0722]))>145:color=tuple(round(c*.48) for c in color)
 n['army_label_color']='#%02x%02x%02x'%color
 return n

def texture(n,key,sprites):
 out=Image.new('RGB',(2048,2048),(45,34,24));d=ImageDraw.Draw(out);infos=[]
 for i,item in enumerate(sprites):
  a=item['rgb'];mask=item['mask'];h,w=mask.shape;x=30+(i%2)*970;y=20+(i//2)*740
  factor=min(1,940/w,700/h)
  if factor<1:
   a=np.array(Image.fromarray(a).resize((round(w*factor),round(h*factor)),Image.Resampling.LANCZOS));mask=np.array(Image.fromarray(mask).resize((a.shape[1],a.shape[0]),Image.Resampling.NEAREST));h,w=mask.shape
  idx=distance_transform_edt(~np.pad(mask,3),return_distances=False,return_indices=True);pad=np.pad(a,((3,3),(3,3),(0,0)));pad=pad[idx[0],idx[1]]
  out.paste(Image.fromarray(pad),(x-3,y-3));infos.append(dict(mask=mask,head=item['head']*factor,box=(x,y,x+w,y+h)))
 color=n.get('army_label_color') or '#244DA8';d.rectangle((0,1536,2047,1791),fill=color)
 def textfit(text,x,y,maxwidth,size,bold=False):
  while ImageFont.truetype(BOLD if bold else FONT,size).getlength(text)>maxwidth and size>16:size-=1
  d.text((x,y),text,font=ImageFont.truetype(BOLD if bold else FONT,size),fill='white')
 if n['command']:
  name=n['name'];size=70
  while ImageFont.truetype(BOLD,size).getlength(name)>780:size-=1
  d.text((408,1664),name,anchor='mm',font=ImageFont.truetype(BOLD,size),fill='white')
 else:
  d.text((132,1665),n['quality_letter'],anchor='mm',font=ImageFont.truetype(BOLD,112),fill='white');d.line((263,1555,263,1770),fill='white',width=3)
  typ=f"{n['formation']} {n['unit_class']} · {n['troop_type']}"
  stats=f"CV Foot {n.get('cv_foot',0)}   CV Mounted {n.get('cv_mounted',0)}   CB {n.get('combat_bonus') or '—'}   MD {n.get('missile_defense') or 0}"
  textfit(n['name'],300,1548,1710,68,True);textfit(typ,300,1630,1710,50);textfit(stats,300,1704,1710,43)
 ground=Image.open(ROOT/'release-r11/Build-notes/Megiddo-R3/source/ground.png').convert('RGB').resize((2048,256));out.paste(ground,(0,1792));d=ImageDraw.Draw(out)
 for i,c in enumerate([(78,51,31),(126,98,55),(170,170,165),(75,89,41)]):d.rectangle((1920+i*32,2016,1951+i*32,2047),fill=c)
 out.save(OUT/(key+'.jpg'),quality=94,subsampling=0)
 return infos

def sprite(m,info,x,z,height,width,fallen=False,angle=0):
 x0,y0,x1,y1=info['box'];h,w=info['mask'].shape;head=info['head'];sy=height/max(1,h-head);sx=min(sy,width/w)
 mask=info['mask'].copy()
 if fallen and head>0:mask[:max(0,int(head)-2)]=False
 c,s=math.cos(angle),math.sin(angle)
 def pt(px,py,back):
  lx=(px-w/2)*sx;yy=(h-py)*sy
  if fallen:
   zz=yy-height/2;return (-x-lx*c+zz*s,.173,z+lx*s+zz*c)
  return (-x+lx*(1 if back else -1),.151+yy,z+(-.014 if back else .014))
 for back in [False,True] if not fallen else [False]:
  for pts,tri in polygon(mask):
   off=len(m.v)+1;p=np.array([pt(a,b,back) for a,b in pts]);m.v.extend(map(tuple,p));m.uv.extend(((a+x0)/2048,1-(b+y0)/2048) for a,b in pts)
   desired=np.array([0,1,0] if fallen else [0,0,-1 if back else 1])
   for t in tri:
    q=p[t]
    if np.dot(np.cross(q[1]-q[0],q[2]-q[0]),desired)<0:t=t[::-1]
    m.f.append(tuple(int(k)+off for k in t))
 # Footprints are computed independently from placement, in tabletop X/Z.
 if fallen:
  shapes=[]
  for points,_ in polygon(mask):
   q=[(x+(a-w/2)*sx*c-((h-b)*sy-height/2)*s,z+(a-w/2)*sx*s+((h-b)*sy-height/2)*c) for a,b in points]
   shapes.append(Polygon(q).buffer(0))
  return unary_union(shapes).convex_hull
 return box(x-w*sx/2,z-.014,x+w*sx/2,z+.014)

def build_model(n,key):
 sheet,row,col=selection(n,n['command']);art=[source_sprite(sheet,row,col+i) for i in range(2)]
 if n['mounted']:
  army=(n.get('army') or '').lower()
  death=('greek',3,0) if army=='persia' else ('warriors',1,2) if army=='india' else ('warriors',3,2) if 'goth' in army or 'german' in army else ('roman',3,0) if 'eastern roman' in army else ('roman',0,0) if 'rome' in army or 'roman' in army or 'caesar' in army or 'pompe' in army else ('warriors',0,0) if army=='carthage' else ('greek',1,0)
  art.extend(source_sprite(death[0],death[1],death[2]+i) for i in range(2))
 infos=texture(n,key,art)
 total=n['figures'];checks=[];meshes=[];cmd=n['command'];beast=n['beast'];mounted=n['mounted']
 body=1.30 if not mounted and not beast else 1.65 if mounted else 2.35
 if cmd:body=1.05
 if cmd:positions=[(0,-.30),(0,.14),(0,.58)][:total];limit=1.40
 elif beast:positions=[(0,.20)];limit=2.78
 elif total==12:positions=[(x,z) for z in [1.20,.62,.04,-.54] for x in [-.99,0,.99]];limit=.94
 elif total==8 and mounted:positions=[(x,z) for z in [1.22,.64,.06,-.52] for x in [-.74,.74]];limit=1.40
 elif total==8:positions=[(x,z) for z in [1.0,-.4] for x in [-1.08,-.36,.36,1.08]];limit=.68
 elif total==6:positions=[(x,z) for z in [1.15,.3,-.55] for x in [-.72,.72]] if mounted else [(x,z) for z in [.96,-.45] for x in [-1.,0,1.]];limit=1.38 if mounted else .94
 else:positions=[(x,z) for z in [.92,-.42] for x in [-.73,.73]];limit=1.35
 # Preserve each sprite's aspect ratio; apply the same scale to both poses.
 scale=min(1,min(limit/(item['mask'].shape[1]*body/(item['mask'].shape[0]-item['head'])) for item in infos[:2]))
 if mounted or beast:body*=scale
 area=__import__('shapely').geometry.Point(0,0).buffer(.97) if cmd else box(-1.47,-1.075,1.47,1.47)
 for state in range(2 if cmd else 3):
  m=G.Mesh();G.base(m,cmd);occupied=[];lost=0 if not state or beast else 1 if cmd else max(1,round(total*[0,.25,.5][state]));living=total-lost
  living_positions=positions[:living]
  if state and not cmd and not beast:
   # Form the survivors in the front of the stand, leaving continuous ground
   # for fallen figures rather than laying casualties through standing ranks.
   cols=2 if mounted else 3 if total==12 else 4 if total==8 else 3 if total==6 else 2
   xs=np.linspace(-.74,.74,cols) if mounted else np.linspace(-1.08,1.08,cols) if cols==4 else np.linspace(-.96,.96,cols) if cols==3 else [-.73,.73]
   living_positions=[(float(xs[i%cols]),1.32-.20*(i//cols)) for i in range(living)]
  for i,(x,z) in enumerate(living_positions):
   footprint=sprite(m,infos[i%2],x,z,body,limit);occupied.append(footprint)
  if beast and state:
   # One model per base: alternate standing pose, then fallen pose.
   m=G.Mesh();G.base(m,cmd);occupied=[sprite(m,infos[1],0,.2,body,limit,fallen=state==2)]
   if state==2:living=0;lost=1
  fallen=[];plan=[]
  corpse_height=min(1.1,body) if mounted else body
  corpse_width=.62 if mounted else limit
  for fac in [1,.9,.8,.7,.6]:
   plan=[];reserved=list(occupied)
   for i in range(0 if beast else lost):
    info=infos[2+i%2] if mounted else infos[(living+i)%2];best=None
    for angle in [math.pi/2,math.pi*.65,math.pi*.35,0,math.pi]:
     dummy=G.Mesh();poly=sprite(dummy,info,0,0,corpse_height*fac,corpse_width*fac,True,angle)
     for z in np.arange(-.8,1.25,.14):
      for x in np.arange(-1.15,1.2,.14):
       p=affinity.translate(poly,x,yoff=z)
       if area.contains(p) and all(p.distance(q)>.022 for q in reserved):best=(x,z,fac,angle,p,info);break
      if best:break
     if best:break
    if best is None:break
    plan.append(best);reserved.append(best[4])
   if len(plan)==(0 if beast else lost):break
  if len(plan)!=(0 if beast else lost):raise RuntimeError(('No collision-free casualty layout',n['name'],state))
  for x,z,fac,angle,p,info in plan:
   sprite(m,info,x,z,corpse_height*fac,corpse_width*fac,True,angle);occupied.append(p);fallen.append({'x':float(x),'z':float(z),'scale':fac,'angle':angle})
  overlaps=[(i,j) for i,p in enumerate(occupied) for j,q in enumerate(occupied[:i]) if p.intersection(q).area>1e-7]
  outside=[i for i,p in enumerate(occupied) if not area.buffer(.008).covers(p)]
  if overlaps or outside:raise RuntimeError((key,state,overlaps,outside))
  filename=f'{key}-{state}.obj';m.write(OUT/filename);meshes.append(filename)
  checks.append({'mesh':filename,'figures':total,'standing':living,'fallen':lost,'vertices':len(m.v),'triangles':len(m.f),'overlap_count':len(overlaps),'out_of_base':len(outside),'casualty_placements':fallen})
 return {'key':key,'meshes':meshes,'texture':key+'.jpg','source':[sheet,row,col],'metadata':n,'checks':checks}

def main():
 D=json.loads(DATA.read_text());profiles={};instances={}
 for b in bags(D):
  for o in walk(b):
   if not o.get('States') or not any(t in o.get('Tags',[]) for t in ['LoboUnit','LoboCommander']):continue
   n=normalized(meta(o),o)
   identity={k:n.get(k) for k in ['name','army','quality_letter','formation','unit_class','troop_type','figures','cv_foot','cv_mounted','combat_bonus','missile_defense','command','army_label_color']}
   key=slug(n['name'])[:48]+'-'+hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()[:9]
   profiles[key]=n;instances[o['GUID']]=key
 manifest={}
 for i,(key,n) in enumerate(profiles.items(),1):
  manifest[key]=build_model(n,key)
  if i%10==0:print('Built',i,'/',len(profiles),flush=True)
 (ROOT/'original13-models.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 (ROOT/'original13-instances.json').write_text(json.dumps(instances,indent=2))
 print('Done',len(manifest),'identities;',len(instances),'stands',flush=True)
if __name__=='__main__':main()
