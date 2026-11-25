"""Project the actual tower footprints down to a photographic street layer and bake the playmat."""
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from shapely.geometry import Polygon
from rooftops import AS2,ASSETS,WORK,T,native

SIZE=3072
CAMERA=115.
DEPTH=76.
EYE=np.array([.55,-.85])
HAZE=np.array([160,178,188],dtype=np.float32)
ATLAS=Image.open(AS2/'civic-r2.jpg').convert('RGB')


def project(p,depth):
    return EYE+(np.asarray(p)-EYE)/(1.+depth/CAMERA)


def pixels(p):
    a=np.asarray(p)
    return np.stack(((a[...,0]+24)*SIZE/48,(24-a[...,1])*SIZE/48),axis=-1)


def polygon_points(coords,depth):
    return [tuple(v) for v in pixels(project(coords,depth))]


def tile(key):
    index=native.TILES.index(key) if key in native.TILES else key
    x,y,w,h=native.RECT[index]
    return np.array(ATLAS.crop((x,y,x+w,y+h)).resize((384,192),Image.Resampling.LANCZOS),dtype=np.float32)


@lru_cache(None)
def material(key):
    if key=='room2':
        return np.array(Image.open(ASSETS/'calibration-lab.jpg').resize((384,192),Image.Resampling.LANCZOS),dtype=np.float32)
    return tile(key)


def sample(key,u,v):
    tex=material(key)
    return tex[(np.mod(v,1)*tex.shape[0]).astype(np.int32),(np.mod(u,1)*tex.shape[1]).astype(np.int32)]


def bounds_scissor(poly):
    x0,y0=np.maximum(np.floor(poly.min(0)).astype(int),0)
    x1,y1=np.minimum(np.ceil(poly.max(0)).astype(int)+1,SIZE)
    if x0>=x1 or y0>=y1:return None
    px,pz=np.meshgrid((np.arange(x0,x1,dtype='f')+.5)*(48/SIZE)-24,24-(np.arange(y0,y1,dtype='f')+.5)*(48/SIZE))
    return np.s_[y0:y1,x0:x1],px,pz


