"""Reception's porter lodge and covered pick-up bay, in local building inches."""
from common import *
from courts import secure,sub
from faces import clean,give_sheets_thickness

PAVING=[(-3.04,2.71),(2.36,2.71),(2.36,6.26),(2.12,7.62),
        (1.78,7.76),(-1.40,7.76),(-2.65,7.25),(-2.97,6.04)]
def build():
    m=F.Surface();c=M()
    # The luggage store shares the masonry beside the reception entrance.
    x=-1.96;z0=5.01;z1=6.48;depth=z1-z0;center=(z0+z1)/2
    m.box(x,.012,(z0+z1)/2,1.78,2.40,depth,'oyster')
    c.box(x,0,(z0+z1)/2,1.78,2.412,depth,'limestone')
    m.box(x,2.413,center,1.89,.106,depth+.11,'travertine')
    m.box(x,2.520,center,1.79,.065,depth+.06,'slate')
    c.box(x,2.40,center,1.89,.186,depth+.11,'limestone')
    for xx in (-2.59,-2.17,-1.75,-1.33):
        m.box(xx,2.584,center,.033,.034,depth-.06,'steel',False)
    # A steel and teak canopy joins the lodge to reception above an open arcade.
    m.box(x,2.65,3.946,1.82,.13,2.24,'slate')
    c.box(x,2.65,3.946,1.82,.13,2.24,'limestone')
    for xx in (x-.79,x+.79):
        m.box(xx,2.48,3.946,.088,.16,2.24,'teak')
        c.box(xx,2.48,3.946,.088,.16,2.24,'wood')
        m.box(xx,2.40,4.999,.14,.30,.095,'bronze')
    # A glazed service hatch and sill serve passengers on the arrivals forecourt.
    m.box(x,1.01,z1+.025,1.45,1.01,.075,'teak')
    m.box(x,1.09,z1+.079,1.28,.84,.040,'glass',False)
    m.box(x,1.05,z1+.106,.042,.91,.045,'brass',False)
    m.rounded(x,.92,z1+.23,1.66,.10,.54,.058,'travertine')
    c.box(x,.92,z1+.23,1.66,.10,.54,'limestone')
    F.plaque(m,x,1.99,z1+.055,1,1.04,.36,'bell')
    # Individual locker doors face the hotel entrance and break up the long elevation.
    def luggage(q,v):
        for xx in (-.354,.354):
            q.rounded(xx,.23,.0,.68,1.49,.085,.029,'green')
            q.box(xx+.20,.88,.059,.045,.21,.073,'brass',False)
            for yy in (1.43,1.52):q.box(xx,yy,.047,.41,.032,.018,'steel',False)
        F.plaque(q,0,1.82,.02,1,.80,.38,'tag')
    sub(m,c,luggage,-1.026,center,90)
    # A solid return and a shallow canopy shelter the waiting bench.
    secure(m,c,(-1.15,6.49),(-1.15,7.22),2.12,'oyster')
    secure(m,c,(-1.15,7.22),(1.70,7.22),2.12,'oyster')
    # The curb-side face identifies the pick-up point when viewed from the table edge.
    m.box(.275,.69,7.398,2.34,.93,.052,'green',False)
    F.plaque(m,.275,.812,7.452,1,1.62,.65,'bell')
    for xx in (-.77,1.32):
        for yy in (.81,1.49):m.box(xx,yy,7.431,.041,.041,.029,'brass',False)
    for xx in np.linspace(-.97,1.47,12):
        m.box(xx,.31,7.021,.102,1.44,.055,'teak',False)
    sub(m,c,lambda q,v:F.seat(q,v,0,0,1.76),.30,6.85,180)
    # Rolled zinc edge, slatted underside and two brackets. The clear end stays open.
    m.box(.275,2.52,6.65,3.20,.092,1.47,'slate')
    c.box(.275,2.52,6.65,3.20,.103,1.47,'wood')
    m.box(.275,2.48,5.907,3.24,.15,.061,'brass')
    for xx in np.linspace(-1.18,1.71,14):m.box(xx,2.475,6.66,.104,.042,1.38,'teak',False)
    for xx in (-1.04,1.55):
        m.box(xx,2.09,7.22,.12,.46,.125,'iron')
        m.beam((xx,2.14,7.17),(xx,2.50,6.06),.074,'brass')
        c.box(xx,2.09,7.22,.12,.46,.125,'bronze')
    # Two tagged suitcases sit against the lodge. Both aisles stay clear.
    for xx,zz,ww,hh,dd,col in [(-2.38,6.82,.56,.58,.35,'teak'),(-1.81,6.91,.40,.69,.28,'sea')]:
        m.rounded(xx,.074,zz,ww,hh,dd,.075,col)
        c.box(xx,.04,zz,ww,hh+.04,dd,'wood')
        for offset in (-.28,.28):
            m.box(xx+offset*ww,.083,zz+dd/2+.006,.032,hh-.02,.023,'brass',False)
            m.box(xx+offset*ww,.03,zz,.071,.075,.075,'rubber',False)
        m.beam((xx-.10,hh+.072,zz),(xx-.10,hh+.175,zz),.031,'bronze')
        m.beam((xx-.10,hh+.175,zz),(xx+.10,hh+.175,zz),.031,'bronze')
        m.beam((xx+.10,hh+.175,zz),(xx+.10,hh+.072,zz),.031,'bronze')
    vmesh,_=clean(m,bottom=True,other=mesh_from_obj(OUT/'reception-2.obj'))
    A.export(vmesh,OUT/'reception-porter-lodge.obj')
    write_collision(c,OUT/'reception-porter-lodge-col.obj')

if __name__=='__main__':
    give_sheets_thickness(F.Surface)
    build()
