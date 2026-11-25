"""Corporate hull paint in the envelope UVs. Each broadside has independent reading direction."""
from pathlib import Path
import math
from typing import NamedTuple
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
import numpy as np
from scipy.ndimage import gaussian_filter
from rooftops import *
from district import direct_face
import airframes
from airframes import SHIPS,hullrect,signrect,matrect,boxuv
ART=ROOT/'art'
class Operator(NamedTuple):
    key:str
    owner:str
    headline:str
    service:str
    code:str
FLEET={
    'moored-aerostat':Operator('compass','Compass Transportation','COMPASS','TRANSPORTATION','CT / 41'),
    'aerostat-ferry':Operator('gojal','Gojal Safari Tours','GOJAL','SAFARI TOURS','GT / 08'),
    'aerostat-survey':Operator('vissiorama','VissioRama','VISSIORAMA','MAYA BROADCAST','VR / 17'),
    'aerostat-post':Operator('shangmei','Shangmei Products','SHANGMEI','PRODUCTS','SM / 24'),
    'aerostat-service':Operator('accesstel','AccessTel','AccessTel','COMM TECHNOLOGY','AT / 06')}
HW=['teal','zinc','charcoal','bronze','cream','ceramic','red','glass','yellow','louver','timber','route','black','bench','hazard','light']
PAINT={'compass':('#e3ded0','#222e39','#f18130'),'gojal':('#e8d5b7','#193e40','#bd7d43'),'vissiorama':('#21242b','#393e45','#a5f233'),'shangmei':('#e6e4dd','#293939','#eea337'),'accesstel':('#e9edef','#1f4745','#79aa42')}
def emblem_sources():
    # The sponsor cards show each mark against a metallic frame. Isolate the actual mark.
    dir=WORK/'fleet/originals'
    for name,src in [('compass','Compass1'),('gojal','Gojal'),('vissiorama','Vissiorama'),('shangmei','Shangmei'),('accesstel','Accesstel')]:
        im=Image.open(dir/(src+'.jpg')).convert('RGB');rgb=np.asarray(im).astype(float)
        yy,xx=np.mgrid[:im.height,:im.width];r,g,b=rgb.transpose(2,0,1)
        alpha=np.zeros((im.height,im.width),float)
        if name in ('compass','accesstel'):
            cx,cy,rad=(551,415,244) if name=='compass' else (552,418,240)
            alpha=np.clip(rad-np.sqrt((xx-cx)**2+(yy-cy)**2),0,1)
        elif name=='gojal':
            alpha=np.clip((122-np.max(rgb,axis=2))/80,0,1)*((xx>310)&(xx<790)&(yy>164)&(yy<513))
            # Retain the leaping animal; the owner name is set separately on the hull.
            alpha[(yy>476)&(xx<640)]=0
            rgb[:]=[32,53,51]
        elif name=='vissiorama':
            # The slanted solid footprint includes the original white letter cutouts.
            mask=Image.new('L',im.size);dr=ImageDraw.Draw(mask)
            dr.polygon([(389,178),(764,178),(630,603),(573,640),(523,651),(340,651)],fill=255)
            pol=np.asarray(mask)/255;green=np.clip((g-np.maximum(r,b)-15)/22,0,1)
            inside=((xx>392)&(xx<692)&(yy>228)&(yy<610))
            alpha=pol*np.maximum(green,inside*(np.min(rgb,axis=2)>223))
        else:
            bounds=(xx>270)&(xx<830)&(yy>164)&(yy<647)
            golden=(r-b>48)&(r-g>14)&(g>b+26)
            letters=(rgb.max(axis=2)<95)&(yy>346)&(yy<470)&(xx>418)&(xx<663)
            grey=(abs(r-b)<13)&(r>80)&(r<172)&(yy>175)&(yy<352)&(xx>632)&(xx<827)
            alpha=(bounds&(golden|letters|grey)).astype(float)
        rgba=Image.fromarray(np.uint8(np.dstack((np.clip(rgb,0,255),255*alpha))))
        cropped=rgba.crop(rgba.getbbox());cropped.thumbnail((500,500),Image.Resampling.LANCZOS);cropped.save(ART/(name+'.png'),optimize=True)

