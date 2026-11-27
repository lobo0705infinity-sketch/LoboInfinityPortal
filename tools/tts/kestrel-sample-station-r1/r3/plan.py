"""Site coordinates (across the map photograph, towards the near deployment edge)."""
from pathlib import Path
from copy import deepcopy
import json,sys
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'r2'))
import common as r2
from common import read,write
A=ROOT/'assets'; W=ROOT/'work'; D=ROOT/'dist'
PREFIX='assets/tts/kestrel-station-plan-r3'
TITLE='Kestrel Lunar Base - Station Plan R3 - Data Harvest - Play Table'
TAG='LoboMap:1008da'
# Retire duplicate laboratory pods, redundant towers and loose service boxes.
RETIRED=set('c70017 c7001a c7001d c70028 c7002d c7a000 c7a200 c7c000 c7c100 c7d002 c70038 c70045 c70049 c7004a c7004c'.split())
# u=world Z, v=world X. Rotations and scales are copied to all building states.
MOVES={
 'c70007':(-17.0,-10,180),'c70025':(-7,-10,0),'c7a300':(1.0,-19,0),
 'c7002b':(2.7,-10,0),'c70022':(-17.5,18.6,180),'c7001f':(19.68,-4.45,270),
 'acd6a1':(18,9,0), 'e51005':(-18.7,-18.2,0),
 'c7003b':(14.0,-21.0,90),'c7003c':(20.4,-20.62,90),'c7003e':(10.35,-21.17,90),
 'c70036':(15.60,-4.40,0),'e51003':(13.44,-3.78,0),'c70039':(-15.2,-18.2,0),
 'c70043':(-1.2,15.6,90),'c70044':(-12.55,21.8,90),'c70046':(-13.24,16.5,90),
 'c7004b':(19.5,13.2,90),
}
for i in range(6):
 MOVES[f'c7000{i+1}']=([11.35,16.65][i//3],[-17.10,-12.58,-8.06][i%3],270)
# Hall geometry uses file-local X along v and Z along u.
# Entries on N/S walls have an absolute u coordinate. W/E use v.
HALLS={
 'lab':('e53101','Sample preparation hall',-7,-19,8.7,4.3,{'S':[-7],'E':[-19],'W':[-19]}),
 'plant':('e53102','Kestrel station service hall',5.9,-3.90,10.2,4.10,{'N':[2.7],'S':[8.8],'E':[-3.9],'W':[-3.9]}),
 'clinic':('e53103','Crew infirmary',8.72,9,5.84,4.48,{'N':[8.8],'S':[8.72],'E':[9]}),
 'shop':('e53104','Flight instrument workshop',1.15,20.15,6.40,4.36,{'W':[20.15],'N':[1.15]}),
 'dispatch':('e53105','Sample dispatch store',-4.0,6.0,5.3,3.55,{'S':[-4.0],'W':[6.0]}),
}
# Every bridge spans two facing entrance planes. Distances use imported hull dimensions.
# The common mid-section has a side EVA hatch. Long runs get two separate side hatches.
LINKS={
 'e53201':('Observatory gallery',(-14.05,-10),(-11.45,-10)),
 'e53202':('Preparation gallery',(-7,-16.85),(-7,-14.46)),
 'e53203':('Culture gallery',(-2.65,-19),(-.87,-19)),
 'e53204':('Research gallery',(-2.54,-10),(.92,-10)),
 'e53205':('North service gallery',(2.7,-7.98),(2.7,-5.95)),
 'e53206':('Main crew passage',(8.8,-1.85),(8.8,6.76)),
 'e53207':('Crew court cross-passage',(13.17,10.09),(13.17,17.91)),
}
# The second parallel crew capsule uses the same standard collars as the original.
CREW_LINK=('e53208','Infirmary berth gallery',(11.64,9),(14.68,9))
# Compound contours, made from a few surveyed rectangles combined in the surface generator.
PADS={
 'science':[(-12.65,-22.62,-1.57,-14.94),(-22.1,-14.05,-12.1,-5.65),(-13.9,-15.45,-.25,-4.18),(-3.52,-22.03,4.28,-16.13),(-21.5,-20.78,-13.95,-16.0),(-15.33,-19.99,-11.35,-17.95),(-2.88,-12.60,5.02,-7.45),(-2.88,-16.63,2.72,-13.35)],
 'power':[(8.54,-19.31,19.32,-6.45),(9.40,-23.13,22.72,-18.1),(9.40,-7.20,22.68,-1.45)],
 'crew':[(4.80,5.95,22.23,11.85),(6.43,16.08,22.35,21.55),(11.47,10.85,15.22,17.15),(15.75,14.52,21.57,17.40),(12.0,20.90,23.76,23.83)],
 'flight':[(-23.77,2.34,-11.80,15.85),(-22.2,13.1,-13.48,22.48),(-13.85,8.04,-9.72,12.30),(-12.26,12.13,-3.63,19.43),(-14.02,15.0,-11.50,23.0),(-2.77,17.02,5.05,22.51)],
 'station':[(-.12,-6.54,11.68,-1.20),(.99,-8.95,4.42,-4.26),(7.12,-1.95,10.48,7.10),(-7.36,3.40,-.66,8.93)],
}
# An EVA tug can leave the flight apron, reach dispatch and double back to the service hall.
ROADS=[
 [(-21.1,2.90),(-16.1,2.90),(-13.30,.65),(-9.15,.65),(-6.65,2.90),(-3.95,2.90),(-1.60,1.08),(3.75,1.08),(6.15,3.10),(6.15,6.05)],
 [(-9.15,.65),(-9.15,-2.74),(-7.0,-4.65),(-7.0,-5.53)],
 [(11.01,-3.90),(11.78,-3.90),(12.0,-.96),(13.7,.28),(16.95,.28),(18.0,.55),(20.0,.55)],
 [(-3.94,7.90),(-3.94,10.4),(-1.2,12.7),(1.1,12.7),(3.48,15.05),(3.48,16.25),(1.15,17.42),(1.15,17.98)],
 [(-7.27,2.48),(-7.91,3.40),(-7.91,5.37),(-7.37,6.00),(-6.65,6.00)],
 [(6.35,2.45),(7.72,2.45)],[(9.89,2.45),(13.88,2.45),(16.20,.55),(18.0,.55)],
 [(8.72,11.25),(8.72,13.38),(9.78,14.55),(9.78,16.95)],
]
def source_bag():return read(r2.W/'bag.json')['ObjectStates'][0]
def resource(url):
 if '/'+PREFIX+'/' in url:return A/url.rsplit('/',1)[-1]
 return r2.resource(url)
