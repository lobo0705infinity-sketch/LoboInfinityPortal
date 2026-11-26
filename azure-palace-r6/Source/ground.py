"""Render resort paving as one UV surface and rebuild the centered pool from its physical dimensions."""
from PIL import Image,ImageDraw
import shapely
from shapely.geometry import LineString,Point,Polygon,box
from shapely import union_all,affinity
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from common import *
from architecture import FRONT,BACK,dims
from courts import sites,site_polygon,from_site,deployment_paving
from site_check import field,pool,objectives,envelopes,court_hulls
from faces import clean,give_sheets_thickness
def build_pool():
    original_export=A.export
    def cleaned(mesh,path):
        result,n=clean(mesh);v,f=original_export(result,OUT/'recessed-pool.obj')
        print('Pool cleanup:',n,'intersecting triangles,',f,'retained faces.',flush=True)
    A.export=cleaned;orig_col=A.collision;A.collision=lambda *a:None
    oldroot=A.ROOT;A.ROOT=ROOT
    try:A.ground()
    finally:A.ROOT=oldroot;A.export=original_export;A.collision=orig_col
def marker():
    marker_mesh=mesh_from_obj(R2/'original/deps/antenna.obj')
    exposed,count=clean(marker_mesh,bottom=True)
    A.export(exposed,OUT/'crossing-lines-antenna.obj')
