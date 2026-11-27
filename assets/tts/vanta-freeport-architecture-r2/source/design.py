"""Local outlines, room uses, roof traditions and the actual three-dimensional work sites."""
from pathlib import Path
import math
import numpy as np
from shapely.geometry import Polygon,box
from shapely.geometry.polygon import orient
R=Path(__file__).resolve().parents[1]; W=R/'work'; A=R/'assets'; D=R/'dist'
for p in (W,A,D):p.mkdir(exist_ok=True)
def rect(x0,z0,x1,z1,c=.18):
 return orient(Polygon([(x0+c,z0),(x1-c,z0),(x1,z0+c),(x1,z1-c),(x1-c,z1),(x0+c,z1),(x0,z1-c),(x0,z0+c)]),1)
def poly(ls):return orient(Polygon(ls),1)
def round_end(x0,z0,x1,z1,r,side='front'):
 # Continuous elliptical frontage with full-depth shoulders.
 mx=(x0+x1)/2;rx=(x1-x0)/2
 points=[(mx+rx*math.cos(t),z0+r+r*math.sin(t)) for t in np.linspace(math.pi,2*math.pi,11)]
 points += [(x1,z1-.2),(x1-.2,z1),(x0+.2,z1),(x0,z1-.2)]
 if side=='back':points=[(x,z1+z0-z) for x,z in points]
 return poly(points)
def cut(x0,z0,x1,z1,kx,kz):
 return poly([(x0+.18,z0),(x1-.15,z0),(x1,z0+.15),(x1,z1-kz),(x1-kx,z1-kz),(x1-kx,z1),(x0+.18,z1),(x0,z1-.18),(x0,z0+.18)])
# Each row has its own floor plan, front door, palette, program and massing.
# Positions correspond to the R1 footprints in table inches. Roof pallets are native components below.
def item(g,slug,name,p,up,h,uh,style,base,upper,trim,room,face,target,cap):
 return dict(g=g,slug=slug,name=name,p=p,up=up,h=h,uh=uh,style=style,base=base,upper=upper,trim=trim,room=room,face=face,target=target,cap=cap)
models=[
 item('7a2103','dispatch','Dispatch Exchange',round_end(-3.73,-3.24,3.73,3.17,1.14),round_end(-2.84,-2.35,2.25,2.68,1.1),2.89,2.43,'exchange','limestone','plaster','copper','dispatch',(1,0),.15,'DISPATCH'),
 item('da0dca','sealworks','Seal Inspection Works',cut(-3.70,-3.24,3.70,3.23,1.18,.87),rect(-3.24,-2.97,2.20,2.63,.16),2.78,2.15,'saw','brick','riboxide','ink','laboratory',(0,1),.9,'SEAL WORKS'),
 item('7a2101','inspection','Rail Inspection Hall',rect(-4.55,-4.00,4.91,4.01,.36),None,3.18,0,'train','brick','brick','oxide','receiving',(0,1),-1.10,'INSPECTION'),
 item('7a2106','quarantine','Quarantine Cold Store',cut(-4.78,-4.0,4.57,3.99,1.16,.76),None,3.05,0,'cold','panel','panel','oxblood','cold',(0,1),-2.25,'QUARANTINE'),
 item('7a2108','customs','Customs House',poly([(-4.05,-2.42),(-3.46,-2.89),(2.89,-2.89),(5.0,-1.55),(5.0,1.64),(3.50,2.73),(-3.72,2.73),(-4.05,2.22)]),None,2.83,0,'civic','limestone','plaster','copper','public',(0,-1),-.95,'CUSTOMS'),
 item('7a2184','records','Manifest Archive',cut(-3.92,-2.63,4.76,2.35,1.15,1.1),None,2.70,0,'records','darkbrick','plaster','ink','archive',(0,-1),-1.40,'RECORDS'),
 item('7a210a','security','Security Lodge',round_end(-2.70,-2.30,2.60,2.23,1.11),None,2.74,0,'guard','limestone','panel','navy','security',(-1,0),-.15,'SECURITY'),
 item('7a2180','intake','Gate 01 Intake Office',poly([(-2.68,-1.68),(-1.87,-2.27),(1.72,-2.27),(2.68,-1.40),(2.68,2.19),(-2.68,2.19)]),None,2.48,0,'visor','plaster','plaster','copper','weigh',(0,-1),-.38,'GATE 01'),
 item('de2ddc','exit','Goods Release Office',cut(-2.65,-2.21,2.58,2.07,1.08,.89),None,2.70,0,'release','darkbrick','panel','oxide','clearance',(0,-1),.35,'RELEASE'),
 item('7a218c','bondstore','Bonded Store No. 4',rect(-2.70,-2.27,2.69,2.20,.24),None,2.62,0,'stores','brick','brick','navy','store',(0,1),-.68,'BONDED 04'),
 item('97e616','bondloft','Bonded Hoist Warehouse',rect(-2.69,-2.65,2.63,2.65,.27),rect(-2.18,-2.23,2.13,2.14,.16),2.66,2.27,'hoist','darkbrick','brick','oxide','bond',(0,1),-.78,'BOND LOFT'),
 item('465a28','services','Freight Services',cut(-2.67,-2.57,2.66,2.52,1.00,.70),round_end(-2.14,-1.91,1.42,2.01,.68,'back'),2.65,2.09,'engineer','limestone','plaster','navy','repair',(0,-1),.50,'SERVICES'),
 item('7a210c','scanner','Freight Scan Pavilion',rect(-3.01,-2.23,3.03,2.25,.16),None,3.0,0,'portal','panel','panel','navy','scan',(1,0),0,'FREIGHT SCAN'),
 item('7a2188','dock','Covered Transfer Dock',rect(-2.97,-2.17,2.95,2.12,.14),None,2.92,0,'wing','plaster','panel','oxide','dock',(1,0),0,'TRANSFER')
]
BY={d['g']:d for d in models}
pallets={'7a2101':[(.36,2.61,90)],'7a2108':[(3.78,-1.02,0)],'7a2184':[(3.45,-.31,90)],'7a2188':[(-.06,-.31,0)],'7a2106':[(-3.31,-2.53,90),(.54,2.59,90)]}
plates={'dispatch':('DISPATCH','VANTA PORT AUTHORITY'),'sealworks':('SEAL WORKS','LABORATORY   /   02'),'inspection':('INSPECTION','INBOUND FREIGHT   /   I2'),'quarantine':('QUARANTINE','COLD STORE   /   Q2'),'customs':('CUSTOMS','VANTA FREEPORT'),'records':('RECORDS','MANIFESTS   /   ARCHIVE'),'security':('SECURITY','DUTY OFFICE   /   S1'),'intake':('GATE 01','INBOUND   /   WEIGHING'),'exit':('RELEASE','OUTBOUND CLEARANCE'),'bondstore':('BONDED 04','SEALED GOODS STORE'),'bondloft':('BOND LOFT','HOIST HOUSE   /   B1'),'services':('SERVICES','WORKSHOP   /   F3'),'scanner':('FREIGHT SCAN','SLOW   /   AXLE CONTROL'),'dock':('TRANSFER','CLEARED FREIGHT   /   D3')}
