from pathlib import Path
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy.ndimage import binary_fill_holes
R=Path(__file__).resolve().parent
A=R/'assets'
sys.path.insert(0,str(R/'reference'))
import geometry as G
front=Image.open(next(R.parent.glob('generated_images/exec-9d*.png'))).convert('RGB')
rear=Image.open(next(R.parent.glob('generated_images/exec-816*.png'))).convert('RGB')
ground=Image.open(R/'ground.png').convert('RGB')
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
BLUE=(35,75,154)
RED=(159,42,33)
manifest={}
checks=[]
def cut(image,c,r):
    edges=[0,365,725,1086,1448]
    if r==2 and image is rear: edges=[0,393,790,1086,1448]
    yy=[0,353,728,1086]
    im=image.crop((edges[c],yy[r],edges[c+1],yy[r+1]))
    rgb=np.asarray(im)
    mask=np.min(rgb,axis=2)<226
    # Preserve open spaces between limbs, bowstrings and spear shafts.
    im.putalpha(Image.fromarray(mask.astype('uint8')*255))
    return im.crop(im.getbbox())

def extend(im,upright,view,side):
    # The upright shaft occupies an isolated narrow strip. Enlarge that
    # strip about the hand before compositing it back into the pose.
    if upright:
        # Find the long, narrow uninterrupted spear column near that edge.
        mask=np.asarray(im.getchannel('A'))>0
        cols=np.where(mask[:18].sum(0)>4)[0]
        mid=int(np.median(cols))
        left=max(0,mid-10);right=min(im.width,mid+11)
        out=Image.new('RGBA',(im.width,im.height+52))
        out.alpha_composite(im,(0,52))
        # Reuse the original point and add shaft in the new space above the
        # old tip. The strip below shoulder height keeps the hands untouched.
        tip=im.crop((left,0,right,42))
        out.paste((0,0,0,0),(left,52,right,86))
        d=ImageDraw.Draw(out)
        d.line([(mid,32),(mid,91)],fill=(105,74,43),width=5)
        d.line([(mid-1,32),(mid-1,91)],fill=(179,136,76),width=1)
        out.alpha_composite(tip,(left,0))
        return out
    # Extend each angled weapon outside the grip along its existing axis.
    p0,p1={
        (0,0):((103,209),(336,90)),(1,0):((51,575),(343,452)),
        (0,1):((164,160),(316,312)),(1,1):((166,524),(321,675))
    }[side,view]
    # Coordinates above use the source row/cell; convert through its crop box.
    image=front if view==0 else rear
    cell=np.asarray(image.crop((365,[0,353][side],725,[353,728][side])))
    mask=np.min(cell,axis=2)<226
    ys,xs=np.nonzero(mask)
    x0,y0=int(xs.min()),int(ys.min())+[0,353][side]
    a=np.array(p0,dtype=float)-[x0,y0]; b=np.array(p1,dtype=float)-[x0,y0]
    # A full-length foreground spear with its own tip, aligned to the arm.
    # Remove detached original extension using the original silhouette below;
    # draw only beyond the visible butt to keep hand and point intact.
    vec=(a-b)/np.linalg.norm(a-b)
    pad=85
    out=Image.new('RGBA',(im.width+2*pad,im.height+2*pad))
    out.alpha_composite(im,(pad,pad))
    if view==0:
        # Identify the butt directly from the original art; the diagonal
        # rising from it is unchanged through the grip and bronze tip.
        a=np.array([max(0,426-365-x0),210-y0] if side==0 else [max(0,417-365-x0),578-y0],float)
        direction=np.array([-.92,.39])
    else:
        # Extend the upper-left end of the lowered rear shaft.
        a=np.array([523-365-x0,155-y0] if side==0 else [526-365-x0,519-y0],float)
        direction=np.array([-.72,-.69])
    d=ImageDraw.Draw(out)
    start=a+pad
    end=start+direction*(62 if view==0 else 80)
    d.line([tuple(end),tuple(start+(-direction)*4)],fill=(105,72,41),width=5)
    d.line([tuple(end+[0,-1]),tuple(start+(-direction)*3+[0,-1])],fill=(170,128,72),width=1)
    return out.crop(out.getbbox())

