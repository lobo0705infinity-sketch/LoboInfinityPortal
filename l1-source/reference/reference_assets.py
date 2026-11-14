from pathlib import Path
import json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

class Mesh:
    def __init__(self):self.v=[];self.uv=[];self.f=[]
    def poly(self,points,uv):
        i=len(self.v)+1;self.v.extend(points);self.uv.extend(uv)
        for j in range(1,len(points)-1):self.f.append((i,i+j,i+j+1))
    def quad(self,p,uv):self.poly(p,uv)
    def write(self,path):
        lines=['# Bannockburn R1 - TTS inches, native model coordinates']
        lines += ['v %.5f %.5f %.5f'%tuple(v) for v in self.v]
        lines += ['vt %.7f %.7f'%tuple(v) for v in self.uv]
        lines += ['f '+' '.join('%d/%d'%(i,i) for i in f) for f in self.f]
        path.write_text('\n'.join(lines)+'\n')
    def box(self,x0,x1,y0,y1,z0,z1,uv):
        for ps in [[(x0,y1,z0),(x0,y1,z1),(x1,y1,z1),(x1,y1,z0)],[(x0,y0,z1),(x0,y0,z0),(x1,y0,z0),(x1,y0,z1)],[(x0,y0,z0),(x0,y1,z0),(x1,y1,z0),(x1,y0,z0)],[(x1,y0,z1),(x1,y1,z1),(x0,y1,z1),(x0,y0,z1)],[(x0,y0,z1),(x0,y1,z1),(x0,y1,z0),(x0,y0,z0)],[(x1,y0,z0),(x1,y1,z0),(x1,y1,z1),(x1,y0,z1)]]:self.quad(ps,uv)

def uvrect(x0,y0,x1,y1):return [(x0/2048,1-y1/2048),(x0/2048,1-y0/2048),(x1/2048,1-y0/2048),(x1/2048,1-y1/2048)]

PROFILES={
 'scots-spears':dict(label='SCOTTISH SCHILTRONS',type='Rigid Heavy Spear',stats='CV 5/4   CB +2 A   MD 1',quality='R',count=12,head=[350,342,355,1090,1090,1110],body=1.32,split=768),
 'scots-light':dict(label='SCOTTISH LIGHT FOOT',type='Flexible Light Foot',stats='CV 3/2   CB +2 B   MD 0',quality='R',count=6,head=[30]*6,body=1.32),
 'scots-horse':dict(label="KEITH'S LIGHT HORSE",type='Flexible Light Cavalry Spear',stats='CV 3/3   CB +1 C   MD 1',quality='V',count=6,head=[70,55,70,580,580,580],body=1.64),
 'english-knights':dict(label='ENGLISH KNIGHTS',type='Flexible Medium Cavalry Lance',stats='CV 4/4   CB +2 C   MD 0',quality='V',count=8,head=[355,370,365,1055,1065,1065],body=1.64,split=820),
 'english-foot':dict(label='ENGLISH FOOT',type='Rigid Heavy Spear',stats='CV 5/4   CB +2 A   MD 1',quality='R',count=12,head=[110,100,60,615,595,560],body=1.32),
 'english-bows':dict(label='ENGLISH LONGBOWMEN',type='Flexible Light Bow',stats='CV 2/2   CB none   MD 0',quality='R',count=6,head=[110,80,95,580,580,565],body=1.32),
 'scots-command':dict(label='ARMY COMMANDER',type='Scottish mounted command',stats='Three mounted figures',quality='AC',count=3,head=[30,90,55,540,580,570],body=1.58,command=True),
 'english-command':dict(label='ARMY COMMANDER',type='English mounted command',stats='Three mounted figures',quality='AC',count=3,head=[35,75,30,550,575,540],body=1.58,command=True),
}

def atlas(name,profile,wing=False):
    source=Image.open(ASSETS/(name+'-source.png')).convert('RGBA')
    a=Image.new('RGBA',(2048,2048),(52,38,24,255));a.paste(source,(0,0))
    d=ImageDraw.Draw(a)
    color=(34,72,151) if name.startswith('scots') else (174,32,37)
    d.rectangle((0,1536,2047,1791),fill=color)
    quality='WC' if wing else profile['quality']
    label='WING COMMANDER' if wing else profile['label']
    d.text((34,1570),quality,font=ImageFont.truetype(BOLD,100),fill='white')
    d.line((250,1560,250,1770),fill='white',width=4)
    d.text((285,1552),label,font=ImageFont.truetype(BOLD,55),fill='white')
    d.text((285,1622),profile['type'],font=ImageFont.truetype(FONT,43),fill='white')
    d.text((285,1690),'Two mounted figures' if wing else profile['stats'],font=ImageFont.truetype(FONT,40),fill='white')
    g=Image.open(ASSETS/'ground-source.png').convert('RGB').resize((2048,256),Image.Resampling.LANCZOS)
    a.paste(g,(0,1792))
    # Native geometry uses these swatches for edge faces and complete pole details.
    d=ImageDraw.Draw(a)
    for i,c in enumerate([(59,42,27),(117,82,44),(180,184,176),(31,42,27)]):d.rectangle((1920+i*32,2016,1951+i*32,2047),fill=c)
    filename=name+('-wing' if wing else '')+'.png';a.save(ASSETS/filename,optimize=True)
    return source,filename

