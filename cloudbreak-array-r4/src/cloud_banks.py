"""Sculpt cumulus lobes at physical proportions and fit each bank into navigable airspace."""
import math,json
import numpy as np
from scipy.spatial import ConvexHull
from concurrent.futures import ProcessPoolExecutor
from shapely.geometry import Polygon,MultiPoint
from shapely import affinity
from shapely.ops import unary_union
from PIL import Image
from rooftops import *
from district import geometry,transform
import airframes
from vtkmodules.vtkFiltersCore import vtkFlyingEdges3D,vtkDecimatePro,vtkPolyDataNormals
from vtkmodules.vtkCommonDataModel import vtkImageData
from vtkmodules.util.numpy_support import numpy_to_vtk,vtk_to_numpy

RATIOS=[1.45,1.65,1.83,1.52,1.73,1.61]
def placement():
    solid=unary_union([affinity.translate(t.poly,t.x,t.z).buffer(.09) for t in T.values()]+
        [MultiPoint(transform(geometry(slug(o))[0],o['Transform'])[:,[0,2]]).convex_hull.buffer(.265) for o in R3_PIECES if slug(o).startswith('bridge-') and o['GUID'] not in RETIRED])
    ring=np.array([(math.cos(a),math.sin(a)) for a in np.linspace(0,math.tau,64,endpoint=False)])
    solid_prepared=__import__('shapely.prepared',fromlist=['prep']).prep(solid)
    records={}
    for i,o in enumerate(v for v in R3_PIECES if 'CloudbreakEditableCloud' in v.get('Tags',[])):
        t=o['Transform'];length=max(t['scaleX'],t['scaleZ']);width=min(t['scaleX'],t['scaleZ'])
        yaw=t['rotY']+(90 if t['scaleZ']>t['scaleX'] else 0);variant=i%6
        ratio=RATIOS[variant]
        target=min(1.85,max(width+.13,length/ratio,.99))
        best=None
        for dx,dz in [(0,0),(.24,0),(-.24,0),(0,.24),(0,-.24),(.4,.32),(.4,-.32),(-.4,.32),(-.4,-.32),(.68,0),(-.68,0),(0,.68),(0,-.68)]:
            for da in (0,-15,15,-30,30,45,-45,90):
                a=math.radians(yaw+da);ca,sa=math.cos(a),math.sin(a);rotation=np.array([[ca,-sa],[sa,ca]])
                center=np.array([t['posX']+dx,t['posZ']+dz])
                for short in np.arange(target,.45,-.045):
                    projected=Polygon((ring*[short*ratio,short])@rotation+center)
                    if solid_prepared.intersects(projected):continue
                    score=short-.16*math.hypot(dx,dz)-.0012*abs(da)
                    if best is None or score>best[0]:best=(score,short,center,yaw+da)
                    break
        assert best,o['Nickname']
        _,short,center,yaw=best
        before=t['posY']-PITCH;hi=before+t['scaleY'];lo=max(MAT_Y+.11,before)
        cy=(lo+hi)/2
        if 'upper' in o['Nickname'].lower():cy-=.45
        height=short*1.98
        if o['Nickname'].split(' |')[0] in ('Rainband crest','Switchyard roll'):height=max(height,2.26)
        lo=max(MAT_Y+.12,cy-height/2)
        records[o['GUID']]=dict(variant=variant,transform=xform(*[center[0],lo,center[1]],yaw%360,short*ratio,height,short))
    (WORK/'cloud-fit.json').write_text(json.dumps(records,indent=1));return records

