from pathlib import Path
import sys, json, math, copy
import numpy as np
from scipy.ndimage import label, distance_transform_edt
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
import reference_assets as old
old.ASSETS=ROOT/'assets'
ASSETS=old.ASSETS
Mesh=old.Mesh
uvrect=old.uvrect
PROFILES=copy.deepcopy(old.PROFILES)
PROFILES['scots-spears']['label']='SCOTTISH SCHILTRONS'
# Facial direction in the source, checked per front pose (riders, not horse heads).
DIRECTIONS={
 'scots-spears':[1,1,1], 'scots-light':[1,1,1],
 'scots-horse':[1,1,1], 'english-knights':[1,1,1],
 'english-foot':[1,1,1], 'english-bows':[1,1,-1],
 'scots-command':[1,1,1], 'english-command':[1,1,1],
}
STATS={
 'scots-spears':('Rigid Heavy · Spear',5,4,'+2 A',1),
 'scots-light':('Flexible Light · Foot',3,2,'+2 B',0),
 'scots-horse':('Flexible Light Cavalry · Spear',3,3,'+1 C',1),
 'english-knights':('Flexible Medium Cavalry · Lance',4,4,'+2 C',0),
 'english-foot':('Rigid Heavy · Spear',5,4,'+2 A',1),
 'english-bows':('Flexible Light · Bow',2,2,'None',0),
}

def atlas(name,p,wing=False):
    source=Image.open(ASSETS/(name+'-source.png')).convert('RGBA')
    a=Image.new('RGBA',(2048,2048),(52,38,24,255));a.paste(source,(0,0))
    d=ImageDraw.Draw(a);color=(36,77,168) if name.startswith('scots') else (174,32,37)
    d.rectangle((0,1536,2047,1791),fill=color)
    quality='WC' if wing else p['quality'];label='WING COMMANDER' if wing else p['label']
    # Identical information hierarchy to the approved Scottish Spearman plaque.
    if p.get('command'):
        middle=('SCOTS' if name.startswith('scots') else 'ENGLISH')+' · MOUNTED COMMAND'
        lower=('2 mounted figures' if wing else '3 mounted figures')+' · No CV/CB'
        d.text((22,1605),quality,font=ImageFont.truetype(old.BOLD,80),fill='white')
        d.line((145,1555,145,1773),fill='white',width=2)
        d.text((168,1565),label,font=ImageFont.truetype(old.BOLD,45),fill='white')
        d.text((168,1638),middle,font=ImageFont.truetype(old.FONT,29),fill='white')
        d.text((168,1704),lower,font=ImageFont.truetype(old.FONT,29),fill='white')
    else:
        d.text((50,1604),quality,font=ImageFont.truetype(old.BOLD,106),fill='white')
        d.line((265,1555,265,1773),fill='white',width=3)
        d.text((300,1550),label,font=ImageFont.truetype(old.BOLD,67),fill='white')
        middle,foot,mounted,cb,md=STATS[name]
        lower=f'CV Foot {foot}   CV Mounted {mounted}   CB {cb}   MD {md}'
        d.text((300,1631),middle,font=ImageFont.truetype(old.FONT,49),fill='white')
        d.text((300,1703),lower,font=ImageFont.truetype(old.FONT,42),fill='white')
    ground=Image.open(ASSETS/'ground-source.png').convert('RGB').resize((2048,256),Image.Resampling.LANCZOS)
    a.paste(ground,(0,1792));d=ImageDraw.Draw(a)
    for i,c in enumerate([(59,42,27),(117,82,44),(180,184,176),(31,42,27)]):d.rectangle((1920+i*32,2016,1951+i*32,2047),fill=c)
    key=name+('-wing' if wing else '');a.save(ASSETS/(key+'.png'),optimize=True)
    return source,key+'.png'