def write_atlas(key,images,color,title,typ='',stats='',command=False):
    out=Image.new('RGBA',(2048,2048),(66,47,29,255))
    sheet=Image.new('RGBA',(2048,1200))
    masks=[]
    for i,im in enumerate(images):
        x=(i%4)*500+8;y=(i//4)*580+8
        assert im.width<=490 and im.height<=570,(key,im.size)
        sheet.paste(im,(x,y))
        arr=np.zeros((1200,2048),dtype=bool)
        arr[y:y+im.height,x:x+im.width]=np.asarray(im.getchannel('A'))>0
        masks.append({'box':(x,y,x+im.width,y+im.height),'mask':arr,'mirror':-1})
    out.paste(sheet.convert('RGB'),(0,0))
    d=ImageDraw.Draw(out)
    d.rectangle((0,1536,2047,1791),fill=color)
    if command:
        size=67
        while ImageFont.truetype(BOLD,size).getlength(title)>756:size-=1
        d.text((408,1664),title,anchor='mm',font=ImageFont.truetype(BOLD,size),fill='white')
    else:
        d.text((135,1665),'R',anchor='mm',font=ImageFont.truetype(BOLD,112),fill='white')
        d.line((263,1555,263,1770),fill='white',width=3)
        for y,s,size,f in [(1548,title,68,BOLD),(1630,typ,50,FONT),(1704,stats,43,FONT)]:
            d.text((300,y),s,font=ImageFont.truetype(f,size),fill='white')
    out.paste(ground.resize((2048,256)),(0,1792))
    d=ImageDraw.Draw(out)
    for i,c in enumerate([(78,51,31),(126,98,55),(166,120,68),(75,89,41)]):
        d.rectangle((1920+i*32,2016,1951+i*32,2047),fill=c)
    out.convert('RGB').save(A/(key+'.jpg'),quality=92,subsampling=0,optimize=True)
    return sheet,masks

def models():
    for side,color,army,leader in [(0,BLUE,'egypt','Thutmose III'),(1,RED,'coalition','Prince of Kadesh')]:
        for role,cnt,typ,stats in [
          ('spears',12,'Rigid Heavy · Spear','CV Foot 5   CV Mounted 4   CB +2 A   MD 1'),
          ('bows',6 if side==0 else 4,'Flexible Light · Formed Bow' if side==0 else 'Unformed Skirmish · Bow Foot',
           'CV Foot 2   CV Mounted 2   CB —   MD 0' if side==0 else 'CV Foot 2   CV Mounted 2   CB +2 B   MD 0'),
          ('chariot',1,'Flexible Light · Missile Chariot','CV Foot 2   CV Mounted 2   CB —   MD 0'),
          ('command-army',3,'',''),('command-left',2,'',''),('command-right',2,'','')]:
            key=f'{army}-{role}'
            cmd=role.startswith('command')
            ch=role=='chariot'
            title=(leader if role.endswith('army') else ('Egyptian' if not side else 'Coalition')+' '+role.split('-')[-1].title()+' Wing') if cmd else (
                ('Egyptian' if not side else 'Canaanite')+' Spearmen' if role=='spears' else
                'Formed Archers' if role=='bows' and not side else 'Bow Skirmishers' if role=='bows' else 'Bow Chariot')
            meshes=[]; textures=[]
            for state in range(2 if cmd else 3):
                if ch:
                    im=cut(front if state==0 else rear,side,2)
                    # Shaken uses a darker, dust-stained version of the damaged team.
                    if state==2:
                        from PIL import ImageEnhance
                        alpha=im.getchannel('A')
                        im=ImageEnhance.Color(im.convert('RGB')).enhance(.69)
                        im=ImageEnhance.Brightness(im).enhance(.80)
                        im.putalpha(alpha)
                    images=[im,im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)]
                elif cmd:
                    officer=cut(front if state==0 else rear,2+side,2)
                    guard=cut(front,3,side)
                    images=[officer,guard,officer,cut(rear,3,side)]
                else:
                    cols=[0,1] if role=='spears' else [2,3]
                    images=[]
                    for view,source in enumerate([front,rear]):
                        for c in cols:
                            im=cut(source,c,side)
                            if role=='spears': im=extend(im,c==0,view,side)
                            images.append(im)
                texkey=key+f'-{state}' if cmd or ch else key
                im,info=write_atlas(texkey,images,color,title,typ,stats,cmd)
                for v in info:
                    x0,y0,x1,y1=v['box']
                    v['scale']=2.72/(x1-x0) if ch else min((1.73 if role=='spears' else 1.43 if not cmd else .96)/(y1-y0),((.61 if v is info[0] or v is info[2] else 1.36) if cnt==12 else .82 if cmd else 1.11)/(x1-x0))
                # Tilt the angled spear silhouette back into the base plane
                # using narrow file spacing while retaining its full outline.
                if ch:positions=[(0,.15,0)]
                elif cmd:positions=[(-.43,.02,1),(.43,.02,1)]+([(0,.63,0)] if cnt==3 else [])
                elif cnt==12:positions=[(x,z,0) for z in [1.07,.02] for x in [-.96,-.32,.32,.96]]+[(x,z,1) for z in [.55,-.73] for x in [-.75,.75]]
                elif cnt==6:positions=[(x,z,i%2) for z in [.88,-.68] for i,x in enumerate([-1.0,0,1.0])]
                else:positions=[(x,z,i%2) for z in [.88,-.68] for i,x in enumerate([-.72,.72])]
                m=G.Mesh(); G.base(m,cmd)
                lost=0 if cmd or ch or state==0 else max(1,round(cnt*[0,.25,.5][state]))
                boxes=[]
                for i,(x,z,pose) in enumerate(positions):
                    f=info[pose]
                    b=info[1] if ch else info[pose+2]
                    if i>=cnt-lost:
                        local=dict(f)
                        w=f['box'][2]-f['box'][0];h=f['box'][3]-f['box'][1]
                        angle=[31,137,54,112,75,153][i-(cnt-lost)]
                        local['scale']=min(f['scale'],2.58/math.hypot(w,h))
                        G.sprite(m,im,local,0,0,fallen=True,angle=angle,yoffset=.015*(i-(cnt-lost)))
                    else:
                        a=G.sprite(m,im,f,x,z);q=G.sprite(m,im,b,x,z,back=True)
                        boxes.append((np.minimum(a[0],q[0]),np.maximum(a[1],q[1])))
                for i,(lo,hi) in enumerate(boxes):
                    for l2,h2 in boxes[i+1:]:
                        assert any(hi[k]+.01<l2[k] or h2[k]+.01<lo[k] for k in [0,2]),(key,state,i)
                v=np.array(m.v)
                assert (np.max(np.hypot(v[:,0],v[:,2]))<=1.001 if cmd else np.max(abs(v[:,[0,2]]))<=1.501),(key,state)
                mesh=key+f'-{state}.obj';m.write(A/mesh)
                meshes.append(mesh);textures.append(texkey+'.jpg')
                checks.append({'mesh':mesh,'standing':cnt-lost,'fallen':lost,'vertices':len(v),'right_facing':True})
            manifest[key]={'meshes':meshes,'textures':textures,'figures':cnt,'title':title}
    (R/'figure-manifest.json').write_text(json.dumps(manifest,indent=2))
    (R/'geometry-checks.json').write_text(json.dumps(checks,indent=2))