def generate(index):
    rng=np.random.default_rng(5196+107*index);length=RATIOS[index]
    # The scalar field is sampled on an isotropic world-space grid. Every seed billow
    # has a nearly spherical profile, even on a long multi-lobed cloud.
    unit=.044;axes=[np.arange(-a,a+.5*unit,unit) for a in (length+1,1.65,1.65)]
    x,y,z=np.meshgrid(*axes,indexing='ij');field=np.full(x.shape,-5.,dtype=np.float32)
    def puff(px,py,pz,r,s=(1,1,1),k=.15):
        nonlocal field
        d=r-np.sqrt(((x-px)/s[0])**2+((y-py)/s[1])**2+((z-pz)/s[2])**2)
        h=np.maximum(k-abs(d-field),0)/k;field=np.maximum(d,field)+h*h*k*.25
    centers=[]
    for xx in np.linspace(-length*.61,length*.61,5):
        centers.append((xx,-.13+rng.uniform(-.08,.07),rng.uniform(-.09,.10),rng.uniform(.48,.64)))
    for side in (-1,1):
        for xx in np.linspace(-length*.53,length*.50,4):
            centers.append((xx+rng.uniform(-.12,.1),rng.uniform(-.13,.19),side*rng.uniform(.32,.47),rng.uniform(.29,.46)))
    for xx in (-length*.46,-.12,length*.3):
        centers.append((xx+rng.uniform(-.12,.11),rng.uniform(.23,.43),rng.uniform(-.18,.19),rng.uniform(.37,.48)))
    for c in centers:puff(*c)
    for xx,yy,zz,r in centers:
        for j in range(3):
            az=rng.uniform(0,math.tau);up=rng.uniform(-.63,.95);out=math.sqrt(1-up*up);offset=r*rng.uniform(.72,.9)
            puff(xx+offset*math.cos(az)*out,yy+offset*up,zz+offset*math.sin(az)*out,r*rng.uniform(.30,.49),k=.108)
    field+=.014*np.sin(12*x+4*z)*np.cos(13*y-6*z)+.007*np.cos(23*z+4*x)*np.sin(24*y+5*z)
    grid=vtkImageData();grid.SetDimensions(*field.shape);grid.SetOrigin(*(a[0] for a in axes));grid.SetSpacing(unit,unit,unit)
    grid.GetPointData().SetScalars(numpy_to_vtk(field.astype('float32').ravel(order='F'),deep=True))
    e=vtkFlyingEdges3D();e.SetInputData(grid);e.SetValue(0,0);e.Update()
    dec=vtkDecimatePro();dec.SetInputConnection(e.GetOutputPort());dec.SetTargetReduction(max(0,1-4800/e.GetOutput().GetNumberOfPolys()));dec.PreserveTopologyOn();dec.SplittingOff()
    normal=vtkPolyDataNormals();normal.SetInputConnection(dec.GetOutputPort());normal.SplittingOff();normal.ConsistencyOn();normal.AutoOrientNormalsOn();normal.Update()
    poly=normal.GetOutput();v=vtk_to_numpy(poly.GetPoints().GetData()).astype(float);n=vtk_to_numpy(poly.GetPointData().GetNormals()).astype(float)
    center=(v.min(axis=0)+v.max(axis=0))/2;v-=center
    rx=np.max(np.sqrt((v[:,0]/length)**2+v[:,2]**2))
    scale=np.array([.985/(rx*length),.962/np.ptp(v[:,1]),.985/rx]);v*=scale;v[:,1]+=.5
    n/=scale;n/=np.linalg.norm(n,axis=1)[:,None]
    faces=vtk_to_numpy(poly.GetPolys().GetConnectivityArray()).reshape(-1,3);m=native.Mesh()
    for tri in faces:
        pts=v[tri];ns=n[tri]
        if np.dot(np.cross(pts[1]-pts[0],pts[2]-pts[0]),ns.mean(0))<0:tri=tri[::-1];pts=v[tri];ns=n[tri]
        bright=np.clip(.14+.55*pts[:,1]+.16*ns[:,1]-.07*ns[:,0]+.05*ns[:,2],.015,.98)
        m.faces.append(tuple((tuple(p),(b,.5+.28*math.sin(4*p[0]+3*p[2])),tuple(vn)) for p,b,vn in zip(pts,bright,ns)))
    name=f'cumulus-{index}';native.AS=ASSETS;m.save(name)
    # Pointer targets match the new outlines; stay below Unity's convex face limit.
    h=v[ConvexHull(v).vertices];directions=[]
    for i in range(100):
        a=math.pi*(3-math.sqrt(5))*i;b=1-2*(i+.5)/100;c=math.sqrt(1-b*b);directions.append([c*math.cos(a),b,c*math.sin(a)])
    directions.extend(np.eye(3));directions.extend(-np.eye(3))
    samples=np.unique(((h*[1,2,1])@np.array(directions).T).argmax(axis=0))
    airframes.NEW=ASSETS;airframes.bake_collider(name,[h[samples]])
    return name,len(v)

if __name__=='__main__':
    placement()
    with ProcessPoolExecutor(max_workers=3) as pool:print(list(pool.map(generate,range(6))))
    a=np.linspace(0,1,512);mix=(1-np.cos(a*np.pi))/2
    colors=np.array([146,166,183])+mix[:,None]*np.array([99,78,58])
    Image.fromarray(np.tile(np.uint8(colors)[None,:,:],(64,1,1))).save(ASSETS/'mist-light.jpg',quality=95)
