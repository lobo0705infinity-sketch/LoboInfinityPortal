from pathlib import Path
import json,sys
from mesh import Mesh,Pair,ROOT,OUT
from buildings import house
from rail import crossing,grade,railbed,arcade,snow_shed,car
import props

OUT.mkdir(exist_ok=True)
(ROOT/"build").mkdir(exist_ok=True)
proxy=Mesh("private-preview-collider")
proxy.box(0,0,0,.035,.035,.035,"darkiron")
proxy.write("proxy-point-col.obj",True)
models={};objects=[]
def model(g):
    models[g.key]=g.write()
    return g.key
def place(key,label,x,z,asset,w,d,desc,rot=0,elevation=0,kind='scatter',**extra):
    objects.append(dict(key=key,label=label,x=x,z=z,y=round(4.006+elevation,5),rot=rot,asset=asset,w=w,d=d,desc=desc,kind=kind,**extra))
def building(key,label,x,z,w,d,h,style,doors,graphic,desc,rot=0,elevation=0):
    low=model(house(key,w,d,h,style,doors,graphic,False))
    high=model(house(key,w,d,h,style,doors,graphic,True))
    place(key,label,x,z,high,w,d,desc,rot,elevation,'building',floor=low,height=h,doors=doors)
g=Pair('survey-mat')
g.m.quad([(-24,0,-24),(-24,0,24),(24,0,24),(24,0,-24)],'snow',[(0,0),(0,1),(1,1),(1,0)])
g.c.box(0,-.095,0,48,.095,48,'darkiron')
place('mat','Bellwether Incline | Winter station mat',0,0,model(g),48,48,'Granite setts, wheel marks, cleared footpaths and drifted snow.',kind='mat',elevation=-.006)
# Two different station elevations offer distinct routes from the northern side.
for key,label,x,z,w,d,h,step in [
    ('staff-terrace','Crew terrace',-16.4,18.1,12.1,8.4,.68,1.85),
    ('booking-terrace','Upper booking terrace',15.65,13.0,11.2,7.0,1.04,-3.98)]:
    place(key,label,x,z,model(props.terrace(key,w,d,h,step)),w,d,'Cleared station terrace with a stone stair from the public path.',kind='terrace')
building('winding-house','Winding House',3,-.70,6.8,4.85,4.46,'winding','EW','winding','The double-flanged cable drum can be seen through the arched works window. Enter from either side.')
building('brake-shop','Brake Workshop',-17.7,-.31,7.2,5.05,3.35,'brake','ES','brakeshop','The bench and overhead hoist stand ready. The wheelset waiting outside belongs to Car 02.')
building('cafe','Platform Café',17.5,-1.72,6.75,4.40,2.85,'cafe','WS','cafe','An espresso machine, three cups and a travel poster remain from the interrupted morning shift.')
building('ticket-office','Upper Booking Hall',16.70,13.55,6.45,4.45,2.92,'ticket','WS','tickets','Passengers bought summit tickets here. The route map hangs across from the counter.',elevation=1.04)
building('crew-lodge','Drivers’ Lodge',-17.5,18.3,6.6,5.25,2.88,'crew','SE','staff','The founding driver looks down from the back wall. A cleared path leads to the crew stair.',elevation=.68)
building('signal-cabin','Signal Cabin',-1.25,18.4,6.1,4.95,3.15,'relay','SW','station','An operator can watch the crossing from the timber-sided cabin.')
building('spares-store','Cable Spares Store',8.25,19.75,5.55,4.75,2.70,'stores','WS','stores','Strapped cable spares and replacement bearings wait on the dispatch floor.')
building('track-hut','Permanent Way Hut',-17.85,10.85,5.05,3.58,2.53,'relay','ES','stores','A small hut for the crew responsible for the grade, salt bins and hand crossings.')
building('maintenance-office','Maintenance Records',-17.05,-15.75,7.12,6.15,3.14,'office','EN','brakeshop','The shift ledger and a tile mural of the original construction crew hang inside.')
building('porter-lockers','Porters’ Room',17.18,-14.55,7.05,5.22,2.84,'crew','WN','staff','Porters used this room between deliveries. Its side door faces the baggage carts.')
building('parcel-office','Lower Parcel Office',3.45,-19.0,6.67,4.88,2.76,'ticket','WN','parcel','The booking window and parcel seal desk serve the covered arcade uphill.')
building('boiler-house','Heating & Pipe Stores',-6.09,-19.77,5.15,4.81,2.65,'boiler','ES','stores','The flue and insulated feed pipe serve the waiting rooms on this side of the grade.')
for xc in [-16,0,16]:
    key='permanent-way-'+str(xc+16)
    place(key,'Incline permanent way',xc,5.55,model(railbed(key,xc)),16,6.44,'Steel railheads, cable slot and sleepers rise from the valley to the summit.',kind='track')