def facade(color,depth_buffer,a,b,seed,wall,room):
    e=b-a;span=np.linalg.norm(e);e=e/span;normal=np.array([e[1],-e[0]])
    if np.dot(EYE-a,normal)<=0:return
    box=bounds_scissor(pixels(np.array([a,b,project(a,DEPTH),project(b,DEPTH)])))
    if box is None:return
    sl,x,z=box
    divisor=(x-EYE[0])*normal[0]+(z-EYE[1])*normal[1]
    t=np.divide(np.dot(a-EYE,normal),divisor,out=np.zeros_like(x),where=abs(divisor)>1e-8)
    d=(t-1)*CAMERA
    u=(EYE[0]+t*(x-EYE[0])-a[0])*e[0]+(EYE[1]+t*(z-EYE[1])-a[1])*e[1]
    mask=(d>=-.001)&(d<DEPTH)&(u>=0)&(u<=span)&(d<depth_buffer[sl])
    if not np.any(mask):return
    d=d[mask];u=u[mask]
    pitch=2.70+.10*(seed%4);floor=np.floor(d/pitch).astype(int);v=np.mod(d/pitch,1)
    bays=max(1,int(round(span/(1.63+.08*(seed%4)))))
    phase=np.mod(u*bays/span,1);bay=np.floor(u*bays/span)
    photo=sample('room'+str(room),u/(5.4+(seed%3)*.5)+.073*floor+(seed*.097)%1,v)
    variation=.5+.5*np.cos(floor*5.43+np.floor(bay/2)*7.051+seed)
    glass=photo*(.34+.22*variation[:,None])+np.array([15,30,34])
    glass+=np.array([11,16,19])*(.42+.58*np.cos(phase*3.14))[:,None]
    tint=[(.74,.87,.91),(.91,.88,.79),(.75,.84,.86),(.85,.88,.85)][seed%4]
    masonry=sample(wall,u/3.25,d/3.05)*np.array(tint)
    stone=(v>.72)|(v<.065)|(phase<.041)|(phase>.956)
    result=np.where(stone[:,None],masonry*.73+11,glass)
    # Vertical structural piers, individual transoms, projecting sill lips and expansion bands.
    major=np.mod(u/(span/max(1,bays//3)),1)
    pier=(major<.036)|(major>.964)
    result[pier]=masonry[pier]*.79
    result[(v>.704)&(v<.729)]*=.58
    result[(v>.729)&(v<.758)]*=1.34
    result[(phase<.018)&~pier]*=.57
    result[(v>.50)&(v<.516)&~pier]*=.71
    band=((floor+seed)%6==0)&(v>.61)
    result[band]=masonry[band]*.67
    result[band&(v>.82)&(v<.85)]*=.57
    light=.82+.22*np.dot(normal,[-.66,.75])
    result*=light
    haze=(.07+.51*(d/DEPTH)**.92)[:,None]
    result=result*(1-haze)+HAZE*haze
    color[sl][mask]=np.clip(result,0,255).astype('uint8');depth_buffer[sl][mask]=d


def cap(color,depth_buffer,coords,k):
    # This closed service deck sits exactly under the physical plinth. It never repeats the
    # playable roof or a bridge. It also makes the bare mat legible while setting up the table.
    mask_img=Image.new('1',(SIZE,SIZE));ImageDraw.Draw(mask_img).polygon(polygon_points(coords,0),fill=1)
    euv=pixels(coords);sc=bounds_scissor(euv)
    if sc is None:return
    sl,x,z=sc;mask=np.asarray(mask_img)[sl];u=x[mask];v=z[mask]
    patch=sample(['membrane','zinc','roofB','concrete'][k%4],u/5.3+k*.23,v/5.3+k*.16)
    cam=np.array([99,111,115]);tone=patch*.60+cam*.37
    ix=np.mod(u+11+k*.43,2.88);iz=np.mod(v+3-k*.61,3.86);seams=(ix<.030)|(iz<.028)
    tone[seams]*=.70
    tone[(ix>.031)&(ix<.058)]*=1.075
    color[sl][mask]=np.clip(tone,0,255).astype('uint8');depth_buffer[sl][mask]=0


def noise(side,seed):
    rng=np.random.default_rng(seed)
    im=Image.fromarray(rng.integers(0,255,(side,side),dtype=np.uint8)).resize((SIZE,SIZE),Image.Resampling.BICUBIC)
    return np.asarray(im,dtype='f')/255


def service_decks(image, footprints):
    photo=Image.open(WORK/'lower-city-plate.jpg').convert('RGB')
    outlines=[
        [(676,224),(729,213),(737,244),(684,257)],
        [(1140,681),(1171,675),(1191,748),(1157,754)],
        [(624,754),(678,747),(690,881),(632,888)],
        [(500,831),(583,814),(590,845),(552,849),(556,925),(531,936),(524,861),(504,868)],
        [(538,141),(560,132),(582,194),(557,204)],
        [(352,133),(370,129),(377,159),(359,161)],
    ]
    masks=[]
    for coords in outlines:
        shade=Image.new('L',photo.size);ImageDraw.Draw(shade).polygon(coords,fill=255)
        bb=shade.getbbox();cut=photo.crop(bb)
        cut.putalpha(shade.crop(bb).filter(ImageFilter.GaussianBlur(.65)));masks.append(cut)
    from shapely.geometry import Point
    for k,coords in enumerate(footprints):
        footprint=Polygon(coords);usable=footprint.buffer(-.85)
        rim=ImageDraw.Draw(image)
        for a,b in zip(coords,np.vstack((coords[1:],coords[:1]))):
            edge=b-a;edge=edge/np.linalg.norm(edge)
            lit=.5+.32*(edge[1]*-.66-edge[0]*.75)
            rim.line([tuple(q) for q in pixels((a,b))],fill=tuple(int(v*lit+32) for v in (119,130,130)),width=3)
        rng=np.random.default_rng(4192+k*43);placed=[];left,bottom,right,top=footprint.bounds
        for j in range(max(2,min(5,round(footprint.area/30)))):
            cut=masks[(k*5+j*7)%len(masks)].copy()
            w=round((1.1+.13*((k+2*j)%7))*SIZE/48)
            cut=cut.resize((w,max(20,round(w*cut.height/cut.width))),Image.Resampling.LANCZOS)
            cut=cut.rotate(int(rng.integers(0,4))*90,expand=True)
            for _ in range(45):
                x,z=rng.uniform(left,right),rng.uniform(bottom,top)
                pt=Point(x,z);radius=.52*max(cut.size)*48/SIZE
                if usable.covers(pt.buffer(radius)) and all(pt.distance(p)>r+radius+.25 for p,r in placed):break
            else:continue
            placed.append((pt,radius));px,py=pixels((x,z)).round().astype(int)
            corner=(px-cut.width//2,py-cut.height//2)
            shadow=cut.getchannel('A').filter(ImageFilter.GaussianBlur(3)).point(lambda x:round(x*.30))
            image.paste((32,40,43),(corner[0]+4,corner[1]+5,corner[0]+4+cut.width,corner[1]+5+cut.height),shadow)
            image.paste(cut.convert('RGB'),corner,cut.getchannel('A'))
    return image


def bake():
    plate=Image.open(WORK/'lower-city-plate.jpg').convert('RGB')
    plate=ImageOps.fit(plate,(SIZE,SIZE),method=Image.Resampling.LANCZOS)
    # A matching cast shadow at street depth grounds each tower in the lower district.
    footprints=[]
    for t in T.values():
        xz=np.array(list(t.poly.exterior.coords)[:-1])+[t.x,t.z]
        if not Polygon(xz).exterior.is_ccw:xz=xz[::-1]
        footprints.append(xz)
    shade=Image.new('L',(SIZE,SIZE));pen=ImageDraw.Draw(shade)
    for coords in footprints:
        ps=np.vstack([project(coords,DEPTH),project(coords+[6.1,-4.3],DEPTH)])
        hull=list(Polygon(ps).convex_hull.exterior.coords)
        pen.polygon([tuple(v) for v in pixels(hull)],fill=173)
    shadows=np.asarray(shade.filter(ImageFilter.GaussianBlur(10)),dtype='f')/255
    color=np.asarray(plate,dtype='f')*(.79-.19*shadows[...,None])+HAZE*.23
    color=np.clip(color,0,255).astype('uint8')
    depth=np.full((SIZE,SIZE),DEPTH,dtype='f')
    for i,(k,coords) in enumerate(zip(T,footprints)):
        for a,b in zip(coords,np.vstack((coords[1:],coords[:1]))):
            facade(color,depth,a,b,i,['zinc','concrete','ceramic'][i%3],[0,1,2,3,4,5,6,7][i%8])
    for i,coords in enumerate(footprints):cap(color,depth,coords,i)
    # Thin ribbons of moisture sit well down the shafts. The gameplay clouds are separate pieces.
    low=noise(9,322);mid=noise(31,818);fine=noise(108,917)
    xx,zz=np.meshgrid(np.linspace(-1,1,SIZE,dtype='f'),np.linspace(-1,1,SIZE,dtype='f'))
    pockets=np.exp(-((xx+.35)**2/.13+(zz-.02+.38*xx)**2/.04))+.83*np.exp(-((xx-.51)**2/.18+(zz+.44+.20*xx)**2/.035))+.59*np.exp(-((xx+.65)**2/.14+(zz+.65)**2/.06))
    vapor=np.clip((low*.51+mid*.33+fine*.16-.39)*1.13,0,.33)*np.minimum(1,pockets)*np.clip((depth-14)/24,0,1)
    out=np.clip(color*(1-vapor[...,None])+np.array([217,226,228])*vapor[...,None],0,255).astype('uint8')
    service_decks(Image.fromarray(out),footprints).save(ASSETS/'city-shafts.jpg',quality=93,subsampling=0,optimize=True)
    print('Baked',SIZE,'pixels per side from',len(footprints),'tower footprints.')


if __name__=='__main__':bake()
