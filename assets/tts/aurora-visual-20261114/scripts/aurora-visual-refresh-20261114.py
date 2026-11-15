#!/usr/bin/env python3
"""Build Aurora VII visual refresh from a validated existing TTS collection.

Retains original vertices, collision, states, transforms and scripts. Changes UVs
and diffuse maps, and adds non-colliding wall artwork only inside solid surfaces.
Inputs are explicit to keep the production source reproducible.
"""
import argparse, collections, hashlib, json, pathlib, re, shutil
import numpy as np
from PIL import Image
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

RIGHT_MAP=[1,4,6,6,10,11,15,11,0,13,6,11,0,0,12,3]
ATLAS_ROWS=np.linspace(0,1,7)
LEFT_LAYOUT=(1254/4096/4,4,4,list(range(16)))
SOURCE_LAYOUTS={}
def register(slugs,tile,cols,rows,slots):
    for slug in slugs.split():SOURCE_LAYOUTS[slug]=(tile,cols,rows,slots)
register('greenwood-river greenwood-station',1254/4096/4,4,4,[4,4,1,3,9,9,6,10,4,6,5,7,6,10,11,3])
register('freeport-echo',.125,4,4,[15,6,4,4,6,6,5,4,5,11,9,7,6,6,3,1])
register('dockside',.125,4,4,[4,6,4,4,6,11,0,5,15,2,9,7,6,15,3,1])
register('courtyard civic-gardens',384/4096,4,8,[0,15,1,6,11,5,6,3,2,0,12,0,13,15,6,9,12,0,0,0,12,12,12,12,12,12,12,12,9,12,0,9])
register('red-mesa geothermal',.125,4,4,[6,15,11,1,6,6,4,9,11,5,6,1,6,11,3,13])
register('faultline',1254/4096/2,2,2,[4,6,6,11])
register('rift-research',1254/4096/2,2,2,[0,11,10,6])
register('iron-junction transit-hub',1280/4096/2,2,2,[15,6,4,7])
register('research-valley high-pass',1254/4096/2,2,2,[15,11,6,5])
register('helios-refinery helios-fields',1254/4096/2,2,2,[11,1,6,4])
register('orbital-logistics',1254/4096/4,4,4,[6,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])
register('nova-admin',1254/4096/4,4,4,list(range(16)))
register('al-medina survey-frontier',1254/4096/4,4,4,[15,1,6,6,4,5,9,13,3,2,10,11,13,13,12,4])
register('polar-expedition frosthold',.125,4,4,[15,3,6,11,6,10,15,11,6,6,10,3,3,10,2,16])
register('tidal coastal-access',1280/4096/2,2,2,[15,6,4,7])

def read_obj(path):
    vs=[];uv=[];ns=[];fs=[]
    for line in pathlib.Path(path).read_text().splitlines():
        p=line.split()
        if not p:continue
        if p[0]=='v':vs.append(tuple(map(float,p[1:4])))
        elif p[0]=='vt':uv.append(tuple(map(float,p[1:3])))
        elif p[0]=='vn':ns.append(tuple(map(float,p[1:4])))
        elif p[0]=='f':
            parts=[]
            for x in p[1:]:
                q=x.split('/');parts.append(tuple((int(v)-1 if v else -1) for v in (q+['',''])[:3]))
            for j in range(1,len(parts)-1):fs.append([parts[0],parts[j],parts[j+1]])
    return vs,uv,ns,fs

def atlas_uv(slot,xy,pad=.045):
    col=slot%4;row=slot//4
    return ((col+pad+float(xy[0])*(1-2*pad))/4,1-(ATLAS_ROWS[row]+(pad+float(xy[1])*(1-2*pad))*(ATLAS_ROWS[row+1]-ATLAS_ROWS[row])))

