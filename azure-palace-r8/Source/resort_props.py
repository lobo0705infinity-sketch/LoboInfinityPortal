"""Freestanding objects for Azure Palace. All sizes are in tabletop inches."""
import math
import numpy as np
from prop_mesh import Mesh, ring_rect
from finish import build as finishes

def case(m,xyz,size,material,angle,style):
    w,d,h=size
    q=m.at(xyz,(0,0,angle));z=h*.5
    q.box((0,0,z),(w,d,h),material,r=.06,b=.037,physical=True)
    if style=='shell':
        for xx in np.linspace(-w*.36,w*.36,6):
            for s in (-1,1):
                q.box((xx,s*(d/2+.003),z),(.021,.017,h*.75),'alloy',.005,.004,n=1)
    else:
        for xx in (-w*.30,w*.30):
            q.box((xx,-d/2-.006,z),(.035,.013,h*.90),'web',.005,.002,n=1)
            q.box((xx,0,h+.002),(.035,d*.92,.012),'web',.003,.002,n=1)
            q.box((xx,d/2+.006,z),(.035,.013,h*.90),'web',.005,.002,n=1)
            q.box((xx,-d/2-.017,z+.04),(.049,.014,.051),'brass',.005,.003,n=1)
    q.path([(-.078,0,h),(-.070,0,h+.051),(.070,0,h+.051),(.078,0,h)],.013,'grip',6)
    if style=='tag':
        q.box((w*.19,-d/2-.023,h*.69),(.095,.012,.16),'label',.009,.003,rot=(0,-12,0),n=1)

