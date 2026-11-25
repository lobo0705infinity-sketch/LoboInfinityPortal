"""References and dimensions taken from the released R3 tabletop."""
from pathlib import Path
import json
import sys
from dataclasses import dataclass

ROOT = Path(__file__).resolve().parents[1]
R3 = next(p for p in (ROOT.parent/'cloudbreak-array-r3', ROOT.parent/'r3') if (p/'src/district.py').exists())
sys.path.insert(0,str(R3/'src'))
from district import T, BASE_Y, MAT_Y, PITCH, TAG, BAG, BASE_RADIUS, AS2, PREVIOUS, native, xform, slug, greenhouse
from shapely.geometry import Point, box
from shapely.ops import nearest_points

ASSETS = ROOT/'assets'
OUT = ROOT/'out'
WORK = ROOT/'work'
R3_TABLE = json.loads((R3/'out/Play-Table.json').read_text())
R3_PIECES = [o for o in R3_TABLE['ObjectStates'] if TAG in o.get('Tags',[])]
ROOFS = {slug(o).split('-')[1]:o for o in R3_PIECES if slug(o).startswith('tower-')}
BRIDGES = [o for o in R3_PIECES if slug(o).startswith('bridge-')]
BY_NAME = {t.name:t for t in T.values()}
RELAND = {'287805','9fde13'}
RETIRED = {'50d86e','cf2732'}
ROOM_TILE = native.RECT['room2']


@dataclass(frozen=True)
class Landing:
    axis: int
    center: float
    tangent: float
    inward: int

    def footprint(self, half_width=1.00, depth=.54, outside=.30):
        near = self.center - self.inward*outside
        far = self.center + self.inward*depth
        n0,n1 = sorted((near,far))
        t0,t1 = self.tangent-half_width,self.tangent+half_width
        return box(n0,t0,n1,t1) if self.axis==0 else box(t0,n0,t1,n1)

    def xy(self, normal, tangent):
        return (normal,tangent) if self.axis==0 else (tangent,normal)


def landings(bridge):
    tr=bridge['Transform']
    axis=0 if abs(tr['rotY']%180-90)<1 else 1
    for name in bridge['Nickname'].split(' | ')[1].split(' - '):
        t=BY_NAME[name]
        bridge_center=Point(*t.local(tr['posX'],tr['posZ']))
        edge=nearest_points(bridge_center,t.poly)[1]
        nc,tc=(edge.x,edge.y) if axis==0 else (edge.y,edge.x)
        external=bridge_center.x if axis==0 else bridge_center.y
        yield t.key,Landing(axis,nc,tc,1 if external<nc else -1)


PORTS={k:landing for bridge in BRIDGES if bridge['GUID'] in RELAND for k,landing in landings(bridge)}


def tower_name(k, state):
    return f'tower-{k}-{state}'


def old_file(k,state,collider=False):
    return AS2/(tower_name(k,state)+('-col.obj' if collider else '.obj'))