def material_region(coords,size,normal,center,bounds,canonical=True):
    """Locate a source atlas island before remapping; never infer from filename alone."""
    w,h=size;px=np.array([[u*w,(1-v)*h] for u,v in coords]);m=px.mean(axis=0)
    frac,cols,rows,leftmap=LEFT_LAYOUT;tile=w*frac
    if canonical and m[0]<tile*cols+1 and m[1]<tile*rows+1:
        col=max(0,min(cols-1,int(m[0]/tile)));row=max(0,min(rows-1,int(m[1]/tile)))
        slot=leftmap[row*cols+col];local=(px-np.array([col*tile,row*tile]))/tile
    elif canonical and m[0]>=w*.5-1 and m[1]<w*.5+1:
        tile=w*.125;col=max(0,min(3,int((m[0]-w*.5)/tile)));row=max(0,min(3,int(m[1]/tile)))
        slot=RIGHT_MAP[row*4+col];local=(px-np.array([w*.5+col*tile,row*tile]))/tile
    elif canonical and .48*h<m[1]<.79*h and m[0]<.34*w:
        # Pre-existing building fascia plaques: retain their physical faces.
        slot=16;local=px-px.min(axis=0);den=np.maximum(local.max(axis=0),1);local/=den
    else:
        # Plain palette swatches and non-atlas legacy fixtures use physical UVs.
        slot=0 if abs(normal[1])>.9 else 4
        if abs(normal[1])>.9 and center[1]>bounds[1][1]-.5:slot=6
        local=px-px.min(axis=0);den=np.maximum(local.max(axis=0),1);local/=den
    # Different finish for room-facing wall surfaces, retaining the same geometry.
    mid=(bounds[0]+bounds[1])/2
    if abs(normal[1])<.1 and np.dot(normal,center-mid)<-.25 and slot in (4,6):slot=15
    return slot,np.clip(local,0,1)

def place_panel(vs,fs,kind,used):
    arr=np.array(vs);lo=arr.min(axis=0);hi=arr.max(axis=0);mid=(lo+hi)/2
    idx=np.array([[f[0][0],f[1][0],f[2][0]] for f in fs]);tri=arr[idx]
    cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);lens=np.linalg.norm(cross,axis=1)
    normals=cross/np.maximum(lens[:,None],1e-12);groups=collections.defaultdict(list)
    for i,n in enumerate(normals):
        axis=0 if abs(n[0])>.999 else (2 if abs(n[2])>.999 else None)
        if axis is None or lens[i]<.001:continue
        sign=1 if n[axis]>0 else -1;plane=float(tri[i,:,axis].mean())
        outside=(plane-mid[axis])*sign>0
        if outside!=(kind=='exterior'):continue
        if abs(plane-mid[axis])<.62*(hi[axis]-lo[axis])/2:continue
        other=2 if axis==0 else 0
        pts=tri[i][:,[other,1]]
        if pts[:,1].max()<lo[1]+.9:continue
        poly=Polygon(pts)
        if poly.is_valid and poly.area>.001:groups[(axis,sign,round(plane,5))].append(poly)
    candidates=[]
    for key,polys in groups.items():
        if key in used:continue
        union=unary_union(polys)
        if union.area<.42:continue
        minx,miny,maxx,maxy=union.bounds
        if maxx-minx<.75 or maxy-miny<.65:continue
        candidates.append((union.area,key,union))
    for _,key,poly in sorted(candidates,reverse=True)[:18]:
        minx,miny,maxx,maxy=poly.bounds
        for width,height in [(1.2,.80),(.96,.64),(.75,.5)]:
            ys=[lo[1]+1.8,lo[1]+2.2,(miny+maxy)/2,lo[1]+1.25]
            xs=[(minx+maxx)/2,minx+width*.6,maxx-width*.6]+list(np.linspace(minx+width*.6,maxx-width*.6,7))
            for y in ys:
                for x in xs:
                    rect=box(x-width/2-.025,y-height/2-.025,x+width/2+.025,y+height/2+.025)
                    if not poly.covers(rect):continue
                    axis,sign,plane=key;other=2 if axis==0 else 0
                    vertices=[]
                    for a,b in [(x-width/2,y-height/2),(x+width/2,y-height/2),(x+width/2,y+height/2),(x-width/2,y+height/2)]:
                        v=[0.,0.,0.];v[axis]=plane+sign*.006;v[other]=a;v[1]=b;vertices.append(v)
                    n=np.cross(np.array(vertices[1])-vertices[0],np.array(vertices[2])-vertices[0])
                    if n[axis]*sign<0:vertices=list(reversed(vertices))
                    used.add(key)
                    return vertices,key
    return None,None