def buggy():
    m=Mesh('porter-buggy')
    # The front of the cart faces positive Y. The footwell stays open on both sides.
    m.box((0,-.04,.385),(1.26,3.10,.145),'iron',.12,.032,physical=True)
    m.box((0,.235,.50),(1.17,1.52,.13),'enamel',.12,.034,physical=True)
    m.box((0,.33,.573),(1.12,.72,.021),'grip',.038,.006)
    for x in (-.58,.58):
        m.box((x,.283,.435),(.15,.83,.07),'rubber',.045,.014)
    # Formed front cowl and rear fenders follow the tyres.
    m.rings([[(x,y+1.12,z) for x,y in ring_rect(w,d,r,4)] for z,w,d,r in
             [(.49,1.31,.77,.16),(.61,1.40,.83,.17),(.80,1.37,.77,.17),(.895,1.19,.65,.14)]],'enamel',True)
    m.rings([[(x,y+1.10,z) for x,y in ring_rect(w,d,r,4)] for z,w,d,r in
             [(.813,1.32,.71,.14),(.885,1.34,.67,.14),(1.02,1.15,.45,.12),(1.046,1.07,.40,.10)]],'ivory',True)
    m.box((0,1.559,.46),(1.27,.095,.14),'rubber',.036,.024)
    m.box((0,-1.576,.43),(1.24,.103,.13),'rubber',.040,.021)
    for x in (-.48,.48):
        m.box((x,1.529,.704),(.237,.050,.119),'iron',.025,.012)
        m.box((x,1.557,.719),(.213,.021,.064),'lights',.016,.007)
        m.box((x,1.557,.662),(.161,.020,.032),'amber',.007,.004)
    m.box((0,1.523,.682),(.49,.063,.108),'iron',.031,.014)
    for zz in (.654,.681,.706):
        m.box((0,1.560,zz),(.416,.016,.010),'alloy',.004,.002)
    for x in (-.54,.54):
        m.tube((x,1.603,.464),(x,1.613,.464),.024,'steel',7)
    for x in (-.63,.63):
        m.box((x,-.945,.655),(.158,1.25,.192),'enamel',.069,.037,physical=True)
    m.box((0,-.988,.613),(1.27,1.20,.29),'enamel',.065,.041,physical=True)
    m.box((0,-1.002,.817),(1.41,1.27,.126),'alloy',.055,.024,physical=True)
    m.box((0,-1.012,.888),(1.28,1.15,.032),'iron',.034,.009)
    # Real sidewalls, split rim and hub flange, visible from both sides.
    for y in (1.065,-1.077):
        for s in (-1,1):
            x=s*.653;r=.315
            m.tyre((x,y,r),r,.206,'tyre',24);face=x+s*.102
            m.tube((face-s*.008,y,r),(face+s*.018,y,r),.184,'steel',20)
            m.tube((face+s*.017,y,r),(face+s*.035,y,r),.110,'alloy',16,r2=.087)
            m.tube((face+s*.032,y,r),(face+s*.042,y,r),.045,'iron',12)
            sidewall=[(face+s*.002,y+rr*math.cos(a),r+rr*math.sin(a))for rr in (.224,.231)for a in np.arange(18)*math.tau/18]
            band=[[i,(i+1)%18,(i+1)%18+18,i+18]for i in range(18)]
            m.surface(sidewall,band if s<0 else [row[::-1]for row in band],'grip')
            # Shallow chevrons on the rounded running surface leave a distinct worn centre stripe.
            for u in np.arange(18)*math.tau/18:
                for side in (-1,1):
                    faceverts=[]
                    for width,phase in [(side*.009,-.021),(side*.060,.047),(side*.061,.086),(side*.009,.015)]:
                        radius=r*(1.0035 if abs(width)<.02 else .992)
                        faceverts.append((x+width,y+radius*math.cos(u+phase),r+radius*math.sin(u+phase)))
                    seq=[0,1,2,3] if side<0 else [3,2,1,0]
                    m.surface(faceverts,[seq],'grip')

            for ang in np.arange(4)*math.pi/2+.7:
                yy=y+.132*math.cos(ang);zz=r+.132*math.sin(ang)
                m.tube((face+s*.017,yy,zz),(face+s*.027,yy,zz),.020,'iron',6)
    # Bench stitching, seam welt and exposed handrails.
    m.box((0,-.184,.705),(1.12,.66,.28),'ivory',.075,.041,physical=True)
    m.box((0,-.145,.893),(1.105,.55,.14),'leather',.089,.045,physical=True)
    m.box((0,-.424,1.12),(1.10,.128,.49),'leather',.064,.046,rot=(-8,0,0),physical=True)
    for x in (-.28,0,.28):
        m.box((x,-.125,.962),(.009,.322,.008),'grip',.003,.002)
        m.box((x,-.344,1.14),(.008,.011,.269),'grip',.003,.002,rot=(-8,0,0))
    for s in (-1,1):
        x=.592*s
        m.path([(x,.054,.824),(x,.050,1.018),(x,-.03,1.066),(x,-.33,1.066),(x,-.41,1.015),(x,-.42,.83)],.024,'iron',7)
        m.tube((x,.975,.883),(x,.67,1.76),.025,'iron',8,True)
        m.tube((x,-.426,.85),(x,-.539,1.76),.024,'iron',8,True)
    m.box((0,.113,1.795),(1.435,1.67,.095),'ivory',.153,.039,physical=True,n=4)
    m.box((0,.115,1.846),(1.30,1.51,.033),'ivory',.141,.014,n=3)
    m.box((0,.846,.925),(1.016,.17,.105),'iron',.034,.016)
    m.tube((-.248,.753,.72),(-.248,.553,1.086),.030,'iron',10)
    center=np.array([-.248,.551,1.088]);normal=np.array([0,-.49,.87]);u=np.array([1,0,0]);v=np.cross(normal,u)
    m.hoop(center,normal,.140,.015,'grip',16,6)
    for angle in (0,2.1,4.2):
        m.tube(center,center+.135*(u*math.cos(angle)+v*math.sin(angle)),.011,'iron',6)
    for s in (-1,1):
        m.path([(s*.647,-1.53,.868),(s*.647,-1.51,1.016),(s*.647,-1.46,1.045),(s*.647,-.544,1.045),(s*.647,-.493,1.006),(s*.647,-.493,.87)],.021,'steel',7)
        m.box((s*.49,-1.636,.596),(.13,.023,.066),'amber',.016,.009)
    # Cases vary in build and height. A tightening strap actually goes over the load.
    case(m,(-.323,-1.193,.903),(.53,.47,.64),'alloy',-2,'shell')
    case(m,(.270,-1.266,.903),(.54,.45,.49),'marine',3,'tag')
    case(m,(.041,-.762,.903),(.93,.35,.419),'saddle',-3,'tag')
    satchel=m.at((-.025,-.776,1.328),(0,0,-6))
    satchel.rings([[(x,y,z) for x,y in ring_rect(w,d,r,2)] for z,w,d,r in
                   [(0,.44,.24,.035),(.055,.54,.29,.068),(.171,.49,.255,.077),(.233,.35,.161,.069)]],'green',True)
    for xx in (-.139,.139):
        satchel.path([(xx,-.089,.21),(xx,-.066,.28),(xx,.044,.29),(xx,.091,.21)],.012,'saddle',6)
    for xx,yy,zz in [( .553,-1.24,1.18),(-.596,-1.19,1.27)]:
        m.box((xx,yy,zz),(.015,.109,.16),'label',.010,.004,rot=(9,0,0),n=1)

    for s in (-1,1):
        m.tube((s*.594,-.698,.888),(s*.469,-.698,1.305),.012,'web',6)
    m.box((.034,-.705,1.341),(.938,.036,.012),'web',.004,.002)
    m.write()

