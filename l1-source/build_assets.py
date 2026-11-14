from pathlib import Path
import sys, json, math, copy
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import label, distance_transform_edt
ROOT=Path(__file__).resolve().parent; A=ROOT/'assets'
sys.path.insert(0,str(ROOT/'reference'))
import geometry as G
Mesh=G.Mesh; uv=G.uvrect
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
PROFILES={
 'lagash-guard':dict(label='SPEAR GUARD',quality='R',count=12,head=[235,235,240,845,845,845],body=1.32,stats='CV Foot 5   CV Mounted 4   CB +2 A   MD 1',type='Rigid Heavy · Spear'),
 'lagash-levy':dict(label='LEVY SPEARMEN',quality='R',count=12,head=[240,270,225,850,850,840],body=1.32,stats='CV Foot 5   CV Mounted 4   CB +2 A   MD 1',type='Rigid Heavy · Spear'),
 'umma-spears':dict(label='UMMA SPEARMEN',quality='R',count=12,head=[230,235,230,845,845,850],body=1.32,stats='CV Foot 5   CV Mounted 4   CB +2 A   MD 1',type='Rigid Heavy · Spear'),
 'umma-slingers':dict(label='SLINGERS',quality='R',count=4,head=[60,40,55,570,550,560],body=1.32,stats='CV Foot 1   CV Mounted 1   CB +2 B   MD 0',type='Unformed Skirmish · Sling'),
 'lagash-command':dict(label='EANNATUM',quality='AC',count=3,head=[355,370,375,1110,1140,1140],body=1.02,command=True),
 'umma-command':dict(label='USH',quality='AC',count=3,head=[320,340,350,1080,1090,1110],body=1.02,command=True),
}

def fit(text,width,size,bold=False):
 while ImageFont.truetype(BOLD if bold else FONT,size).getlength(text)>width:size-=1
 return ImageFont.truetype(BOLD if bold else FONT,size)

def atlas(source,key,side,label_text,quality,type_text='',stats='',command=False,state=0):
 im=Image.open(A/(source+'-source.png')).convert('RGBA')
 assert im.width<=2048 and im.height<=1536
 out=Image.new('RGBA',(2048,2048),(68,49,29,255));out.paste(im,(0,0))
 d=ImageDraw.Draw(out);color=(35,75,154) if side=='Lagash' else (159,42,33)
 d.rectangle((0,1536,2047,1791),fill=color)
 if command:
  d.text((22,1660),quality,font=fit(quality,160,86,True),anchor='lm',fill='white')
  d.line((190,1560,190,1768),fill='white',width=3)
  d.text((213,1614),label_text,font=fit(label_text,590,55,True),anchor='lm',fill='white')
  d.text((213,1692),type_text,font=fit(type_text,590,42),anchor='lm',fill='white')
 else:
  d.text((50,1604),quality,font=fit(quality,185,106,True),fill='white')
  d.line((265,1555,265,1773),fill='white',width=3)
  d.text((300,1550),label_text,font=fit(label_text,1710,67,True),fill='white')
  d.text((300,1631),type_text,font=fit(type_text,1710,49),fill='white')
  d.text((300,1703),stats,font=fit(stats,1710,42),fill='white')
 ground=Image.open(A/'ground-source.png').convert('RGB').resize((2048,256),Image.Resampling.LANCZOS)
 out.paste(ground,(0,1792));d=ImageDraw.Draw(out)
 for i,c in enumerate([(66,44,26),(128,90,47),(181,119,61),(79,94,43)]):d.rectangle((1920+i*32,2016,1951+i*32,2047),fill=c)
 out.save(A/(key+'.png'),compress_level=6)
 return im,key+'.png'

def extract(im,p):
 # Assign complete connected silhouettes, including detached spear tips, to
 # their owning figure. Never cut at an arbitrary grid-column boundary.
 infos=G.sprite_info(im,p)
 for i,v in enumerate(infos):v['mirror']=-1
 return infos