def base(m,round_base=False):
    # Same local convention as the proven Stirling reference: forward +Z,
    # rear plaque at -Z, its left edge at +X. The top is exposed, not inside rim.
    top=uvrect(50,1800,1870,2008);side=uvrect(1922,2018,1940,2030)
    if not round_base:
        m.box(-1.5,1.5,0,.15,-1.5,1.5,side)
        m.quad([(-1.5,.151,-1.5),(-1.5,.151,1.5),(1.5,.151,1.5),(1.5,.151,-1.5)],top)
        points=[(1.47,.17,-1.48),(-1.47,.17,-1.48),(-1.47,.43,-1.12),(1.47,.43,-1.12)]
    else:
        N=48
        for i in range(N):
            a=i*2*math.pi/N;b=(i+1)*2*math.pi/N;p=(math.cos(a),math.sin(a));q=(math.cos(b),math.sin(b))
            uv=lambda x,z:((x+1)/2*.88+.02,1-(1800+(z+1)/2*208)/2048)
            m.poly([(0,.15,0),(q[0],.15,q[1]),(p[0],.15,p[1])],[uv(0,0),uv(*q),uv(*p)])
            m.quad([(p[0],0,p[1]),(p[0],.15,p[1]),(q[0],.15,q[1]),(q[0],0,q[1])],side)
            m.poly([(0,0,0),(p[0],0,p[1]),(q[0],0,q[1])],[side[0]]*3)
        points=[(.70,.17,-.70),(-.70,.17,-.70),(-.70,.43,-.35),(.70,.43,-.35)]
    # Bottom-left, bottom-right, top-right, top-left. This is copied from the
    # known-good reference's UV ordering; the former plaque inverted the order.
    label=uvrect(0,1536,816 if round_base else 2048,1792)
    m.quad(points,[label[0],label[3],label[2],label[1]])