def paved():
    size=3072;ppm=size/48
    def xy(x,z):return (int(round((x+24)*ppm)),int(round((24-z)*ppm)))
    def line(draw,p,col,sw):draw.line([xy(*s) for s in p],fill=col,width=sw,joint='curve')
    def fill_mask(p):
        ma=Image.new('L',(size,size));dr=ImageDraw.Draw(ma)
        def draw(g):
            if g.geom_type=='Polygon':
                dr.polygon([xy(x,z) for x,z in g.exterior.coords],fill=255)
                for hole in g.interiors:dr.polygon([xy(x,z) for x,z in hole.coords],fill=0)
            elif hasattr(g,'geoms'):
                for h in g.geoms:draw(h)
        draw(p);return ma
    sheet=Image.open(R2/'Assets/court-and-basin.jpg').convert('RGB')
    raw=sheet.crop((8,8,size+8,size+8));a=np.asarray(raw,dtype=np.float32);lum=a[:,:,0]*.23+a[:,:,1]*.58+a[:,:,2]*.19;grain=lum-np.median(lum)
    # A shared public promenade and service paths connect actual entrances. Paving can sit below a canopy or seat.
    shells=envelopes();hard=court_hulls();blocked=union_all([*shells.values(),*hard.values(),pool,*[z.buffer(1.02)for z in objectives]])
    step=.27;v=np.arange(-23.87,23.88,step);X,Z=np.meshgrid(v,v);idx=np.arange(X.size).reshape(X.shape)
    valid=~shapely.contains_xy(blocked.buffer(.42,quad_segs=3),X,Z)
    ri,ci=np.where(valid);points=np.c_[X[ri,ci],Z[ri,ci]];nn=cKDTree(points);ids=idx[ri,ci];fr=[];to=[];cost=[]
    for di,dj in [(0,1),(1,0),(1,1),(1,-1)]:
        rr,cc=ri+di,ci+dj;ok=(rr>=0)&(rr<len(v))&(cc>=0)&(cc<len(v));i,j,rr,cc=ri[ok],ci[ok],rr[ok],cc[ok];ok=valid[rr,cc]
        f,t=idx[i[ok],j[ok]],idx[rr[ok],cc[ok]];fr.extend([f,t]);to.extend([t,f]);cost.extend([np.full(len(f),math.hypot(di,dj)*step)]*2)
    graph=csr_matrix((np.concatenate(cost),(np.concatenate(fr),np.concatenate(to))),shape=(X.size,X.size))
    doors={k:[world(k,xx,sg*(dims[k][1]/2+.30)) for xx,sg in [(FRONT,-1),(BACK,1)]] for k in poses}
    links=[('reception','terrace-restaurant'),('terrace-restaurant','pool-east'),('pool-east','sunward-wing'),('pool-west','azure-spa'),('sunward-wing','cafe'),('cafe','seaward-wing'),('laundry','azure-spa'),('pool-equipment','reception'),('south-villa','reception'),('north-villa','sunward-wing'),('west-villa','azure-spa'),('east-villa','seaward-wing')]
    doors.update({'pool-east':[(4.00,-1)],'pool-west':[(-4.00,-1)]});routes=[]
    for akey,bkey in links:
        best=None
        for p in doors[akey]:
            da,si=nn.query(p);start=ids[si];dist,prev=dijkstra(graph,directed=False,indices=start,return_predecessors=True)
            for q in doors[bkey]:
                db,ei=nn.query(q);goal=ids[ei];length=dist[goal]+da+db
                if not np.isfinite(length) or best and length>=best[0]:continue
                linepts=[q];at=goal
                while at>=0:
                    i,j=divmod(at,len(v));linepts.append((X[i,j],Z[i,j]));at=prev[at]
                linepts.append(p);best=(length,LineString(linepts[::-1]).simplify(.29))
        if not best:print('walking link disconnected:',akey,bkey,flush=True)
        if best:routes.append(best[1].buffer(.74 if set([akey,bkey])&{'laundry','pool-equipment'} else .87,cap_style=2,join_style=1))
    walk=union_all(routes).difference(pool).intersection(field)
    court=raw.copy();texture=Image.fromarray(np.uint8(np.clip(a*.65+np.array([48,48,40]),0,255)));court.paste(texture,(0,0),fill_mask(walk))
    def outline(draw,g,col,width):
        if g.geom_type=='Polygon':line(draw,g.exterior.coords,col,width)
        elif hasattr(g,'geoms'):
            for item in g.geoms:outline(draw,item,col,width)
    outline(ImageDraw.Draw(court),walk,(102,113,99),3)
    for slug,(_,_,kind,_) in sites.items():
        p=site_polygon(slug)
        if slug!='pool':
            # The door threshold and outside court share a contiguous paved landing around the building corner.
            nearer=min(doors[slug],key=lambda q:p.distance(Point(*q)))
            public_ring=shells[slug].buffer(.69,join_style=2).difference(shells[slug].buffer(-.1))
            p=union_all([p,public_ring])
            landings={'east-villa':box(-2.61,-7.47,-.08,-3.20),'west-villa':box(.13,3.22,2.51,7.72),'sunward-wing':box(-.05,4.45,3.77,7.22),'south-villa':box(-.18,3.22,5.46,5.91),'seaward-wing':box(-6.40,-2.21,-3.48,1.11),'azure-spa':box(-.32,-5.97,2.84,-2.95)}
            if slug in landings:
                q=poses[slug];p=p.union(affinity.translate(affinity.rotate(landings[slug],-q['rot'],origin=(0,0)),q['x'],q['z']))
            if slug in deployment_paving:
                p=p.union(Polygon([world(slug,*pt) for pt in deployment_paving[slug]]))

        p=p.intersection(field).difference(pool)
        palette={'dining':(153,139,114),'spa':(127,148,133),'arrivals':(150,143,123),'cafe':(151,145,123),'plant':(92,111,111),'linen':(98,112,111),'gallery':(156,149,128),'loggia':(143,145,127),'quiet':(128,133,117),'pool':(137,113,84)}
        color=np.array(palette[kind],dtype=float);im=Image.fromarray(np.uint8(np.clip(color+grain[:,:,None]*.76,0,255)));dr=ImageDraw.Draw(im)
        def stroke(pair,c,width):line(dr,[from_site(slug,*pt) for pt in pair],c,width)
        c=tuple(map(int,color));joint=tuple(x-24 for x in c)
        pitch=.20 if kind=='pool' else .70
        for j,vv in enumerate(np.arange(-13,12,pitch)):
            stroke([(-12,vv),(12,vv)],joint,2)
            for u in np.arange(-13+(j%2)*.70,13,2.10 if kind=='pool' else 1.40):stroke([(u,vv),(u,vv+pitch)],joint,1)
        # Only the physical yard mesh contains a drain. The floor has a single stone boundary.
        outline(dr,p.buffer(-.08),(156,142,108) if kind not in ('plant','linen') else (118,128,122),4)
        court.paste(im,(0,0),fill_mask(p))
    sheet.paste(court,(8,8));sheet.save(OUT/'palace-courts.jpg',quality=92,subsampling=0,optimize=True)
    print(len(routes),'connected paths on the single court texture.',flush=True)
if __name__=='__main__':
    give_sheets_thickness(M);build_pool();marker();paved()