def remesh(source,texture,target,role,sign=0):
    vs,old_uv,ns,fs=read_obj(source);arr=np.array(vs);bounds=(arr.min(axis=0),arr.max(axis=0))
    size=Image.open(texture).size
    # The established two-bank Aurora material atlas has a blank central strip.
    im=Image.open(texture).convert('RGB');sample=im.getpixel((int(size[0]*.4),int(size[1]*.25)))
    canonical=True
    new_uv=[];new_faces=[];slots=collections.Counter()
    for f in fs:
        points=arr[[x[0] for x in f]];normal=np.cross(points[1]-points[0],points[2]-points[0]);normal/=max(np.linalg.norm(normal),1e-12)
        coords=[old_uv[x[1]] if 0<=x[1]<len(old_uv) else (.1,.9) for x in f]
        slot,local=material_region(coords,size,normal,points.mean(axis=0),bounds,canonical)
        slots[slot]+=1;nf=[]
        for q,xy in zip(f,local):new_uv.append(atlas_uv(slot,xy));nf.append((q[0],len(new_uv)-1,q[2]))
        new_faces.append(nf)
    # Keep the complete original floor/roof and furnishing geometry. The additions
    # are wall decals, verified to fit within solid polygons, outside all openings.
    panels=[];used=set()
    for kind,slot in [('exterior',16+sign),('interior',20+(role%3)),('interior',23)]:
        vertices,key=place_panel(vs,fs,kind,used)
        if vertices is None:continue
        base=len(vs);vs.extend(vertices);uvbase=len(new_uv)
        # Match UV left/right to the face winding, so readable type isn't mirrored.
        axis,sign,plane=key;other=2 if axis==0 else 0
        p=np.array(vertices);xmin,xmax=p[:,other].min(),p[:,other].max();ymin,ymax=p[:,1].min(),p[:,1].max()
        for v in p:
            x=(v[other]-xmin)/(xmax-xmin)
            if (axis==2 and sign<0) or (axis==0 and sign>0):x=1-x
            new_uv.append(atlas_uv(slot,(x,1-(v[1]-ymin)/(ymax-ymin)),pad=.025))
        for order in [(0,1,2),(0,2,3)]:new_faces.append([(base+j,uvbase+j,-1) for j in order])
        panels.append({'kind':kind,'slot':slot,'plane':key})
    # Preserve original vertex identity, including coincident front/back faces.
    # Welding these produces shading errors on the established canopy meshes.
    # Only UV and normal values are deduplicated.
    vmap={};vlist=[];umap={};ulist=[];nmap={};nlist=[];faces=[]
    def intern(value,lookup,values):
        value=tuple(round(float(x),7) for x in value)
        if value not in lookup:lookup[value]=len(values)+1;values.append(value)
        return lookup[value]
    for f in new_faces:
        ff=[]
        for vi,ui,ni in f:
            if vi not in vmap:vmap[vi]=len(vlist)+1;vlist.append(vs[vi])
            a=vmap[vi];b=intern(new_uv[ui],umap,ulist)
            if 0<=ni<len(ns):c=intern(ns[ni],nmap,nlist);ff.append(f'{a}/{b}/{c}')
            else:ff.append(f'{a}/{b}')
        faces.append('f '+' '.join(ff))
    lines=['# Aurora VII 20261114: original geometry, new material UVs and fitted wall artwork']
    for label,values in [('v',vlist),('vt',ulist),('vn',nlist)]:
        lines.extend(label+' '+' '.join(f'{x:.9g}' for x in v) for v in values)
    lines.extend(faces);target.write_text('\n'.join(lines)+'\n')
    return {'original_triangles':len(fs),'final_triangles':len(faces),'vertices':len(vlist),'panels':panels,'material_slots':dict(slots),'canonical_source_atlas':canonical,'source_bounds':[bounds[0].tolist(),bounds[1].tolist()]}

def role_for(name):
    n=name.lower()
    if any(x in n for x in ('lab','research','assay','biology','sample','geology')):return 1
    if any(x in n for x in ('home','habitat','mess','cafe','shop','market','residen','reception','crew','shelter','bivouac')):return 3
    if any(x in n for x in ('control','repair','maintenance','cargo','freight','warehouse','archive','storage','workshop','office')):return 2
    return 0

def sign_for(name,theme):
    n=name.lower();best=(0,0)
    for i,sign in enumerate(theme[4].split('|')[1:],1):
        words=set(re.findall(r'[a-z]+',sign.lower()))-{'the','and','public','field'}
        score=sum(2 for w in words if w in n)
        if 'lab' in words and any(x in n for x in ['laboratory','biology','assay']):score+=3
        if sign.lower() in n:score+=5
        if score>best[0]:best=(score,i)
    return best[1]