def base(m,round_base=False):
    top=uvrect(50,1800,1870,2008);side=uvrect(1922,2018,1940,2030);label=uvrect(0,1536,2048,1792)
    if not round_base:
        m.box(-1.5,1.5,0,.15,-1.5,1.5,side)
        m.quad([(-1.5,.151,-1.5),(-1.5,.151,1.5),(1.5,.151,1.5),(1.5,.151,-1.5)],top)
        m.quad([(-1.49,.005,1.501),(1.49,.005,1.501),(1.49,.145,1.501),(-1.49,.145,1.501)],[label[3],label[0],label[1],label[2]])
    else:
        N=48
        for i in range(N):
            a=i*2*math.pi/N;b=(i+1)*2*math.pi/N
            p=(math.cos(a),math.sin(a));q=(math.cos(b),math.sin(b))
            uv=lambda x,z:((x+1)/2*.88+.02,1-(1800+(z+1)/2*208)/2048)
            m.poly([(0,.15,0),(q[0],.15,q[1]),(p[0],.15,p[1])],[uv(0,0),uv(*q),uv(*p)])
            m.quad([(p[0],0,p[1]),(p[0],.15,p[1]),(q[0],.15,q[1]),(q[0],0,q[1])],side)
            m.poly([(0,0,0),(p[0],0,p[1]),(q[0],0,q[1])],[side[0]]*3)
        # Chord plaque remains inside the 2-inch circle.
        m.quad([(-.68,.005,.72),(.68,.005,.72),(.68,.15,.72),(-.68,.15,.72)],[label[3],label[0],label[1],label[2]])

