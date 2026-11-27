"""Objects for the crew bay and two laboratory-specific native building attachments."""
from common import *
from PIL import Image,ImageDraw,ImageFont
import math,random
import numpy as np
import materials,model
from model import Model,v3
from scipy.ndimage import gaussian_filter

EXTRA=['shade','culture','film','wire','bay-id','assay-id','algae-id','jack-id']
materials.KEYS=materials.KEYS+EXTRA
materials.ROWS=7
model.ASSETS=OUT
def font(n):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',n)
def plaque(k,big,sub,tag):
    im=Image.new('RGB',(256,256),(34,50,56));d=ImageDraw.Draw(im)
    d.rectangle((7,7,248,248),outline=(143,163,163),width=3)
    d.rectangle((11,12,244,50),fill=(199,149,78));d.text((18,16),'KESTREL   /   '+tag,font=font(24),fill=(28,39,42))
    d.multiline_text((16,64),big,font=font(43),fill=(225,230,211),spacing=0)
    d.line((15,178,241,178),width=2,fill=(149,167,159));d.text((16,187),sub,font=font(13),fill=(233,226,204))
    for i in range(24):
        a=17+i*4;d.rectangle((a,216,a+1+(i%3==1),230),fill=(158,178,169))
    for x in [12,242]:
        for y in [12,240]:d.ellipse((x-2,y-2,x+2,y+2), fill=(172,179,174))
    return im
def atlas():
    orig=Image.open(ASSETS/'station-finishes.jpg').convert('RGB')
    a=Image.new('RGB',(1024,1792));a.paste(orig,(0,0))
    rng=np.random.default_rng(3542);Y,X=np.mgrid[:256,:256]
    for key,color in [('shade',(137,113,81)),('culture',(61,124,66)),('film',(97,155,90)),('wire',(103,110,110))]:
        rnd=rng.normal(0,1,X.shape);coarse=gaussian_filter(rnd,6);coarse/=max(coarse.std(),.00001)
        variation=2*rnd+coarse*3
        if key=='shade':
            variation+=np.maximum(0,np.sin((X+6*np.sin(Y/95))*.082)-.63)*16+np.abs(np.sin(Y*.044+X*.008))*5
        elif key in ('culture','film'):
            variation+=10*np.sin(X/24)**6+4*np.sin(X*.021+Y*.084)+rnd*1.2
        else:
            variation+=np.where((X+Y)%12<2,15,0)+np.where((X-Y)%12<2,8,0)
        tex=Image.fromarray(np.uint8(np.clip(np.array(color)+variation[:,:,None],0,255)))
        a.paste(tex,materials.rect(key))
    for args in [('bay-id','ROVER\nSERVICE','EVA MAINTENANCE  /  BAY 02','M2'),('assay-id','SAMPLE\nASSAY','THERMAL BAFFLES  /  LAB','A1'),('algae-id','CULTURE\nLAB','BIOREACTOR  /  ALGAE LOOP','B2'),('jack-id','JACK\nSTATION','MECHANICAL LIFT  /  CHOCKS','M2')]:
        a.paste(plaque(*args),materials.rect(args[0]))
    a.save(OUT/'lab-and-bay-finishes.jpg',quality=92,optimize=True)
    orig.paste(plaque('drill','CORE\nRIG','WEST FIELD   /   GEOLOGY','05'),materials.rect('drill'))
    orig.save(OUT/'field-rig-finishes.jpg',quality=90,optimize=True)
    Image.new('RGBA',(64,64),(223,239,231,172)).save(OUT/'culture-glass.png')

def thermal_shutters():
    q=Model()
    def pos(lat,lon,offset):
        u,v=np.radians([lat,lon]);c=math.cos(u)
        pt=v3((3.06*c*math.cos(v),.72+3.*math.sin(u),2.03*c*math.sin(v)))
        n=v3((c*math.cos(v)/3.06,math.sin(u)/3.,c*math.sin(v)/2.03));n/=np.linalg.norm(n)
        return pt+n*offset
    # All shutter plates mount on the far side of the glazed shell, away from the entrance.
    for col in range(8):
        for row in range(4):
            a=6+col*15;h=10+row*14.3
            corners=[(h,a),(h,a+14),(h+13,a+14),(h+13,a)]
            top=[pos(t,b,.18)for t,b in corners];lower=[pos(t,b,.115)for t,b in corners];c=np.vstack([top,lower]).mean(0)
            parts=[(q.m,top,lower,c)]
            if row%2==0:
                low=h;high=h+14.3+13.0
                shell=[(low,a),(low,a+14),(high,a+14),(high,a)]
                outside=[pos(t,b,.18) for t,b in shell];inside=[pos(t,b,.115) for t,b in shell]
                parts.append((q.c,outside,inside,np.vstack([outside,inside]).mean(0)))
            for dest,top,lower,c in parts:
                dest.part();dest.face(top,'shade',c);dest.face(lower[::-1],'graphite',c)
                for i in range(4):j=(i+1)%4;dest.face([lower[i],lower[j],top[j],top[i]],'steel',c)
            if row!=3:
                q.tube(pos(h+11.65,a+.4,.185),pos(h+11.65,a+13.8,.185),.024,'steel',7)
    for a in [6,36,66,96,126]:
        pts=[pos(t,a,.215)for t in np.linspace(9,69,9)];q.pipe(pts,.047,'graphite')
        for t in [13,40,63]:q.tube(pos(t,a,.222),pos(t,a,.255),.055,'steel',8)
    # Drawing the actuator housing as two different metals also makes the hinge legible at table scale.
    for a in [23,112]:
        q.tube(pos(13,a,.20),pos(34,a,.21),.072,'graphite',10)
        q.tube(pos(34,a,.21),pos(44,a,.20),.045,'steel',8)
    return q