def sprite_info(im,p):
    # The original knight sheet crosses its nominal one-third column edges.
    # Assign connected silhouettes before triangulation, so a neighbouring tail
    # or hoof cannot become a detached shard on another figure's mesh.
    alpha=np.asarray(im)[:,:,3]>105;w,h=im.size;split=p.get('split',h//2);out=[]
    for row,(y0,y1) in enumerate([(0,split),(split,h)]):
        binary=alpha[y0:y1,:];labels,n=label(binary);sizes=np.bincount(labels.ravel());sizes[0]=0
        majors=list(np.argsort(sizes)[-3:]);majors.sort(key=lambda k:np.where(labels==k)[1].mean())
        seeds=np.where(np.isin(labels,majors),labels,0)
        nearest=distance_transform_edt(seeds==0,return_distances=False,return_indices=True)
        assigned=np.where(binary,seeds[nearest[0],nearest[1]],0)
        for col,k in enumerate(majors):
            mask=np.zeros_like(alpha);mask[y0:y1,:]=assigned==k;yy,xx=np.where(mask)
            box=(int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1)
            head=p['head'][row*3+col]
            if row and head<split:head+=split
            out.append({'box':box,'scale':p['body']/(box[3]-head),'mask':mask})
    return out

def sprite(m,im,info,cx,cz,back=False,fallen=False,angle=0,yoffset=0):
    alpha=info['mask'];x0,y0,x1,y1=info['box'];scale=info['scale'];mid=(x0+x1)/2
    angle=math.radians(angle);ca,sa=math.cos(angle),math.sin(angle)
    def transform(px,py):
        # Mirror geometry, never alter the source artwork or mirror its labels.
        # The front artwork now presents a right-facing pose in TTS.
        x=(px-mid)*scale*(1 if back else -1)*info.get('mirror',1);height=(y1-py)*scale
        if fallen:
            z=height-(y1-y0)*scale/2
            return (cx+x*ca-z*sa,.173+yoffset,cz+x*sa+z*ca)
        return (cx+x,.16+height,cz+(-.012 if back else .012))
    step=4 if im.height<=1100 else 5
    startv=len(m.v)
    for py in range(y0,y1,step):
        py1=min(py+step,y1);cols=np.any(alpha[py:py1,x0:x1],axis=0)
        edges=np.diff(np.r_[False,cols,False].astype(np.int8));starts=np.where(edges==1)[0];ends=np.where(edges==-1)[0]
        for a,b in zip(starts,ends):
            px=x0+a;px1=x0+b
            points=[transform(px,py1),transform(px,py),transform(px1,py),transform(px1,py1)]
            uv=uvrect(px,py,px1,py1)
            # Front +Z and rear -Z after reflection. Fallen fronts face upward.
            if fallen != (info.get('mirror',1)<0):points=points[::-1];uv=uv[::-1]
            m.quad(points,uv)
    return [list(np.min(np.asarray(m.v[startv:]),axis=0)),list(np.max(np.asarray(m.v[startv:]),axis=0))]

def layout(p,wing=False):
    count=2 if wing else p['count'];command=p.get('command',False)
    if command:
        positions=[(-.46,.04),(.46,.04)] if wing else [(-.46,.04),(.46,.04),(0,.59)]
    elif count==8:
        # Two files, four ranks: every complete mounted silhouette gets a lane.
        positions=[(x,z) for z in [1.14,.50,-.14,-.78] for x in [-.73,.73]]
    elif count==6 and p.get('mounted'):
        positions=[(x,z) for z in [1.04,.13,-.78] for x in [-.73,.73]]
    elif count==12:
        positions=[(x,z) for z in [1.00,.12,-.78] for x in [-.93,-.31,.31,.93]]
    else:positions=[(x,z) for z in [.86,-.70] for x in [-.92,0,.92]]
    return positions

def main():
    result={};checks=[]
    PROFILES['scots-horse']['mounted']=True;PROFILES['english-knights']['mounted']=True
    for name,p in PROFILES.items():
        for wing in ([False,True] if p.get('command') else [False]):
            im,tex=atlas(name,p,wing);info=sprite_info(im,p);key=name+('-wing' if wing else '')
            count=2 if wing else p['count'];command=p.get('command',False);positions=layout(p,wing)
            # One family-wide multiplier instead of shrinking edge horses.
            factor=1
            if p.get('mounted') or command:
                maxw=max((v['box'][2]-v['box'][0])*v['scale'] for v in info)
                factor=min(1,(.86 if command else 1.36)/maxw)
            prepared=[]
            for i,(x,z) in enumerate(positions):
                pose=(i%2)+1 if wing else i%3
                fr=info[pose].copy();bk=info[pose+3].copy()
                fr['mirror']=bk['mirror']=-DIRECTIONS[name][pose]
                f=factor
                if not (p.get('mounted') or command):
                    w=max((v['box'][2]-v['box'][0])*v['scale'] for v in [fr,bk]);f=min(1,2*(1.48-abs(x))/w)
                fr['scale']*=f;bk['scale']*=f;prepared.append((pose,fr,bk,x,z))
            files=[]
            for state in range(3):
                m=Mesh();base(m,command);lost=0 if state==0 else max(1,round(count*[0,.25,.5][state]));boxes=[]
                for i,(pose,fr,bk,x,z) in enumerate(prepared):
                    if i>=count-lost:
                        fr=fr.copy();ang=25+(i%3)*62
                        w=(fr['box'][2]-fr['box'][0])*fr['scale'];h=(fr['box'][3]-fr['box'][1])*fr['scale']
                        bound=max(abs(math.cos(math.radians(ang)))*w+abs(math.sin(math.radians(ang)))*h,abs(math.sin(math.radians(ang)))*w+abs(math.cos(math.radians(ang)))*h)
                        fr['scale']*=min(1,(1.15 if command else 1.85)/bound)
                        box=sprite(m,im,fr,0,.25,fallen=True,angle=ang,yoffset=.009*(i-(count-lost)))
                    else:
                        b1=sprite(m,im,fr,x,z);b2=sprite(m,im,bk,x,z,back=True)
                        box=[np.minimum(b1[0],b2[0]).tolist(),np.maximum(b1[1],b2[1]).tolist()]
                        boxes.append({'i':i,'pose':pose,'body_height':p['body']*(factor if (p.get('mounted') or command) else fr['scale']/info[pose]['scale']),'box':box})
                path=ASSETS/(key+'-'+str(state)+'.obj');m.write(path)
                vs=np.array(m.v)
                assert np.max(np.abs(vs[:,0]))<=1.501 and np.max(np.abs(vs[:,2]))<=1.501
                if command:assert np.max(np.hypot(vs[:,0],vs[:,2]))<1.001
                assert len(vs)<25000,(key,len(vs))
                if p.get('mounted') or command:
                    for i,a in enumerate(boxes):
                        for b in boxes[i+1:]:
                            # AABB disjoint in X or Z means no intersecting figure meshes.
                            assert any(a['box'][1][axis]+.025<b['box'][0][axis] or b['box'][1][axis]+.025<a['box'][0][axis] for axis in [0,2]),(key,state,a,b)
                    assert max(a['body_height'] for a in boxes)-min(a['body_height'] for a in boxes)<1e-8
                files.append(path.name);checks.append({'model':path.name,'standing':len(boxes),'fallen':lost,'figures':boxes,'vertices':len(vs)})
            result[key]={'meshes':files,'texture':tex,'figures':count,'command':command,'native_front':'+Z','native_rear_label':'-Z','source_directions':DIRECTIONS[name],'front_direction':'right'}
            print(key,'built',flush=True)
    (ROOT/'figure-manifest.json').write_text(json.dumps(result,indent=2))
    (ROOT/'geometry-checks.json').write_text(json.dumps(checks,indent=2))

if __name__=='__main__':main()