def add_fallen(m,im,info,i,command=False):
 # Preserve body and spear dimensions; only rotate in the base plane.
 # Fit along a diagonal on circular bases using a uniform source-scale choice.
 angle=[30,147,62,118,43,156][i%6]
 fr=copy.copy(info)
 w=(fr['box'][2]-fr['box'][0])*fr['scale'];h=(fr['box'][3]-fr['box'][1])*fr['scale']
 limit=1.70 if command else 2.75
 if command:
  fr['scale']*=min(1,limit/math.hypot(w,h))
 else:
  rad=math.radians(angle);bound=max(abs(math.cos(rad))*w+abs(math.sin(rad))*h,abs(math.sin(rad))*w+abs(math.cos(rad))*h)
  fr['scale']*=min(1,limit/bound)
 return G.sprite(m,im,fr,0,0,fallen=True,angle=angle,yoffset=.012*i)

def figures():
 manifest={};checks=[]
 for name,p in PROFILES.items():
  side='Lagash' if name.startswith('lagash') else 'Umma';cmd=p.get('command',False)
  variants=['army','left','right'] if cmd else ['troops']
  for variant in variants:
   wing=cmd and variant!='army';count=2 if wing else p['count'];key=name+('-'+variant if cmd else '')
   title=(side.upper()+' '+variant.upper()) if wing else p['label']
   role='Wing Commander' if wing else 'Army Commander'
   im,texture=atlas(name,key,side,title,'WC' if wing else p['quality'],role if cmd else p['type'],p.get('stats',''),cmd)
   info=extract(im,p)
   if cmd:
    positions=[(-.43,.08),(.43,.08)] if wing else [(0,.59),(-.43,.03),(.43,.03)]
    poses=[0,1] if wing else [0,1,2]
    lane=.78
   elif count==12:
    positions=[(x,z+(.065 if j%2 else -.065)) for z in [1.0,.12,-.78] for j,x in enumerate([-.93,-.31,.31,.93])];poses=[i%3 for i in range(12)];lane=1.10
   else:
    positions=[(-.73,.86),(.73,.86),(-.73,-.68),(.73,-.68)];poses=[0,1,2,0];lane=1.32
   # One scale factor across the family avoids tiny edge figures.
   factor=min(1,lane/max((v['box'][2]-v['box'][0])*v['scale'] for v in info))
   for v in info:v['scale']*=factor
   meshes=[];textures=[]
   for state in range(2 if cmd else 3):
    state_im=im;state_info=info;state_tex=texture
    if cmd and state==1:
     state_im,state_tex=atlas(name+'-wounded',key+'-wounded',side,title,'WC' if wing else 'AC',role,command=True)
     state_info=extract(state_im,p)
     for v in state_info:v['scale']*=factor
    textures.append(state_tex)
    m=Mesh();G.base(m,cmd);lost=0 if cmd or state==0 else max(1,round(count*[0,.25,.5][state]));boxes=[]
    for i,((x,z),pose) in enumerate(zip(positions,poses)):
     fr,bk=state_info[pose],state_info[pose+3]
     if i>=count-lost:add_fallen(m,im,fr,i-(count-lost),cmd)
     else:
      b1=G.sprite(m,state_im,fr,x,z);b2=G.sprite(m,state_im,bk,x,z,back=True)
      box=[np.minimum(b1[0],b2[0]).tolist(),np.maximum(b1[1],b2[1]).tolist()]
      boxes.append({'pose':pose,'box':box,'body_height':p['body']*factor,'total_height':box[1][1]-.16})
    for i,a in enumerate(boxes):
     for b in boxes[i+1:]:assert any(a['box'][1][k]+.025<b['box'][0][k] or b['box'][1][k]+.025<a['box'][0][k] for k in [0,2]),(key,state,'figure intersection')
    vs=np.array(m.v);assert np.max(abs(vs[:,[0,2]]))<=1.501
    if cmd:assert np.max(np.hypot(vs[:,0],vs[:,2]))<=1.001
    assert len(vs)<25000,(key,len(vs));filename=f'{key}-{state}.obj';m.write(A/filename);meshes.append(filename)
    checks.append({'model':filename,'vertices':len(vs),'standing':count-lost,'fallen':lost,'figures':boxes,'front_facing':'right','no_height_cap':True})
   manifest[key]={'meshes':meshes,'textures':textures,'figures':count,'command':cmd,'title':title,'role':role if cmd else '', 'source':name,'scale_factor':factor}
   print(key,'built',flush=True)
 # Exactly ONE cart per base. Variants give distinct poses across cart stands;
 # all damage states are complete purpose-generated carts, never fallen copies.
 sources=['cart-full','cart-disordered','cart-shaken']
 for side in ['Lagash','Umma']:
  for variant in range(3):
   key=side.lower()+f'-cart-{variant}';meshes=[];textures=[]
   for state,src in enumerate(sources):
    texkey=side.lower()+f'-cart-state-{state}'
    im,tex=atlas(src,texkey,side,'EARLY BATTLE CART','R','Battle Cart · One model','CV Foot 3   CV Mounted 2   CB +1 C*   MD 0')
    info=extract(im,{'body':1,'head':[0]*6})
    fr,bk=info[variant],info[variant+3]
    # Set scale by the cart/team width, independent of spear height.
    factor=2.72/max(v['box'][2]-v['box'][0] for v in [fr,bk])
    for v in [fr,bk]:v['scale']=factor
    m=Mesh();G.base(m);G.sprite(m,im,fr,0,.12);G.sprite(m,im,bk,0,.12,back=True)
    vs=np.array(m.v);assert np.max(abs(vs[:,[0,2]]))<=1.501
    fn=key+f'-{state}.obj';m.write(A/fn);meshes.append(fn);textures.append(tex)
    checks.append({'model':fn,'cart_models':1,'vertices':len(vs),'front_facing':'right','no_height_cap':True,'damage':['Full','Disordered','Shaken'][state]})
   manifest[key]={'meshes':meshes,'textures':textures,'figures':1,'command':False,'cart':True,'variant':variant}
 # Compact, solid base-only colliders; spear/figure artwork never collides.
 for shape in ['square','round']:
  m=Mesh()
  if shape=='square':m.box(-1.5,1.5,0,.15,-1.5,1.5,[(0,0)]*4)
  else:
   for i in range(48):
    a=i*math.pi/24;b=(i+1)*math.pi/24;p=(math.cos(a),math.sin(a));q=(math.cos(b),math.sin(b))
    m.poly([(0,.15,0),(q[0],.15,q[1]),(p[0],.15,p[1])],[(0,0)]*3)
    m.poly([(0,0,0),(p[0],0,p[1]),(q[0],0,q[1])],[(0,0)]*3)
    m.quad([(p[0],0,p[1]),(p[0],.15,p[1]),(q[0],.15,q[1]),(q[0],0,q[1])],[(0,0)]*4)
  m.write(A/f'stand-{shape}.obj')
 (ROOT/'figure-manifest.json').write_text(json.dumps(manifest,indent=2));(ROOT/'geometry-checks.json').write_text(json.dumps(checks,indent=2))