def lounger(q,stacked=False):
    # Formed aluminium sides carry individual rounded, weathered teak slats.
    for s in (-1,1):
        x=s*.359
        q.path([(x,-.945,.385),(x,-.915,.403),(x,.304,.403),(x,.431,.447),(x,.941,.828)],.026,'steel',7)
        if stacked:
            q.path([(x,-.70,.398),(x,-.807,.205),(x,-.844,.19)],.022,'alloy',7)
            q.path([(x,.414,.452),(x,.54,.213),(x,.62,.192)],.022,'alloy',7)
        else:
            q.path([(x,-.763,.394),(x,-.876,.035),(x,-.849,.018)],.027,'steel',8)
            q.path([(x,.395,.419),(x,.548,.056),(x,.621,.027)],.027,'steel',8)
            q.path([(x,.65,.619),(x,.77,.29),(x,.40,.276)],.015,'iron',6)
    for y in (-.788,.178,.707):
        z=.390 if y<.31 else .438+(y-.414)*.75
        q.tube((-.359,y,z),(.359,y,z),.018,'iron',7)
    for i in range(13):
        y=-.891+i*.093
        q.box((0,y,.421),(.671,.080,.034),'teak',.014,0,n=1)
    for j in range(8):
        u=.044+j*.082; ang=math.radians(36)
        q.box((0,.310+u*math.cos(ang),.422+u*math.sin(ang)),(.671,.072,.034),'teak',.011,0,rot=(36,0,0),n=1)
    q.solid([(-.349,-.93,.368),(.349,-.93,.368),(-.349,.332,.368),(.349,.332,.368),(-.349,-.93,.44),(.349,-.93,.44),(-.349,.332,.44),(.349,.332,.44)])
    a=np.array([0,.316,.425]); b=np.array([0,.949,.842])
    q.solid([p+[x,0,z]for p in (a,b)for x in (-.35,.35)for z in (-.02,.02)])

def folded_towel(q):
    # A terry towel deforms over the slats and down the side. Woven stripe follows the drape.
    path=[(-.20,.473),(-.06,.485),(.11,.467),(.27,.476),(.345,.448),(.382,.388),(.398,.273),(.415,.155),(.439,.091)]
    nu=len(path);ny=9;verts=[];faces=[];uv=[]
    for j in range(ny):
        for i,(x,z) in enumerate(path):
            t=j/(ny-1);v=i/(nu-1)
            amp=.013+.018*max(0,(i-4)/4)
            v_wave=amp*math.cos(t*14.8+v*3.2)+.005*math.sin(t*23.1+v)
            verts.append((x+(.012*math.sin(t*9) if i>4 else 0),-.29+(t-.5)*.53+.023*v,z+v_wave))
    for j in range(ny-1):
        for i in range(nu-1):
            a=j*nu+i;face=[a,a+1,a+1+nu,a+nu];faces.append(face)
            uv.append([(j/(ny-1),i/(nu-1)),(j/(ny-1),(i+1)/(nu-1)),((j+1)/(ny-1),(i+1)/(nu-1)),((j+1)/(ny-1),i/(nu-1))])
    q.surface(verts,faces,'stripe',smooth=True,manual=uv)
    back=[(x,y,z-.007)for x,y,z in verts];q.surface(back,[f[::-1]for f in faces],'cream',smooth=True)
    for j in range(ny-1):
        a=verts[j*nu+nu-1];b=verts[(j+1)*nu+nu-1]
        for t in (.1,.5,.9):
            p=np.array(a)*(1-t)+np.array(b)*t;q.tube(p,p+[.008,0,-.025],.0042,'linen',4)