for name,xc in [('valley',-9.05),('summit',9.05),('west-service',-22.6),('east-service',22.6)]:
    key=name+'-crossing'
    place(key,name.replace('-',' ').title()+' foot crossing',xc,5.55,model(crossing(key,xc)),2.2,10.24,'Timber panels bridge the rails. The stone stair on either side has room for a miniature.',kind='crossing')
lo=model(snow_shed(False));hi=model(snow_shed(True))
place('snow-shed','Avalanche Gallery',1.10,5.55,hi,8.1,4.5,'A timber snow gallery shelters the lead compartment. Its valley portal stands open.',elevation=grade(1.10),kind='gallery',floor=lo)
place('car-02','Bellwether Car 02',-4.32,5.55,model(car()),6.85,2.88,'The car stopped astride the west portal. The note on the cab glass reads “I pulled the handbrake.”',elevation=grade(-4.32)+.226,kind='car')
lo=model(arcade(False));hi=model(arcade(True))
place('arcade','Covered Parcel Passage',-5.4,-7.85,hi,8.4,4.5,'Two stone passages link the public yard and parcel office. Climb the east stair to the terrace.',kind='arcade',floor=lo)
# Repeat hardware only where the same railway would issue it.
prop_types={}
for name,ctor,w,d in [('wheelset',props.wheelset,2.6,1.7),('inspection',props.inspection,1.86,1.05),('trolley',props.trolley,2.06,1.33),('grit',props.grit,2.55,1.4),('tools',props.toolchest,1.77,.98),('seat',props.platform_bench,3.20,.80),('shelter',props.shelter,4.5,1.9),('board',props.standing_board,2.62,.52),('wall',props.screen,3.8,.77),('cabinet',props.hatchbox,1.95,1.22),('pines',props.planter,3.23,1.32)]:
    prop_types[name]=(model(ctor()),w,d)
