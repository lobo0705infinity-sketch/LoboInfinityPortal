"""Build wear into the station's existing world-mapped regolith and keep the crater relief."""
from survey import *
from assemble import build_bag
from PIL import ImageFilter,ImageOps,ImageFont
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from shapely.geometry import LineString
import math, random
N=2048
S=N/48
def pp(x,z):return ((x+24)*S,(24-z)*S)
def pts(line):return [pp(*p)for p in line]
def polygon(draw,p,fill):draw.polygon(pts(p),fill=fill)
def line(draw,p,fill,w):draw.line(pts(p),fill=fill,width=max(1,round(w*S)),joint='curve')
def chamfer(x0,z0,x1,z1,b):
 return [(x0+b,z0),(x1-b,z0),(x1,z0+b),(x1,z1-b),(x1-b,z1),(x0+b,z1),(x0,z1-b),(x0,z0+b)]
def routefinder(reg):
    detail=5;side=48*detail+1;size=(side,side)
    obs=Image.new('L',size,0);d=ImageDraw.Draw(obs)
    for g,p in reg.items():
        if g=='e51001':continue
        if g=='c70033':
            for cx in (3.68,12.32):
                bounds=[((cx-.20+24)*detail,(-20.4+24)*detail),((cx+.20+24)*detail,(-13.6+24)*detail)]
                d.rectangle(bounds,fill=1)
            continue
        q=p.buffer(.29)
        d.polygon([((x+24)*detail,(z+24)*detail) for x,z in q.exterior.coords],fill=1)
    occ=np.array(obs,dtype=bool);rel=np.load(WORK/'relief.npy')[::2,::2]
    z,x=np.indices((side,side));h=np.abs(rel-GRADE);space=ndimage.distance_transform_edt(~occ)/detail
    cost=1.0+np.minimum(25,h*10)+np.maximum(0,1.65-space)**2*1.9
    allowed=(~occ)&(space>.24)&(x>2)&(z>2)&(x<side-3)&(z<side-3)
    regions,count=ndimage.label(allowed,np.ones((3,3)));areas=np.bincount(regions[allowed]);allowed &= (regions==np.argmax(areas));
    ids=np.arange(side*side).reshape(side,side);src=[];dst=[];ws=[]
    for dz,dx in [(0,1),(1,0),(1,1),(-1,1)]:
        za=slice(max(0,-dz),min(side,side-dz));zb=slice(max(0,dz),min(side,side+dz))
        xa=slice(max(0,-dx),min(side,side-dx));xb=slice(max(0,dx),min(side,side+dx))
        ok=allowed[za,xa]&allowed[zb,xb];a=ids[za,xa][ok];b=ids[zb,xb][ok];w=(cost[za,xa][ok]+cost[zb,xb][ok])*.5*math.hypot(dx,dz);src.extend([a,b]);dst.extend([b,a]);ws.extend([w,w])
    graph=coo_matrix((np.concatenate(ws),(np.concatenate(src),np.concatenate(dst))),shape=(side*side,side*side)).tocsr()
    possible=np.array(np.nonzero(allowed)).T
    def snap(q):
        a=np.array([(q[1]+24)*detail,(q[0]+24)*detail]);v=possible[np.argmin(np.sum((possible-a)**2,axis=1))];return ids[tuple(v)]
    def solve(pins):
        series=[]
        for a,b in zip(pins,pins[1:]):
            first,last=snap(a),snap(b);dist,prev=dijkstra(graph,indices=first,return_predecessors=True)
            assert np.isfinite(dist[last]),(a,b)
            seq=[last]
            while seq[-1]!=first:seq.append(prev[seq[-1]])
            for idx in reversed(seq):
                j,k=divmod(idx,side);series.append([k/detail-24,j/detail-24])
        coarse=np.array(LineString(series).simplify(.27).coords)
        for _ in range(2):
            c=.75*coarse[:-1]+.25*coarse[1:];f=.25*coarse[:-1]+.75*coarse[1:];coarse=np.vstack([coarse[0],np.stack([c,f],axis=1).reshape(-1,2),coarse[-1]])
        return LineString(coarse)
    return solve

