from base import *
from shapely.geometry import MultiPoint, Polygon, Point
from PIL import Image,ImageDraw
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy import ndimage
from functools import lru_cache

@lru_cache(150)
def load_geometry(path):
    return mesh(path)

def outline(o):
    if o['Name']=='Custom_Assetbundle':
        t=o['Transform'];return Point(t['posX'],t['posZ']).buffer(.8)
    url=o.get('CustomMesh',{}).get('ColliderURL') or o.get('CustomMesh',{}).get('MeshURL')
    if not url:return None
    path=local(url) if url.startswith('http') and 'kestrel-sample-station-r1' not in url else ASSETS/url.split('/')[-1]
    v,f=load_geometry(path)
    coords=world(v,o['Transform'])
    return MultiPoint(coords[:,[0,2]]).convex_hull

SPAN=48; RES=10; SIDE=SPAN*RES+1
def pixel(x,z):
    return int(round((x+24)*RES)),int(round((z+24)*RES))

def heightfield(objs):
    grid=np.full((SIDE,SIDE),-99.,dtype=float)
    for o in objs:
        if not (o['GUID'].startswith('c7b') or 'crater-bowl' in o.get('Tags',[])):continue
        url=o['CustomMesh']['MeshURL']; v,f=load_geometry(local(url));w=world(v,o['Transform'])
        for points in w[f]:
            if points[:,1].max()<4.3:continue
            a,b,c=points; den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
            if abs(den)<1e-10:continue
            mins=np.ceil((points.min(axis=0)[[0,2]]+24)*RES-1e-5).astype(int)
            maxs=np.floor((points.max(axis=0)[[0,2]]+24)*RES+1e-5).astype(int)
            x0,z0=np.clip(mins,0,SIDE-1);x1,z1=np.clip(maxs,0,SIDE-1)
            if x0>x1 or z0>z1:continue
            xs=np.arange(x0,x1+1)[None,:]/RES-24;zs=np.arange(z0,z1+1)[:,None]/RES-24
            u=((b[2]-c[2])*(xs-c[0])+(c[0]-b[0])*(zs-c[2]))/den
            v1=((c[2]-a[2])*(xs-c[0])+(a[0]-c[0])*(zs-c[2]))/den;vz=1-u-v1
            h=np.where((u>=-1e-5)&(v1>=-1e-5)&(vz>=-1e-5),u*a[1]+v1*b[1]+vz*c[1],-99)
            win=grid[z0:z1+1,x0:x1+1];np.maximum(win,h,out=win)
    missing=grid<0
    if missing.any():grid[missing]=grid[tuple(ndimage.distance_transform_edt(missing,return_distances=False,return_indices=True)[:,missing])]
    return grid

def footprints(bag):
    reg={}
    for o in bag['ContainedObjects']:
        if o['GUID']=='c70000' or 'platform' in o['Nickname'].lower() or o['GUID'].startswith('c7b'):continue
        poly=outline(o)
        if poly is not None:reg[o['GUID']]=poly
    return reg
def plan(bag,path):
    fig,ax=plt.subplots(figsize=(12,12));q=footprints(bag)
    h=np.load(WORK/'relief.npy')
    ax.imshow(h,origin='lower',extent=[-24,24,-24,24],vmin=5.1,vmax=7.6,cmap='Greys',alpha=.3)
    for o in bag['ContainedObjects']:
        g=o['GUID']
        if g not in q:continue
        p=q[g];cols=p.exterior.xy;color='#83989e' if 'building' in o.get('Tags',[]) else '#b3c78f' if 'solar-array' in o.get('Tags',[]) else '#e9ac70' if g.startswith('e5') else '#bdc0c4'
        if g.startswith('c7f'):color='#d44351'
        ax.fill(*cols,color=color,alpha=.74,edgecolor='#3f4b53',linewidth=.7)
        loc=p.centroid;ax.text(loc.x,loc.y,g[-4:],ha='center',va='center',size=8)
    ax.set_xticks(np.arange(-24,25,2));ax.set_yticks(np.arange(-24,25,2));ax.set_aspect('equal');ax.grid(alpha=.15);ax.set_xlim(-25,25);ax.set_ylim(-25,25);fig.tight_layout();fig.savefig(path,dpi=110);plt.close(fig)
if __name__=='__main__':
    if not (WORK/'relief.npy').exists():np.save(WORK/'relief.npy', heightfield(ORIGINAL['ContainedObjects']))
    plan(ORIGINAL,WORK/'survey.png')
    reg=footprints(ORIGINAL)
    for o in ORIGINAL['ContainedObjects']:
        g=o['GUID']
        if g in reg:print(g, [round(k,2) for k in reg[g].bounds], o['Nickname'])