def loungers():
    m=Mesh('pool-loungers');stack=m.at((-.53,.04,0),(0,0,-2))
    for x in (-.31,.31):
        for y in (-.68,.61):stack.wheel(x,y,.083)
    for xx in (-.326,.326):
        stack.box((xx,-.012,.202),(.088,1.63,.074),'steel',.023,.010,physical=True)
    for yy in (-.76,.639):
        stack.box((0,yy,.207),(.726,.092,.075),'iron',.021,.009,physical=True)
    for i in range(4):
        q=stack.at((.008*math.sin(i),i*.040,.051+.114*i))
        lounger(q,True)
    single=m.at((.566,-.135,0),(0,0,9))
    lounger(single);folded_towel(single)
    # Feet and rear wheels at ground level support the open chair.
    for x in (-.355,.355):
        single.tyre((x,.663,.09),.09,.058,'rubber',12)
        single.solid([(x+dx,y,z)for dx in (-.029,.029)for y,z in [(-.903,.006),(-.852,.006),(-.735,.407),(-.780,.407)]])
    m.write()

def tables():
    m=Mesh('banquet-dolly')
    for x in (-.57,.57):
        for y in (-.35,.35):m.wheel(x,y,.112)
    for x in (-.621,.621):
        m.box((x,0,.282),(.073,.903,.092),'iron',.014,.012,physical=True)
    for y in (-.43,.43):
        m.box((0,y,.282),(1.31,.075,.093),'steel',.024,.012,physical=True)
    for x in (-.32,.32):
        m.box((x,0,.317),(.079,.79,.073),'rubber',.010,.008)
    # Four folded tables, circular in silhouette. The near table shows its bolted folding legs.
    radius=.785
    for i in range(4):
        center=(.015*math.sin(i),-.263+.169*i,1.026+.008*math.cos(i))
        q=m.at(center,(1.5+.8*i,0,(-1)**i*.7))
        q.tube((0,-.039,0),(0,.039,0),radius,'plywood',36,True)
        q.hoop((0,-.0195,0),(0,1,0),radius-.003,.013,'edge',36,5)
        k=1;yy=.062
        for side in (-1,1):
            xx=side*.338
            q.box((xx,yy,.035),(.112,.041,1.095),'iron',.035,.010,n=2)
            q.path([(xx-.035,yy+k*.037,-.449),(xx-.015,yy+k*.037,.405),(xx+.009,yy+k*.037,.453),(xx+.051,yy+k*.037,.424),(xx+.070,yy+k*.037,-.404)],.022,'steel',8)
            for zz in (-.394,.396):
                q.tube((xx,yy+k*.025,zz),(xx,yy+k*.042,zz),.028,'brass',7)
    for x in (-.671,.671):
        for y in (-.419,.419):
            m.path([(x,y,.276),(x,y,1.092),(x,y*.93,1.145)],.032,'steel',8)
        m.tube((x,-.386,1.145),(x,.386,1.145),.033,'iron',9)
    # The belt bears directly on the outer tables between the padded corner posts.
    for y in (-.318,.343):
        sign=math.copysign(1,y)
        m.box((0,y,1.011),(1.145,.019,.084),'web',.005,.004,physical=True)
        for side in (-1,1):
            dx=.112;dy=.424-abs(y);length=math.hypot(dx,dy)
            m.box((side*.617,sign*(.424+abs(y))/2,1.011),(length,.019,.084),'web',.004,.003,rot=(0,0,math.degrees(math.atan2(sign*dy,side*dx))))
    for x in (-.672,.672):m.box((x,0,1.011),(.027,.854,.085),'web',.006,.003)
    m.box((.055,-.337,1.012),(.15,.025,.109),'brass',.011,.005)
    m.box((.052,-.354,1.012),(.100,.012,.059),'web',.005,.003)
    m.box((.119,-.340,.865),(.056,.019,.258),'web',.008,.006,rot=(-4,-12,0))
    m.write()

def cloth_bundle(q,xyz,size,material,seed):
    # Superelliptical, softly bulging folds with a turned edge and irregular silhouette.
    cx,cy,cz=xyz;w,d,h=size;num=20;rings=[]
    for k,(z,f) in enumerate([(-.5,.83),(-.32,.99),(0,1),(.32,.97),(.5,.80)]):
        ring=[]
        for i in range(num):
            a=2*math.pi*i/num;s,c=math.sin(a),math.cos(a);wob=1+.018*math.sin(3*a+seed)+.01*math.cos(5*a+seed)
            xx=np.sign(c)*abs(c)**.28*w*f*wob/2;yy=np.sign(s)*abs(s)**.30*d*f*wob/2
            ring.append((cx+xx,cy+yy,cz+h*z+.009*math.sin(3*a+seed+.31*k)))
        rings.append(ring)
    q.rings(rings,material,smooth=True)
    # The doubled terry hem wraps past the leading edge in a continuous soft fold.
    points=[]
    for f in np.linspace(-.43,.43,9):
        arc=.010*(1-(abs(f)/.44)**2)
        points.append((cx+f*w,cy-d*.489-.008*math.cos(f*5+seed),cz-.009+arc+.006*math.sin(f*7+seed)))
    for a,b in zip(points,points[1:]):q.tube(a,b,.0075,material,5)

