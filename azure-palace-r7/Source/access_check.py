"""Check exterior ladder access, balcony support, and access through each new deployment court from released colliders."""
from collections import defaultdict
from scipy.ndimage import label
from shapely import maximum_inscribed_circle,contains_xy
from site_check import *
from architecture import dims,ladder_centres,FRONT,DECK_REACH,flight_gate

r=25/25.4/2
buildings=envelopes()
courts=court_hulls()
obstacles=union_all([*buildings.values(),*courts.values(),pool,*[p.buffer(.7874)for p in objectives]])
field_inside=field.buffer(-r-.015)
outdoor_free=field_inside.difference(obstacles.buffer(r+.035))
roads={}
# Conservative connected-component check on the full board. A protected quarter-inch clearance
# around sampled paths prevents corner cutting between cells.
grid=.15
v=np.arange(-24,24.01,grid)
X,Z=np.meshgrid(v,v)
def reach(mask,worldp):
    row=np.argmin(abs(v-worldp[1]));col=np.argmin(abs(v-worldp[0]))
    return mask[row,col]
for mm in (25,40,55):
    rr=mm/25.4/2
    available=field.buffer(-rr-.02).difference(obstacles.buffer(rr+.025))
    component,_=label(contains_xy(available.buffer(-grid*.71),X,Z),[[0,1,0],[1,1,1],[0,1,0]])
    roads[mm]=component
def hull(vv):return shapely.MultiPoint(vv[:,[0,2]]).convex_hull
landings={}
for slug,gate in ladder_centres.items():
    w,d,floors,_=dims[slug];edge=-d/2-DECK_REACH;rail=edge-.162
    foot=world(slug,gate,rail-.62)
    assert outdoor_free.covers(Point(foot)),(slug,'blocked ground start')
    group=reach(roads[25],foot)
    assert group and np.any((roads[25]==group)&(abs(X)<1)),(slug,'disconnected ladder foot')
    for state,visible in enumerate([floors]+list(range(1,floors+1)),1):
        if visible<2:continue
        parts=chunks(OUT/f'{slug}-{state}-col.obj')
        for floor in range(1,visible):
            gate=flight_gate(slug,floor)
            deck=floor*3.1+.22
            decks=union_all([hull(p)for p in parts if abs(p[:,1].max()-deck)<.0001 and p[:,1].min()<deck-.12])
            inside=union_all([hull(p)for p in parts if p[:,1].max()>deck+.09 and p[:,1].min()<deck+1.57])
            path=LineString([(FRONT,-d/2-.66),(FRONT,edge+.75),(gate,edge+.75),(gate,edge+.53)])
            disk=path.buffer(r,quad_segs=32)
            assert decks.buffer(.00001).covers(disk) and inside.disjoint(disk),(slug,state,floor,'landing to the doorway')
            # Past the deck edge the centre of a climbing base can step between the rails.
            assert inside.disjoint(LineString([(gate,edge+.53),(gate,rail-.51)]).buffer(r)),(slug,state,'parapet closes ladder gate')
            bottom=0 if floor==1 else (floor-1)*3.1+.22
            rail_boxes=[p for p in parts if abs(p[:,1].min()-(bottom+.035))<.0002 and abs(p[:,1].max()-(deck+.70))<.0002 and abs((p[:,2].min()+p[:,2].max())/2-rail)<.002]
            assert len(rail_boxes)==2,(slug,state,floor,'handrails')
            rungs=sorted(p[:,1].min() for p in parts if abs(np.ptp(p[:,0])-1.239)<.0001 and abs(np.ptp(p[:,2])-.065)<.0001 and abs((p[:,0].min()+p[:,0].max())/2-gate)<.002 and p[:,1].min()>bottom and p[:,1].min()<deck)
            assert rungs and rungs[0]<bottom+.30 and max(np.diff(rungs))<.31 and rungs[-1]>deck-.12,(slug,state,floor,'unbroken rungs')
            if floor>1:
                lower=union_all([hull(p)for p in parts if abs(p[:,1].max()-bottom)<.0001 and p[:,1].min()<bottom-.12])
                blockers=union_all([hull(p)for p in parts if p[:,1].max()>bottom+.09 and p[:,1].min()<bottom+1.57])
                # Walk from the lower doorway, round the upper flight and into its base contact position.
                bypass=gate+1.27
                way=LineString([(FRONT,-d/2-.77),(bypass,-d/2-.80),(bypass,rail-.64),(gate,rail-.64)])
                disk=way.buffer(r,quad_segs=32)
                assert lower.buffer(.00001).covers(disk) and blockers.disjoint(disk),(slug,state,'supported transfer between flights')
    landings[slug]=floors-1

# Each pair of entrance centres lies at opposite ways out of its court. Three
# distinct 25 mm placements fit simultaneously in the useable sheltered space.
locations={'reception':{'gates':[(-1.80,3.90),(.62,8.44)],'pockets':[(-.10,5.41),(.50,4.30),(1.61,5.48)]},
           'laundry':{'gates':[(1.76,7.53),(1.66,12.03)],'pockets':[(-1.22,9.30),(-.70,10.66),(.45,9.38)]},
           'east-villa':{'gates':[(-5.90,-1.11),(-9.72,-.51)],'pockets':[(-8.78,.75),(-8.04,2.35),(-7.50,.84)]}}
checks={}
for slug,data in locations.items():
    centers=[Point(world(slug,*q)) for q in data['pockets']]
    assert all(a.distance(b)>2*r+.04 for i,a in enumerate(centers)for b in centers[:i])
    checks[slug]={}
    for mm in (25,40,55):
        zone=roads[mm];targets=[world(slug,*q) for q in data['gates']]+[c.coords[0] for c in centers]
        ids=[int(reach(zone,q))for q in targets]
        connected=set(ids)-{0};current=next(iter(connected),0)
        in_mid=bool(current and np.any((zone==current)&(abs(X)<1)))
        if mm in (25,40):
            assert in_mid and ids[0]!=0 and ids[1]!=0 and len(connected)==1,(slug,mm,ids)
        if mm==25:assert all(ids),(slug,ids)
        checks[slug][mm]={'gate_count':sum(bool(q)for q in ids[:2]),'placements':sum(bool(q)for q in ids[2:]),'connected_to_midfield':in_mid}
hard=union_all([*buildings.values(),*courts.values()])
empty={}
for label,strip in [('east',box(12,-24,24,24)),('west',box(-24,-24,-12,24))]:
    gap=maximum_inscribed_circle(strip.difference(hard),tolerance=.02)
    empty[label]=round(2*gap.length,2)
report={'playable_upper_landings':landings,'exterior_courts':checks,'largest_clear_diameter_inches':empty}
write(ROOT/'Review/access.json',report)
print(json.dumps(report,indent=2))