def main():
    seed=252;r=random.Random(seed);rng=np.random.default_rng(seed)
    orig=next(o for o in ORIGINAL['ContainedObjects'] if o['GUID']=='c7b000')
    base=np.asarray(Image.open(local(orig['CustomMesh']['DiffuseURL'])).convert('RGB').resize((N,N))).astype('float32')
    grit=(base.mean(axis=2)-128)
    fine=rng.normal(0,1,(N,N)).astype('float32')
    broad=np.array(Image.fromarray(rng.integers(45,210,(50,50),dtype=np.uint8)).resize((N,N),Image.Resampling.BICUBIC),dtype=np.float32)
    def mix(mask,col,opacity=1,grain=.45):
        nonlocal base
        a=np.asarray(mask,dtype='float32')*(opacity/255);color=np.array(col,dtype='float32')[None,None,:]+(grit*grain+fine*2)[:,:,None]
        base+=a[:,:,None]*(color-base)
    def blank():return Image.new('L',(N,N),0)
    def dest():
        g=blank();return g,ImageDraw.Draw(g)
    # Graded operations areas. The irregular aprons distinguish pressure hardware from raw highlands.
    pads=[('flight',chamfer(2.90,-23.66,15.38,-9.91,.78)),('assay',chamfer(12.65,-10.64,22.21,-5.36,.57)),('crew',chamfer(14.96,13.65,22.08,21.92,.57)),('pv',chamfer(-2.10,11.69,2.96,16.95,.39)),('rig',chamfer(-17.99,-13.20,-14.87,-11.47,.28))]
    graded,gd=dest()
    for area,poly in pads:polygon(gd,poly,255)
    mix(graded.filter(ImageFilter.GaussianBlur(13)),(139,134,125),.69,.65)
    reg=footprints(build_bag());solve=routefinder(reg)
    # Relative widths tell the cart route apart from individual EVA foot traffic.
    links=[
      ('freight',[(8.15,-21.0),(10.20,-13.42),(10.2,-10.12),(12.35,-9.62),(18.62,-7.70)]),
      ('freight',[(12.45,-9.9),(8.7,-10.85),(4.6,-10.65),(1.33,-9.75),(-1.5,-10.35)]),
      ('rim',[(-1.55,-10.31),(-7.0,-11.5),(-13.4,-12.65),(-15.27,-11.20)]),
      ('eva',[(1.25,-9.75),(.2,-4.5),(-.95,.8),(-1.2,4.35),(-2.38,7.80),(-1.22,10.18),(-.57,11.74)]),
      ('eva',[(15.34,17.85),(15.1,14.18),(17.2,13.20),(17.85,13.24)]),
      ('eva',[(14.05,14.18),(9.20,13.8),(4.2,12.75),(2.8,13.20)]),
      ('eva',[(4.58,9.40),(4.30,10.98),(2.75,12.90)]),
      ('eva',[(-14.92,-11.32),(-16.50,-6.91),(-14.4,-2.91),(-13.1,1.0),(-14.68,5.0)]),
      ('eva',[(-13.15,1.0),(-12.4,5.35),(-13.65,7.90),(-15.15,10.20)]),
      ('eva',[(14.75,15.8),(13.75,17.35),(12.02,18.70),(11.36,19.7)]),
    ]
    traffic,td=dest();worn,wd=dest();treads,dd=dest();routes=[]
    obj_mask,om=dest()
    for g,p in reg.items():
        if g=='e51001': continue
        polygon(om,list(p.exterior.coords),255)
    keep=ImageOps.invert(obj_mask.filter(ImageFilter.MinFilter(9)))
    for typ,pins in links:
        geom=solve(pins);routes.append({'type':typ,'points':np.round(np.array(geom.coords),2).tolist()});width={'freight':1.70,'eva':1.02,'rim':1.43}[typ]
        line(td,geom.coords,193 if typ=='eva' else 246,width)
        line(wd,geom.coords,148 if typ=='eva' else 158,width*.65)
        step=.30 if typ=='eva' else .22
        for i,t in enumerate(np.arange(.07,geom.length-.08,step)):
            p=np.array(geom.interpolate(t).coords[0]);p2=np.array(geom.interpolate(t+.07).coords[0]);u=p2-p;u/=max(.001,np.linalg.norm(u));v=np.array([-u[1],u[0]])
            if typ=='eva':
                if r.random()<.30:continue
                p=p+v*((.12 if i%2 else -.12)+r.uniform(-.06,.06))
                for j in [-.025,.019,.059]:line(dd,[p+u*j-v*.047,p+u*j+v*.041],r.randrange(95,175),.025)
            else:
                for side in [-1,1]:
                    if r.random()<.15:continue
                    q=p+v*side*.42;line(dd,[q-v*.075-u*.03,q+v*.08+u*.03],r.randrange(94,180),.040)
    def masked(mask):return Image.fromarray(np.uint8(np.asarray(mask,dtype=float)*np.asarray(keep)/255))
    mix(masked(traffic.filter(ImageFilter.GaussianBlur(11))),(160,156,144),.92,.43)
    mix(masked(worn.filter(ImageFilter.GaussianBlur(4))),(95,98,94),.78,.50)
    mix(masked(treads.filter(ImageFilter.GaussianBlur(.45))),(77,78,76),.74,.7)
    # Baked sintered-regolith segments carry the clean receiving cart up to the assay pad.
    # Leave the cross-country drill trail and the EVA tracks softer than this built surface.
    from PIL import ImageChops
    hard,hd=dest();cuts,cs=dest();edge,ed=dest()
    for record in routes:
        if record['type']!='freight':continue
        geo=LineString(record['points'])
        line(hd,geo.coords,235,1.45)
        for d in np.arange(.24,geo.length-.10,1.10):
            a=np.array(geo.interpolate(d).coords[0]);b=np.array(geo.interpolate(d+.06).coords[0]);u=b-a;u/=max(.00001,np.linalg.norm(u));n=np.array([-u[1],u[0]])
            line(cs,[a-n*.66,a+n*.66],210,.042)
            if int(d)%4<2:
                line(ed,[a+n*.60-.18*u,a+n*.60+.16*u],210,.061)
    mix(masked(hard),(162,157,143),.80,.36);mix(masked(cuts),(92,91,86),.74,.42)
    mix(masked(edge),(197,165,103),.70,.32);mix(masked(treads),(94,94,87),.52,.35)
    dump(WORK/'routes.json',routes)
    # Only the working surfaces get expansion seams and service markings.
    plate,pl=dest();join,jd=dest();paint,pd=dest();chalk,cd=dest()
    apron=chamfer(3.20,-22.94,12.96,-10.13,.58);polygon(pl,apron,255)
    crew=chamfer(15.30,15.28,17.55,20.86,.30);polygon(pl,crew,255)
    switch=chamfer(-1.75,11.97,2.76,16.64,.22);polygon(pl,switch,255)
    assay=chamfer(18.15,-9.98,21.98,-6.60,.28);polygon(pl,assay,255)
    for poly in [apron,crew,switch,assay]:
        xx=[p[0]for p in poly];zz=[p[1]for p in poly]
        for x in np.arange(min(xx)+.90,max(xx),1.52):line(jd,[(x,min(zz)),(x,max(zz))],191,.032)
        for z in np.arange(min(zz)+.87,max(zz),1.28):line(jd,[(min(xx),z),(max(xx),z)],165,.025)
        line(pd,poly+[poly[0]],130,.054)
    from PIL import ImageChops
    mix(plate,(150,152,147),.83,.24);mix(ImageChops.multiply(plate,join),(69,74,74),.7,.35)
    # The PV combiner has paired buried runs ending at actual array bases. The lids are flush.
    trench,tr=dest()
    bus=[(-12.1,8.96),(-1.65,8.96),(-.76,9.85),(-.76,12.18)]
    line(tr,bus,215,.23)
    for xx in [-12.08,-7.76,-3.50]:
        line(tr,[(xx,8.96),(xx,10.7)],215,.17);line(tr,[(xx,13.00),(xx,14.4)],165,.14)
    for x in np.arange(-12,-1.7,.55):line(cd,[(x,8.87),(x,9.05)],180,.03)
    mix(trench,(90,93,91),.88,.34)
    for x,z in [(4.32,-21.09),(11.49,-21.09),(9.21,-9.98),(11.24,-9.98)]:
        line(pd,[(x-.3,z),(x+.3,z)],230,.075)
    for z in np.arange(-22.43,-20.12,.47):line(pd,[(7.65,z),(7.65,z+.19)],185,.07)
    for x in np.arange(9.0,11.5,.23):line(pd,[(x,-13.47),(x+.14,-13.32)],185,.052)
    # White direction chevrons and service stop marks only at the bay.
    for x in (5.05,10.92):
        line(cd,[(x-.22,-22.5),(x,-22.28),(x+.22,-22.5)],208,.06)
    mix(paint,(189,156,92),.93,.3);mix(chalk,(203,202,183),.75,.3)
    # Fine regolith and uneven dust remain visible through traffic and paint.
    a=np.uint8(np.clip(base+(broad[:,:,None]-128)*.035,0,255));Image.fromarray(a).save(ASSETS/'station-regolith.jpg',quality=85,optimize=True)
if __name__=='__main__':main()