def housekeeping():
    m=Mesh('housekeeping-cart')
    for x in (-.592,.59):
        for y in (-.301,.301):m.wheel(x,y,.106)
    m.box((0,0,.276),(1.46,.79,.096),'rubber',.068,.020,physical=True)
    for z in (.354,.683,1.037):
        m.box((-.185,0,z),(1.02,.693,.057),'alloy',.022,.009,physical=True)
    for x in (-.68,.313):
        m.box((x,0,.706),(.053,.687,.73),'ivory',.019,.011,physical=True)
    m.box((-.184,.324,.694),(1.004,.039,.684),'ivory',.013,.008,physical=True)
    m.box((-.167,0,1.096),(1.116,.746,.098),'iron',.039,.016,physical=True)
    m.box((-.176,0,1.144),(1.023,.663,.023),'alloy',.047,.008)
    for level,base in enumerate((.388,.718)):
        for col,cx in enumerate((-.429,.055)):
            for i in range(3):
                width=.439+.030*math.sin(i*2.36+col*1.73+level*.83);height=.086+.011*math.sin(i*1.71+col*.8)
                z=base+.045+i*.083
                q=m.at((cx+.018*math.cos(i+col),-.060+.033*math.sin(i*2.13+col*1.45+level*.75),z),(0,0,(i+col-1)*2.5))
                cloth_bundle(q,(0,0,0),(width,.50-.022*(i%2),height),'linen' if (i+level)%3 else 'cream',6*level+2*col+i)
            m.solid([(cx+sx*width/2,-.055+sy*.233,zz)for sx in (-1,1)for sy in (-1,1)for zz in (base,base+.254)])
    # Canvas laundry sack hangs from four hooks. Its sides draw in towards their loaded bottom.
    rings=[];n=20
    for k,(z,w,d) in enumerate([(.345,.22,.43),(.406,.32,.57),(.559,.365,.625),(.795,.355,.616),(.982,.34,.58),(1.037,.342,.59)]):
        ring=[]
        for i in range(n):
            a=i*math.tau/n;co,si=math.cos(a),math.sin(a);cr=1+.045*math.sin(5*a+.6*k)+.028*math.sin(9*a-1.1*k)
            ring.append((.523+np.sign(co)*abs(co)**.53*w*.5*cr,np.sign(si)*abs(si)**.47*d*.5*cr,z+.011*math.sin(3*a+.5*k)))
        rings.append(ring)
    m.rings(rings,'bag',True)
    m.box((.519,0,1.045),(.249,.481,.020),'iron',.065,.006)
    for y in (-.331,.331):
        m.path([(.281,y,1.023),(.352,y,1.117),(.647,y,1.117),(.699,y,1.07),(.699,y,.964)],.025,'steel',8)
        for x in (.39,.646):m.path([(x,y*.91,1.015),(x,y,1.118),(x+.023,y,1.125)],.012,'web',6)
    m.tube((.697,-.326,1.056),(.697,.326,1.056),.032,'grip',9)
    # A paper roll has a recessed core on both ends; pump bottles have spouts and individual collars.
    m.tube((-.592,.054,1.246),(-.273,.054,1.246),.093,'linen',20)
    for xx,sg in ((-.592,-1),(-.273,1)):
        m.tube((xx,.054,1.246),(xx+sg*.003,.054,1.246),.042,'saddle',13)
        m.tube((xx+sg*.003,.054,1.246),(xx+sg*.006,.054,1.246),.028,'iron',12)
    for x,y,h,color in [(-.024,.09,.182,'amber'),(.095,.032,.216,'ivory')]:
        m.box((x,y,1.153+h*.45),(.089,.076,h*.90),color,.018,.010,n=2)
        m.tube((x,y,1.153+h*.84),(x,y,1.153+h),.037,color,9,r2=.021)
        m.tube((x,y,1.153+h),(x,y,1.177+h),.022,'iron',9)
        m.tube((x,y,1.174+h),(x,y,1.201+h),.010,'steel',7)
        m.box((x+.012,y,1.205+h),(.061,.022,.014),'iron',.006,.003)
    m.write()

if __name__=='__main__':
    finishes()
    for builder in (buggy,loungers,tables,housekeeping):builder()