def canal_x(z,side):return side*(31+1.15*np.sin(z/13))
def terrain(x,z):
 x=np.asarray(x);z=np.asarray(z);h=.19+.025*np.sin(x/14)*np.cos(z/16)
 for side in [-1,1]:
  dist=abs(x-canal_x(z,side));cross=np.maximum(np.exp(-((z-8)/3.2)**8),np.exp(-((z+8)/3.2)**8));water=1-cross
  h=h+.31*np.exp(-((dist-2.15)/1.25)**2)-.25*np.exp(-(dist/.95)**4)*water
 return h

def terrain_assets():
 nx,nz=96,72;xx,zz=np.meshgrid(np.arange(-48,49),np.arange(-36,37));hh=np.round(terrain(xx,zz),5)
 grid={'nx':nx,'nz':nz,'x0':-48,'z0':-36,'stepX':1,'stepZ':1,'clearance':.012,'heights':hh.ravel().tolist()}
 lines=['# Lagash R1: native OBJ X is minus world X; A-D triangle diagonal']
 lines+=['v %.5f %.5f %.5f'%(-x,y,z) for x,y,z in zip(xx.ravel(),hh.ravel(),zz.ravel())]
 lines+=['vt %.7f %.7f'%((x+48)/96,(z+36)/72) for x,z in zip(xx.ravel(),zz.ravel())]
 for iz in range(nz):
  for ix in range(nx):
   a=iz*97+ix+1;b=a+1;c=a+97;d=c+1
   for f in [(a,b,d),(a,d,c)]:lines.append('f '+' '.join(f'{v}/{v}' for v in f))
 (A/'field.obj').write_text('\n'.join(lines)+'\n')
 (ROOT/'surface-grid.json').write_text(json.dumps(grid))
 # Exact texture registration follows the same analytic channel/crossing data.
 W,H=3072,2304
 tile=np.array(Image.open(A/'ground-source.png').convert('RGB').resize((768,768)),dtype=float)
 img=np.tile(tile,(3,4,1))[:H,:W]
 x,z=np.meshgrid(np.linspace(-48,48,W),np.linspace(36,-36,H))
 for side in [-1,1]:
  dist=abs(x-canal_x(z,side));cross=np.maximum(np.exp(-((z-8)/3.2)**8),np.exp(-((z+8)/3.2)**8));wet=(1-cross)*np.exp(-(dist/.77)**6)
  noise=(img.mean(2)-100)/28
  water=np.stack([52+noise*2,65+noise*3,52+noise*2],axis=2)
  img=img*(1-wet[...,None])+water*wet[...,None]
  bank=np.exp(-((dist-1.1)/.38)**2)*(1-cross)*.32
  img=img*(1-bank[...,None])+np.array([76,67,43])*bank[...,None]
  crossing=np.exp(-(dist/3.6)**8)*cross*.42
  img=img*(1-crossing[...,None])+np.array([172,146,105])*crossing[...,None]
 # Subtle cultivated strips away from the central deployment and combat area.
 crop=((abs(x)>36)&(abs(z)>12)).astype(float)*(.12+.1*(np.sin(z*5)>0))
 img=img*(1-crop[...,None])+np.array([114,116,64])*crop[...,None]
 Image.fromarray(np.uint8(np.clip(img,0,255))).save(A/'field.jpg',quality=94)
 # Scenic date-palm/reed groups use below-table colliders, roots buried slightly.
 # Their geometry is coordinate registered to the same ground, not a flat group.
 m=Mesh();roots=[];rng=np.random.default_rng(2450)
 brown=uv(1955,2020,1970,2030);green=uv(2018,2020,2035,2032)
 for side in [-1,1]:
  for z0 in [-26,25]:
   for i in range(5):
    x=side*(40+rng.uniform(-3,3));z=z0+rng.uniform(-4,4);y=float(terrain(x,z))-.025
    h=rng.uniform(2.2,3.1);r=.10
    # Mesh helper's coordinates are native; encode reflected X once.
    for j in range(8):
     a=j*math.pi/4;b=(j+1)*math.pi/4
     m.quad([(-(x+r*math.cos(a)),y,z+r*math.sin(a)),(-(x+r*math.cos(a)),y+h,z+r*math.sin(a)),(-(x+r*math.cos(b)),y+h,z+r*math.sin(b)),(-(x+r*math.cos(b)),y,z+r*math.sin(b))],brown)
    for j in range(9):
     a=j*2*math.pi/9;dx,dz=math.cos(a),math.sin(a);px,pz=-dz,dx
     points=[(-x,y+h+.12,z),(-(x+dx*.65+px*.23),y+h+.3,z+dz*.65+pz*.23),(-(x+dx*1.25),y+h-.3,z+dz*1.25),(-(x+dx*.65-px*.23),y+h+.3,z+dz*.65-pz*.23)]
     m.quad(points,green);m.quad(points[::-1],green[::-1])
    roots.append({'world_x':x,'world_z':z,'root_y':y,'ground_y':float(terrain(x,z))})
 m.write(A/'palms.obj');(ROOT/'tree-root-checks.json').write_text(json.dumps(roots,indent=2))

if __name__=='__main__':
 terrain_assets();figures()