def sprite_info(im,profile):
    a=np.asarray(im)[:,:,3];w,h=im.size;split=profile.get('split',h//2);out=[]
    for row,(y0,y1) in enumerate([(0,split),(split,h)]):
        for col in range(3):
            x0=round(col*w/3);x1=round((col+1)*w/3)
            mask=a[y0:y1,x0:x1]>105
            yy,xx=np.where(mask)
            assert len(xx)
            bx0=x0+int(xx.min());bx1=x0+int(xx.max())+1;by0=y0+int(yy.min());by1=y0+int(yy.max())+1
            head=profile['head'][row*3+col]
            if row and head<split:head+=split
            scale=profile['body']/max(1,by1-head)
            out.append(dict(box=(bx0,by0,bx1,by1),scale=scale,cell=(x0,y0,x1,y1)))
    # Match corresponding front and rear body scale; never distort aspect ratio.
    return out

def add_sprite(m,im,info,cx,cz,back=False,fallen=False,angle=0,max_radius=None):
    a=np.asarray(im)[:,:,3];x0,y0,x1,y1=info['box'];scale=info['scale']
    mid=(x0+x1)/2
    # If pose weapons are wide, preserve its shape while using a smaller whole figure.
    if max_radius is None:scale=min(scale,2.96/(x1-x0))
    angle=math.radians(angle);ca,sa=math.cos(angle),math.sin(angle)
    def transform(px,py):
        x=(px-mid)*scale
        if back:x=-x
        height=(y1-py)*scale
        if fallen:
            z=height-(y1-y0)*scale/2
            return (cx+x*ca-z*sa,.172+(.006 if back else 0),cz+x*sa+z*ca)
        return (cx+x,.16+height,cz+(.012 if back else -.012))
    # Raster-to-native silhouette tessellation. Pixels are copied without alteration.
    step=4 if im.height<=1100 else 5
    for py in range(y0,y1,step):
        py1=min(py+step,y1)
        cols=np.any(a[py:py1,x0:x1]>105,axis=0)
        edges=np.diff(np.r_[False,cols,False].astype(np.int8));starts=np.where(edges==1)[0];ends=np.where(edges==-1)[0]
        for start,end in zip(starts,ends):
            px=x0+start;px1=x0+end
            points=[transform(px,py1),transform(px,py),transform(px1,py),transform(px1,py1)]
            uv=uvrect(px,py,px1,py1)
            # Front faces toward local -Z. The rear is separately authored artwork.
            # Mirroring X above already reverses winding for the rear surface.
            m.quad(points,uv)

def build_figures():
    result={}
    for name,p in PROFILES.items():
        im,tex=atlas(name,p);info=sprite_info(im,p)
        variants=[False,True] if p.get('command') else [False]
        for wing in variants:
            if wing:_,tex=atlas(name,p,True)
            key=name+('-wing' if wing else '')
            count=2 if wing else p['count']
            command=p.get('command',False)
            if command:positions=[(-.42,-.17),(.42,-.17),(0,.35)][:count]
            elif count==12:positions=[(x,z) for z in [-.90,0,.90] for x in [-.93,-.31,.31,.93]]
            elif count==8:positions=[(x,z) for z in [-.65,.65] for x in [-.98,-.326,.326,.98]]
            else:positions=[(x,z) for z in [-.68,.68] for x in [-.92,0,.92]]
            files=[]
            for state in range(3):
                m=Mesh();base(m,command)
                lost=0 if state==0 else (max(1,round(count*.25)) if state==1 else round(count*.5))
                for i,(x,z) in enumerate(positions):
                    pose=(i%2)+1 if wing else (i%3)
                    fr=info[pose].copy();bk=info[pose+3].copy()
                    # Preserve approved body height, fit each complete silhouette horizontally.
                    width=max((v['box'][2]-v['box'][0])*v['scale'] for v in [fr,bk])
                    limit=(2*math.sqrt(max(.01,.98**2-z*z))-2*abs(x)) if command else 2*(1.48-abs(x))
                    factor=min(1,limit/width)
                    fr['scale']*=factor;bk['scale']*=factor
                    if i>=count-lost:
                        # Full-sized fallen artwork, laid diagonally within the base.
                        angle=25+(i%3)*62
                        for v in [fr,bk]:
                            w=(v['box'][2]-v['box'][0])*v['scale'];h=(v['box'][3]-v['box'][1])*v['scale']
                            bound=max(abs(math.cos(math.radians(angle)))*w+abs(math.sin(math.radians(angle)))*h,abs(math.sin(math.radians(angle)))*w+abs(math.cos(math.radians(angle)))*h)
                            v['scale']*=min(1,(1.70 if command else 2.65)/bound)
                        # Separate elevations prevent coplanar casualty surfaces.
                        start=len(m.v)
                        add_sprite(m,im,fr,0,0,fallen=True,angle=angle)
                        for vi in range(start,len(m.v)):
                            vx,vy,vz=m.v[vi];m.v[vi]=(vx,vy+.009*(i-(count-lost)),vz)
                    else:
                        add_sprite(m,im,fr,x,z)
                        add_sprite(m,im,bk,x,z,back=True)
                path=ASSETS/(key+'-'+str(state)+'.obj');m.write(path)
                vs=np.array(m.v);assert vs[:,0].min()>=-1.501 and vs[:,0].max()<=1.501
                assert vs[:,2].min()>=-1.502 and vs[:,2].max()<=1.502
                if command:assert np.max(np.hypot(vs[:,0],vs[:,2]))<1.001
                assert len(m.v)<25000,(key,len(m.v))
                files.append(path.name)
            result[key]={'meshes':files,'texture':tex,'figures':count,'command':command}
            print(key,'built',flush=True)
    for shape in ['square','round']:
        m=Mesh()
        if shape=='square':m.box(-1.5,1.5,0,.15,-1.5,1.5,[(0,0)]*4)
        else:base(m,True)
        m.write(ASSETS/('stand-'+shape+'.obj'))
    (ROOT/'figure-manifest.json').write_text(json.dumps(result,indent=2))

def south(x):return -24+2.6*np.sin((x+22)/17)+1.2*np.sin(x/7)
def north(x):return 25+2.0*np.sin(x/19)-1.1*np.cos(x/8)

def terrain_height(x,z):
    x=np.asarray(x);z=np.asarray(z)
    ridge=1.10/(1+np.exp((x+20)/4.8))
    y=.30+ridge+.09*np.sin(x/8)*np.cos(z/11)
    for center,width in [(south(x),1.6),(north(x),1.3)]:
        channel=np.exp(-((z-center)/width)**4)
        y=y*(1-channel)+.07*channel
    return y

def build_terrain():
    # The material is authored from the same terrain functions as geometry and rules.
    w,h=3072,2304
    x=np.linspace(-48,48,w,dtype=np.float32)[None,:];z=np.linspace(36,-36,h,dtype=np.float32)[:,None]
    g=np.asarray(Image.open(ASSETS/'ground-source.png').convert('RGB').resize((768,768)),dtype=np.float32)
    yi=np.arange(h)%768;xi=np.arange(w)%768
    color=g[yi[:,None],xi[None,:],:]
    rng=np.random.default_rng(1314)
    noise=rng.normal(0,1,(h,w)).astype(np.float32)
    patch=.94+.07*np.sin(x/5+np.sin(z/6))+.04*np.cos(z/3.2)
    color*=patch[:,:,None]
    # Low wet ground is localized, leaving firm ground for the main engagement.
    wet=np.clip((x-23)/20,0,1)*(np.exp(-((z-17)/8)**2)+np.exp(-((z+16)/8)**2))*.66
    color=color*(1-wet[:,:,None])+np.array([74,70,42])*wet[:,:,None]
    stream=np.zeros((h,w),dtype=np.float32)
    for center,width in [(south(x),1.12),(north(x),.90)]:
        d=np.abs(z-center)
        bank=np.exp(-((d-width)/.85)**2)*.72
        color=color*(1-bank[:,:,None])+np.array([94,82,57])*bank[:,:,None]
        water=np.clip((width-d)*7,0,1);stream=np.maximum(stream,water)
    ripples=(np.sin(x*17+z*24)*1.5+noise*.8)
    watercol=np.stack(np.broadcast_arrays(51+ripples,73+ripples,69+ripples),axis=2)
    color=color*(1-stream[:,:,None])+watercol*stream[:,:,None]
    # Two broad shallow fords, native geometry remains shallow and continuous.
    for fx,center in [(28,south(x)),(26,north(x))]:
        ford=np.clip((2.4-np.abs(x-fx))*2,0,1)*np.clip((2.3-np.abs(z-center))*2,0,1)*.8
        color=color*(1-ford[:,:,None])+np.array([116,108,80])*ford[:,:,None]
    # Worn approach track in the English rear, outside the initial formations.
    pathx=32+1.8*np.sin(z/10)
    track=np.exp(-((x-pathx)/.7)**4)*.40*(1-stream)
    color=color*(1-track[:,:,None])+np.array([136,119,83])*track[:,:,None]
    color+=noise[:,:,None]*1.2
    Image.fromarray(np.uint8(np.clip(color,0,255))).save(ASSETS/'field.jpg',quality=94)
    m=Mesh();NX=96;NZ=72
    for iz in range(NZ+1):
        zz=-36+iz
        for ix in range(NX+1):
            xx=-48+ix;m.v.append((xx,float(terrain_height(xx,zz)),zz));m.uv.append((ix/NX,iz/NZ))
    for iz in range(NZ):
        for ix in range(NX):
            a=iz*(NX+1)+ix+1;b=a+1;c=a+NX+1;d=c+1
            m.f.extend([(a,c,b),(b,c,d)])
    m.write(ASSETS/'field.obj')
    # Roots and tree groups are one small native mesh at each woodland patch.
    woods=Mesh();random.seed(1314)
    grassuv=uvrect(100,1810,1850,1990);bark=uvrect(1922,2018,1940,2030);leaf=uvrect(2018,2018,2030,2030)
    for i in range(19):
        xx=random.uniform(-5.5,5.5);zz=random.uniform(-4.0,4.0);hh=random.uniform(2.4,4.5)
        woods.box(xx-.11,xx+.11,0,hh*.76,zz-.11,zz+.11,bark)
        for j in range(4):
            cy=hh*.73+random.uniform(-.25,.35);rad=random.uniform(.65,1.1)
            cx=xx+random.uniform(-.65,.65);cz=zz+random.uniform(-.65,.65)
            # Irregular broadleaf crowns, with four overlapping rounded lobes.
            def point(lat,lon):
                return (cx+rad*math.sin(lat)*math.cos(lon),cy+rad*math.cos(lat),cz+rad*math.sin(lat)*math.sin(lon))
            for lat in range(4):
                for lon in range(7):
                    a=lat*math.pi/4;b=(lat+1)*math.pi/4;c=lon*2*math.pi/7;d=(lon+1)*2*math.pi/7
                    u=random.randrange(100,1450);v=random.randrange(1800,1880)
                    woods.quad([point(a,c),point(b,c),point(b,d),point(a,d)],uvrect(u,v,u+220,v+100))
    woods.write(ASSETS/'woodland.obj')
    print('terrain built',len(m.f),'triangles',flush=True)

if __name__=='__main__':
    build_figures()
    build_terrain()