def font(path,size):return ImageFont.truetype(path,size)
SANS='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
SERIF='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
MONO='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
ITAL='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-BoldOblique.ttf'
def fit(draw,at,txt,size,width,col,face=SANS):
    ft=font(face,size)
    while ft.getlength(txt)>width:size-=2;ft=font(face,size)
    draw.text(at,txt,font=ft,fill=col,anchor='lm',stroke_width=0)
def painting(op,sign):
    key=op.key;w,h=2028,754;base,dark,accent=PAINT[key]
    im=Image.new('RGB',(w,h),base);d=ImageDraw.Draw(im)
    if key=='compass':
        d.polygon([(0,570),(790,540),(1500,513),(2028,245),(2028,754),(0,754)],fill=dark)
        for n in range(3):
            x=1498+n*134;d.polygon([(x,195),(x+57,182),(x+229,368),(x+35,544),(x-16,543),(x+126,366)],fill=accent)
        d.polygon([(0,546),(1200,511),(1565,478),(1528,498),(0,563)],fill=accent)
    elif key=='gojal':
        ad=Image.open(ART/'bourak-tour.jpg').convert('RGB').resize((1510,479),Image.Resampling.LANCZOS)
        # Fade the destination image directly into pearl fabric, preserving the animal on the broadside.
        yy,xx=np.mgrid[:479,:1510];a=np.minimum.reduce([np.clip(xx/190,0,1),np.clip((1509-xx)/190,0,1),np.clip(yy/90,0,1),np.clip((478-yy)/78,0,1)])
        im.paste(ad,(245,160),Image.fromarray(np.uint8(a*255)))
        d=ImageDraw.Draw(im);d.polygon([(0,662),(750,637),(1510,649),(2028,577),(2028,754),(0,754)],fill=dark)
    elif key=='vissiorama':
        for j in range(8):
            x=1380+99*j;d.polygon([(x+130,0),(x+173,0),(x-100,754),(x-148,754)],fill=accent if j in (3,4) else '#444f40')
        d.polygon([(0,566),(1240,552),(1204,577),(0,606)],fill='#818c83')
        for j in range(4):
            x=264+j*120;d.line([(x,186),(x+52,184)],fill='#819264',width=5)
    elif key=='shangmei':
        for j in range(3):
            x=1435+j*146;d.line([(x+74,83),(x-172,303),(x+91,544),(x+297,352)],fill=accent if j==1 else '#c0bfb4',width=34 if j==1 else 10)
        d.polygon([(0,555),(1041,595),(1665,582),(2028,492),(2028,754),(0,754)],fill=dark)
        d.line([(0,562),(1051,601),(1665,589),(2028,500)],fill=accent,width=10)
    else:
        d.polygon([(0,102),(420,178),(760,195),(1360,132),(2028,24),(2028,0),(0,0)],fill=dark)
        d.polygon([(0,594),(728,557),(1280,544),(1634,431),(2028,352),(2028,754),(0,754)],fill=dark)
        for j in range(5):
            y=320+j*35;xx=1430+j*34
            d.line([(2028,y-137),(xx+100,y-38),(xx,y+36),(xx-80,y+42)],fill=accent,width=6 if j%2 else 9)
            d.ellipse((xx-91,y+31,xx-69,y+53),fill=accent)
    # Geometry projection reverses the underlying hull pattern on the far broadside.
    # Painted names and the actual sponsor emblems always read left-to-right.
    if sign<0:
        if key=='gojal': # Keep the gazelle visible on the right and lettering on the left.
            pass
        else:im=ImageOps.mirror(im)
    d=ImageDraw.Draw(im);col='#e8eee3' if key=='vissiorama' else dark
    logo=Image.open(ART/(key+'.png')).convert('RGBA')
    if key=='gojal':
        logo.thumbnail((236,146),Image.Resampling.LANCZOS);im.paste(logo,(521,195),logo)
        fit(d,(484,375),op.headline,113,360,'#1c3833',SERIF);fit(d,(505,448),op.service,34,292,'#f7e5c8')
    else:
        logo.thumbnail((244,226),Image.Resampling.LANCZOS)
        x=498 if sign>0 else 620
        im.paste(logo,(x,375-logo.height//2),logo)
        fit(d,(x+logo.width+26,348),op.headline,112,670,col,ITAL if key=='vissiorama' else SANS)
        fit(d,(x+logo.width+32,437),op.service,41,526,accent if key=='vissiorama' else col)
    codecolor='#263c40' if key in ('compass','shangmei','accesstel','gojal') else '#c7d5ba'
    fit(d,(942,218),op.code,30,240,codecolor,MONO)
    # Bonded envelope seams and soft grime cross the paint, integrating the marks with the fabric.
    yy,xx=np.mgrid[:h,:w];u=(xx-w*.5)/(w*.5);v=(h*.5-yy)/(h*.5);cross=np.sqrt(np.maximum(.018,1-u*u))
    angle=np.arcsin(np.clip(v/cross,-1,1))
    shade=np.zeros((h,w),dtype=np.float32)
    for q in (-.89,-.76,-.62,-.46,-.29,-.105,.095,.293,.473,.639,.779,.896):
        dx=np.abs(u-q-.007*v*v);shade-=.079*np.exp(-(dx/.00185)**2);shade+=.031*np.exp(-((dx-.0042)/.0022)**2)
    dist=np.abs((angle+.11)%(np.pi/7)-np.pi/14)
    shade-=.052*np.exp(-(dist/.007)**2)
    rng=np.random.default_rng(148+list(PAINT).index(key));grain=rng.normal(0,1.15,(h,w));broad=gaussian_filter(rng.normal(0,1,(h//6,w//6)),3)
    noise=np.asarray(Image.fromarray(np.float32(broad/broad.std())).resize((w,h),Image.Resampling.BICUBIC))
    shade+=np.minimum(0,-.010*v*v)+.009*noise
    return Image.fromarray(np.uint8(np.clip(np.asarray(im)*(1+shade[:,:,None])+grain[:,:,None],0,255)))

PANELS=[(10,9,2028,754),(10,787,2028,754)]
def texture(op):
    atlas=Image.open(R3/'assets/airship-liveries.jpg').convert('RGB')
    for i,sign in enumerate((1,-1)):atlas.paste(painting(op,sign),PANELS[i][:2])
    # Fin material swatches continue each operator's colors over the stabilizer and rudder.
    d=ImageDraw.Draw(atlas);base,dark,accent=PAINT[op.key]
    d.rectangle((1769,1555,1887,1572),fill=dark);d.rectangle((1901,1555,2017,1572),fill=accent)
    atlas.save(ASSETS/('fleet-'+op.key+'.jpg'),quality=91,subsampling=0,optimize=True)

def fixed_color(kind):
    return (1825/2048,1-1564/2048) if kind==0 else (1956/2048,1-1564/2048)
def hull_uv(p,sign,cy,ry,rz):
    x,y,z=p;return boxuv(PANELS[0 if sign>0 else 1],.5+sign*z/(2*rz),.5+(y-cy)/(2*ry))
def with_paint(tri,cy,ry,rz):
    sign=1 if sum(p[0] for p,_,_ in tri)>=0 else -1
    return tuple((p,hull_uv(p,sign,cy,ry,rz),n) for p,u,n in tri)
def within(tri,r):
    x,y,w,h=r
    return all(x-1<2048*u<x+w+1 and y-1<2048*(1-v)<y+h+1 for _,(u,v),_ in tri)
def emitter(name,op):
    native.AS=ASSETS;m=native.Mesh();removed=0
    if name!='moored-aerostat':
        index=next(i for i,s in enumerate(SHIPS) if name=='aerostat-'+s['key']);ship=SHIPS[index]
        for tri in native.read_obj(R3/'assets'/(name+'.obj'))[0]:
            if within(tri,signrect(index)):removed+=1;continue
            if within(tri,hullrect(index)):tri=with_paint(tri,0,ship['ry'],ship['rz'])
            elif max(p[2] for p,u,n in tri)<-ship['rz']*.45:
                tri=tuple((p,fixed_color(1 if abs(n[2])>.65 else 0),n) for p,u,n in tri)
            m.faces.append(tri)
        assert removed==64,(name,removed)
    else:
        # Replace the older launch's faceted envelope and the three rectangular tail primitives.
        for tri in native.read_obj(AS2/(name+'.obj'))[0]:
            pts=np.array([p for p,u,n in tri]);u,v=np.mean([v for p,v,n in tri],axis=0)
            tile=int(u*4096/384)+8*int((1-v)*4096/384)
            if tile==27 or (tile==18 and (np.abs(np.sum(((pts-[0,2.1,0])/[1.14,1.28,3.5])**2,axis=1)-1).max()<.025 or pts[:,2].max()<-2)):continue
            tx,ty,ww,hh=native.RECT[tile];key=native.TILES[tile];dst=matrect('zinc' if key=='roofB' else key)
            m.faces.append(tuple((p,boxuv(dst,(uu*4096-tx)/ww,1-((1-vv)*4096-ty)/hh),n) for p,(uu,vv),n in tri))
        hull_points=[]
        def surface(i,j):
            lat=i*np.pi/32;rot=j*np.pi/24
            n=np.array([math.sin(lat)*math.cos(rot),math.sin(lat)*math.sin(rot),-math.cos(lat)])
            p=n*[1.14,1.28,3.5]+[0,2.1,0];no=n/[1.14,1.28,3.5];return p,no/np.linalg.norm(no)
        for i in range(32):
            for j in range(48):
                loc=[(i,j),(i,j+1),(i+1,j+1),(i+1,j)]
                if i==0:loc.pop(1)
                if i==31:loc.pop(2)
                vals=[surface(*n) for n in loc]
                for k in range(1,len(vals)-1):
                    m.faces.append(with_paint([(p,(0,0),n) for p,n in (vals[0],vals[k],vals[k+1])],2.1,1.28,3.5))
        for i in range(10):
            for j in range(12):hull_points.append(surface(i*32/9,j*4)[0])
        colliders=[hull_points]
        # Swept airfoils use genuine thickness, a rounded leading edge and a separate trailing rudder.
        for rad in (math.pi/2,.20,math.pi-.20):
            radial=np.array([math.cos(rad),math.sin(rad),0]);across=np.array([-math.sin(rad),math.cos(rad),0]);origin=np.array([0,2.1,0])
            rings=[]
            for height,lead,trail,thick in ((.28,-1.78,-3.23,.081),(.88,-2.32,-3.39,.066),(1.42,-3.08,-3.64,.041),(1.51,-3.25,-3.58,.028)):
                ring=[]
                for frac,offset in ((0,0),(.13,1),(.69,.71),(1,0),(.69,-.71),(.13,-1)):
                    ring.append(origin+radial*height+across*(thick*offset)+np.array([0,0,lead+(trail-lead)*frac]))
                rings.append(ring)
            center=np.mean(rings,axis=(0,1))
            def side(v,k):
                n=np.cross(v[1]-v[0],v[2]-v[0])
                if n@(np.mean(v,axis=0)-center)<0:v=v[::-1]
                direct_face(m,v,[fixed_color(k)]*len(v))
            for j in range(len(rings)-1):
                for k in range(6):side([rings[j][k],rings[j][(k+1)%6],rings[j+1][(k+1)%6],rings[j+1][k]],int(k in (2,3) or j==2))
            side(rings[0],0);side(rings[-1],1);colliders.append(np.array(rings).reshape(-1,3))
        for poly,lo,hi in native.read_obj(AS2/(name+'-col.obj'))[1][4:]:colliders.append([(x,h,z) for x,z in poly for h in (lo,hi)])
        airframes.NEW=ASSETS;airframes.bake_collider(name,colliders)
    m.save(name);texture(op)
if __name__=='__main__':
    if not all((ART/(op.key+'.png')).exists() for op in FLEET.values()):emblem_sources()
    for name,op in FLEET.items():emitter(name,op)