def main():
    global ATLAS_ROWS,LEFT_LAYOUT
    ap=argparse.ArgumentParser();ap.add_argument('--workspace',required=True);ap.add_argument('--asset-base',default='__AURORA_ASSET_BASE__');a=ap.parse_args();root=pathlib.Path(a.workspace)
    repo=pathlib.Path(__file__).resolve().parents[1];out=repo/'assets/tts/aurora-visual-20261114';out.mkdir(parents=True,exist_ok=True)
    data=json.load(open(root/'baseline/Workshop-Save.json'));themes=json.load(open(root/'inspection/themes.json'))
    manifest=json.load(open(root/'inspection/source-assets.json'));sources={e['url']:pathlib.Path(e['path']) for e in manifest}
    selected=json.load(open(root/'inspection/asset-inventory.json'));lookup={x['guid']:x for x in selected['bags']}
    theme_by_name={t[1]:t for t in themes};meshes={};audit=[];checks=[]
    atlas_layout=json.load(open(root/'inspection/atlas-layout.json'))
    for bag in data['ObjectStates']:
        if bag.get('GUID') not in lookup:continue
        loc=re.sub(r' R\d+$','',bag['Nickname'].split(' · ')[1]);theme=theme_by_name[loc];slug=theme[0]
        atlas=out/(slug+'.png');ATLAS_ROWS=np.array(atlas_layout[slug]['rows'])/atlas_layout[slug]['height'];LEFT_LAYOUT=SOURCE_LAYOUTS[slug]
        if not atlas.exists():raise FileNotFoundError(atlas)
        row={'territory':theme[2],'location':loc,'mission':bag['Nickname'].split(' · ')[-1],'buildings':0,'states':0,'new_panels':0,'atlas':atlas.name}
        for obj in bag['ContainedObjects']:
            if obj.get('GUID') not in lookup[bag['GUID']]['buildings']:continue
            row['buildings']+=1;role=role_for(obj.get('Nickname',''));sign=sign_for(obj.get('Nickname',''),theme)
            for state in [obj,*obj.get('States',{}).values()]:
                m=state.get('CustomMesh')
                if not m:continue
                meshurl=m['MeshURL'];texurl=m['DiffuseURL']
                texture=sources.get(texurl)
                if texture is None and texurl.startswith('__LOBO_TEXTURE_ROOT__'):texture=root/'baseline/Textures'/texurl.rsplit('/',1)[-1]
                if texture is None:raise ValueError('Unresolved source texture '+texurl)
                key=(meshurl,texurl,slug,role,sign)
                if key not in meshes:
                    name=slug+'-'+hashlib.sha256('|'.join(map(str,key)).encode()).hexdigest()[:14]+'.obj'
                    stat=remesh(sources[meshurl],texture,out/name,role,sign);stat.update({'mesh':name,'location':loc,'source_mesh':meshurl,'source_texture':texurl});checks.append(stat);meshes[key]=(name,len(stat['panels']))
                name,panels=meshes[key];row['states']+=1;row['new_panels']+=panels
                m['MeshURL']=a.asset_base+'/'+name;m['DiffuseURL']=a.asset_base+'/'+atlas.name
                state['ColorDiffuse']={'r':1.,'g':1.,'b':1.}
                # No transforms, collider references, state IDs, scripts or controls change.
        audit.append(row);print(loc,row['mission'],row['buildings'],row['states'],flush=True)
    # Carry inherited local artwork bytes into the same immutable public release.
    legacy=out/'inherited-textures';legacy.mkdir(exist_ok=True)
    for path in (root/'baseline/Textures').iterdir():shutil.copy2(path,legacy/path.name)
    raw=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('__LOBO_TEXTURE_ROOT__',a.asset_base+'/inherited-textures')
    data=json.loads(raw);data['SaveName']='Lobo Infinity Maps - Aurora VII 24 Locations Visual Refresh - R1'
    export=root/'output';export.mkdir(exist_ok=True)
    (export/'Workshop-Save.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
    (out/'coverage.json').write_text(json.dumps(audit,indent=2));(out/'mesh-validation.json').write_text(json.dumps(checks,indent=2))
    print('COMPLETE',len(audit),'setups',len(meshes),'mesh variants',flush=True)

if __name__=='__main__':main()