def cultures():
    q=Model()
    # Native planting benches occupy both sides of the aisle. The closed culture pipes
    # sit above the original trays, and leave the doorway and central floor accessible.
    for side in [-1,1]:
        x=side*1.30
        for z in [-.69,1.00]:
            for dx in [-.36,.36]:
                q.shell((x+dx,1.12,z),(.07,.41,.075),'steel',.01)
            q.solid((x,1.36,z),(.84,.11,.13),'ivory',.03)
        for j in range(4):
            xx=x-.291+j*.194
            q.tube((xx,1.44,-.82),(xx,1.44,1.12),.082,'culture' if j%2 else 'film',14)
            for z in [-.83,-.69,.96,1.10]:q.tube((xx,1.44,z-.024),(xx,1.44,z+.024),.095,'ivory',10)
            q.tube((xx+.026,1.508,-.65),(xx+.026,1.508,.93),.012,'film',6)
        for z in [-.89,1.17]:
            q.tube((x-.37,1.43,z),(x+.37,1.43,z),.070,'teal',12)
        q.c.box((x,1.43,.14),(.77,.17,1.93),'culture',.025)
        q.shell((x,1.435,-.97),(.61,.19,.13),'graphite',.025)
        q.tube((x+.16,1.52,-.97),(x+.16,1.57,-.97),.067,'saffron',10)
    return q
def rover_bay():
    q=Model()
    # The deck and ramp are in the base terrain. Cutouts at each end of the
    # solid outboard equipment screen give access to the tooling side of the bay.
    for z in [-1.54,0,1.54]:
        q.solid((1.15,.12,z),(.47,.56,.32),'graphite',.05)
        q.shell((1.14,1.12,z),(.38,2.12,.135),'steel',.025)
    q.solid((1.18,.99,0),(.29,2.16,3.66),'teal',.08)
    q.shell((1.15,2.11,0),(.42,.11,3.72),'ivory',.035)
    for z in [-1.21,0,1.23]:
        q.shell((1.025,1.27,z),(.073,1.21,1.13),'ivory',.045)
        for k in range(3):
            q.shell((.98,.90+k*.106,z),(.025,.046,.78),'graphite',.003)
        q.shell((.968,1.68,z),(.04,.13,.79),'saffron',.01)
    for z in [-1.72,-.59,.6,1.72]:
        for yy in [.49,1.9]:q.tube((1.015,yy,z),(.974,yy,z),.042,'steel',8)
    # Two-sided end sign also reads from the crew approach.
    q.shell((.77,1.71,-1.66),(.55,.45,.10),'graphite',.028)
    q.m.label((.77,1.71,-1.718),.51,.41,'bay-id',-1)
    # A compliant wire-mesh lunar wheel in a chock. Spokes surround an open hub.
    cy,cz=.63,.64;cx=.54;rad=.66;N=24;angles=np.linspace(0,2*math.pi,N+1)
    def hoop(x,r,thick,metal):
        pts=[(x,cy+r*math.cos(a),cz+r*math.sin(a)) for a in angles];q.pipe(pts,thick,metal)
    for off,r in [(-.195,.62),(.195,.62),(0,.655)]:hoop(cx+off,r,.040,'wire')
    for off in [-.17,.17]:hoop(cx+off,.39,.047,'steel')
    for a in angles[:-1]:
        def at(off,ra,angle):return (cx+off,cy+ra*math.cos(angle),cz+ra*math.sin(angle))
        q.tube(at(-.19,rad-.04,a),at(.19,rad-.04,a+.22),.022,'wire',6)
        q.tube(at(-.19,rad-.04,a),at(.19,rad-.04,a-.22),.019,'steel',6)
    for a in angles[:-1:2]:
        q.tube(at(-.15,.14,a-.10),at(-.17,.39,a),.036,'ivory',7)
        q.tube(at(.15,.14,a-.10),at(.17,.39,a),.036,'graphite',7)
    q.tube((cx-.2,cy,cz),(cx+.2,cy,cz),.14,'steel',14)
    for z in [.28,1.00]:q.solid((cx,-.048,z),(.59,.185,.19),'saffron',.04)
    q.c.tube((cx-.17,cy,cz),(cx+.17,cy,cz),.64,'wire',12)
    # Low lifting table, crossed screw jack arms and the two stops for the wheel.
    ax,az=-.24,-.93
    q.solid((ax,-.027,az),(1.14,.22,.68),'graphite',.12)
    for xx in [-.45,.45]:
        q.shell((ax+xx,.10,az),(.18,.21,.62),'saffron',.036)
    for zz in [-.20,.20]:
        for x0,x1 in [(-.41,.39),(.41,-.39)]:
            q.tube((ax+x0,.13,az+zz),(ax+x1,.66,az+zz),.059,'saffron',8)
        q.tube((ax,.39,az+zz-.02),(ax,.39,az+zz+.02),.095,'steel',10)
    q.solid((ax,.69,az),(.70,.14,.55),'steel',.055)
    q.shell((ax,.78,az),(.51,.06,.39),'seal',.05)
    q.tube((ax-.58,.38,az),(ax+.56,.38,az),.041,'steel',8)
    q.pipe([(ax-.55,.38,az),(ax-.69,.38,az),(ax-.69,.54,az),(ax-.83,.54,az)],.029,'graphite')
    # Toe strips stop at the ramp rather than spanning the approach.
    q.solid((-1.31,-.035,.36),(.10,.15,2.93),'steel',.02)
    return q
if __name__=='__main__':
    atlas()
    for name,item in [('assay-shutters',thermal_shutters()),('algae-rows',cultures()),('rover-service-bay',rover_bay())]:
        item.save(name)