def terrain(x,z):
    # Restrict relief to the shoulders and set an open pass 13 inches wide.
    near=np.clip((z-15)/12,0,1)
    lateral=np.clip((abs(x)-6.4)/15,0,1)
    shoulder=3.0*near**2*lateral**2*(.72+.28*np.cos((abs(x)-23)/10)**2)
    camp=.30*np.exp(-((x-22)/15)**4-((z+29)/8)**4)
    return .16+shoulder+camp
def field():
    xx,zz=np.meshgrid(np.arange(-48,49),np.arange(-36,37))
    hh=np.round(terrain(xx,zz),5)
    grid={'nx':96,'nz':72,'x0':-48,'z0':-36,'stepX':1,'stepZ':1,'clearance':.012,'heights':hh.ravel().tolist()}
    (R/'surface-grid.json').write_text(json.dumps(grid))
    lines=['v %.5f %.5f %.5f'%(-x,y,z) for x,y,z in zip(xx.ravel(),hh.ravel(),zz.ravel())]
    lines+=['vt %.7f %.7f'%((x+48)/96,(z+36)/72) for x,z in zip(xx.ravel(),zz.ravel())]
    for j in range(72):
        for i in range(96):
            a=j*97+i+1;b=a+1;c=a+97;d=c+1
            lines+=['f '+' '.join(f'{k}/{k}' for k in t) for t in [(a,b,d),(a,d,c)]]
    (A/'field.obj').write_text('\n'.join(lines)+'\n')
    w,h=1800,1350
    x,z=np.meshgrid(np.linspace(-48,48,w),np.linspace(36,-36,h))
    base=np.asarray(ground.resize((600,450)),dtype=np.float32)
    img=np.tile(base,(3,3,1))
    def tint(amount,color):
        nonlocal img
        img=img*(1-amount[:,:,None])+np.array(color)*amount[:,:,None]
    tint(.50*np.clip((terrain(x,z)-.25)/2.3,0,1),(91,95,61))
    center=(np.maximum(0,20-z)/56)**1.7*22
    tint(.45*np.exp(-((x-center)/2.65)**4),(197,168,120))
    camp=(abs(x-22)<13)&(abs(z+27)<7)
    tint(camp*.34,(147,121,79))
    tint(.45*np.exp(-((abs(x-22)-13)/.4)**2)*(abs(z+27)<7),(113,88,51))
    tint(.45*np.exp(-((abs(z+27)-7)/.4)**2)*(abs(x-22)<13),(113,88,51))
    Image.fromarray(np.uint8(np.clip(img,0,255))).save(A/'field.jpg',quality=84,optimize=True)
    m=G.Mesh();rng=np.random.default_rng(1457);roots=[]
    for side in [-1,1]:
        for i in range(10):
            x=side*(20+rng.uniform(0,20));z=rng.uniform(23,34)
            y=min(float(terrain(x+dx,z+dz)) for dx in [-.10,.10] for dz in [-.10,.10])-.03
            roots.append({'world_x':x,'world_z':z,'root_y':y,'ground_y':float(terrain(x,z))})
            height=rng.uniform(1.5,2.5)
            m.box(-x-.10,-x+.10,y,y+height,z-.10,z+.10,G.uvrect(1955,2020,1970,2030))
            for j in range(7):
                ang=j*math.tau/7;dx,dz=np.cos(ang),np.sin(ang)
                p=[(-x,y+height+.45,z),(-x-.62*dx+.27*dz,y+height,z+.62*dz+.27*dx),(-x-1.05*dx,y+height-.28,z+1.05*dz),(-x-.62*dx-.27*dz,y+height,z+.62*dz-.27*dx)]
                u=G.uvrect(2018,2020,2035,2032);m.quad(p,u);m.quad(p[::-1],u[::-1])
    # Camps are scenic along their far edge, keeping the scoring zone clear.
    for x in [12,19,26,33]:
        z=-32.7;y=float(terrain(x,z))-.025
        p=[(-x-1.25,y,z-1),(-x+1.25,y,z-1),(-x+1.25,y,z+1),(-x-1.25,y,z+1)]
        a=(-x,y+1.32,z-1);b=(-x,y+1.32,z+1)
        uv=G.uvrect(1987,2020,2000,2032)
        for q in [(p[0],a,b,p[3]),(p[1],p[2],b,a)]:
            m.quad(q,uv);m.quad(q[::-1],uv[::-1])
    m.write(A/'palms.obj')
    (R/'tree-root-checks.json').write_text(json.dumps(roots,indent=2))
if __name__=='__main__':
    field()
    models()