props_layout=[
 ('wheelset','Removed wheelset',-13.12,-4.24,0,0,'Marked for the wheel lathe. Chocks hold the axle in its inspection cradle.'),
 ('inspection','Brake recorder test bench',12.05,-3.14,-11,0,'The calibration case is open beside the east trial position.'),
 ('tools','Brake fitter’s tool chest',-16.0,-4.82,15,0,'A magnetic work lamp sits beside the empty socket tray.'),
 ('grit','Salt issue at the valley crossing',-19.40,-4.72,0,0,'A shovel and open salt sack stand at the start of the grade.'),
 ('board','Public incline timetable',-5.15,1.14,0,0,'Passengers have stopped here to read the summit service notice.'),
 ('cabinet','Winding-house power isolation',7.60,-4.55,0,0,'An enamel cabinet marks the service side of the cable house.'),
 ('shelter','Café waiting shelter',6.90,-8.73,-8,0,'Passengers left a suitcase on the sheltered side of the café approach.'),
 ('seat','Café terrace bench',16.02,-5.84,4,0,'A folded timetable and flask sit on the dry side of the bench.'),
 ('pines','Café windbreak',19.35,-7.73,3,0,'The station gardener planted dwarf alpine conifers along the public walk.'),
 ('trolley','Parcels for the morning ascent',-12.05,-7.50,-18,0,'The dispatch trolley was left at the valley end of the covered passage.'),
 ('grit','Lower passage winter bin',-10.30,-12.00,-17,0,'Grit and a shovel serve both archways after sleet.'),
 ('cabinet','Parcel lift isolator',1.65,-6.56,0,0,'The parcel-lift circuit runs uphill into the winding house.'),
 ('trolley','Undelivered luggage',8.60,-15.01,20,0,'These tagged bags missed the last operating car.'),
 ('wall','Sheltered parcel queue',5.35,-12.75,0,0,'A waist-high granite wall shelters the old parcel queue.'),
 ('board','Railway opening lithograph',-9.90,-15.66,25,0,'The period lithograph faces visitors arriving from the lower street.'),
 ('seat','Porters’ bench',12.30,-18.35,90,0,'The porters wait here for the booking window to open.'),
 ('tools','Dolly repair stand',21.45,-20.14,88,0,'The wheels on incoming luggage dollies are serviced here.'),
 ('wall','South street retaining return',-13.10,-22.10,90,0,'The retaining wall meets the lower street boundary.'),
 ('pines','Lower street planted bed',.00,-15.25,-8,0,'A planted bed separates arriving passengers from the freight route.'),
 ('trolley','Overflow parcel cart',-19.00,-21.02,4,0,'A late consignment is queued outside the records building.'),
 ('shelter','Rail staff muster shelter',-17.10,-9.56,7,0,'A timber-and-slate shelter stands at the staff muster point.'),
 ('cabinet','Street traction cabinet',-21.22,-6.60,0,0,'The lower traction circuit is signed against accidental switching.'),
 ('wall','West yard retaining return',-22.10,-10.75,0,0,'The granite return ties directly into the west boundary.'),
 ('wall','East promenade retaining return',22.10,-10.15,0,0,'The granite return closes the east end of the passenger promenade.'),
 ('seat','Valley platform bench',-12.52,10.90,0,0,'The bench and suitcase face the valley end of the grade.'),
 ('trolley','Track crew supply cart',-10.8,14.0,9,0,'Track fasteners are queued for the permanent-way crew.'),
 ('cabinet','West block signal relay',-7.0,10.40,0,0,'The signal relay cabinet faces the cleared winter service path.'),
 ('pines','North platform windbreak',-4.0,13.04,4,0,'Three low conifers protect the platform waiting area.'),
 ('shelter','Summit platform shelter',5.42,11.26,0,0,'A roofed seat overlooks the car and keeps the waiting lane clear.'),
 ('board','Summit approach noticeboard',11.05,14.5,90,1.04,'The public timetable faces passengers walking down from booking.'),
 ('grit','Upper terrace salt store',20.73,19.82,-8,0,'A winter crew left the salt bin open for the next shift.'),
 ('wheelset','Service exchange axle',-7.95,17.1,90,0,'A spare axle rests on a lifting cradle near the crew terrace.'),
 ('wall','Summit lane boundary return',2.81,22.10,90,0,'This retaining return meets the north boundary.'),
 ('pines','Crew garden windbreak',-12.2,16.65,90,.68,'Dwarf conifers mark the north end of the staff terrace.'),
 ('tools','Way crew mobile chest',-12.27,20.50,87,.68,'The cabinet is tucked against the sheltered side of the terrace.'),
 ('trolley','Summit luggage cart',16.4,17.97,5,0,'The baggage cart is waiting for the next car.'),
 ('grit','Platform approach winter bin',-5.95,-2.46,-12,0,'Ice scraped off the iron stair is mixed into the salt bin.'),
 ('cabinet','Valley route block relay',-8.55,-1.62,0,0,'The route selector protects the valley crossing.'),
 ('board','Brake trial access notice',10.72,-6.13,90,0,'Public access ends at the recorder test bay.')]
for i,(typ,label,x,z,rot,y,desc) in enumerate(props_layout,1):
    asset,w,d=prop_types[typ];place('fitting-'+str(i).zfill(2),label,x,z,asset,w,d,desc,rot,y,kind='edge' if 'return' in label else 'scatter')
(ROOT/'build'/'scene.json').write_text(json.dumps({'objects':objects,'models':models},indent=2))
print(len(objects),'placements',len(models),'unique render meshes',sum(i['tri'] for i in models.values()),'render triangles total')
