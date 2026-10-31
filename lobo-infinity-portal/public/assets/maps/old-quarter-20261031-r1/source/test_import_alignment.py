"""Regression for TTS OBJ X conversion: board holes and local placements.
Offline simulation of the import convention, not a live TTS physics test.
"""
from pathlib import Path
import json
import numpy as np
from shapely.geometry import Polygon,box
from shapely.affinity import rotate,translate
from shapely.ops import unary_union
from tts_geometry import load_tts_mesh
from map_config import PIT_DEPTH,PIT_WIDTH,PIT_LENGTH
R=Path(__file__).resolve().parents[1];A=R/'Assets'
layout=json.loads((R/'Source/layout.json').read_text())
def surface(mesh,y):
 return unary_union([Polygon(t[:,[0,2]]) for t in mesh.triangles if np.max(abs(t[:,1]-y))<1e-5 and Polygon(t[:,[0,2]]).area>1e-6])
mat=load_tts_mesh(A/'urban-street-mat-collider.obj')
street=surface(mat,0);floor=surface(mat,-PIT_DEPTH)
expected=box(-24,-24,24,24);pits=[]
for p in layout:
 if p['kind']!='dig':continue
 hole=box(p['x']-PIT_WIDTH/2,p['z']-PIT_LENGTH/2,p['x']+PIT_WIDTH/2,p['z']+PIT_LENGTH/2);pits.append(hole);expected=expected.difference(hole)
 assert street.intersection(hole.buffer(-.001)).area<1e-6
 assert hole.symmetric_difference(floor.intersection(hole)).area<1e-6
assert expected.symmetric_difference(street).area<1e-6
# Compare global pavement with the footprint under each placed local building.
rings=[]
for p in layout:
 if p['kind']!='building':continue
 k=p['mesh'].split('-state-')[0]
 if k=='civic':poly=Polygon([(-4,-3),(4,-3),(4,0),(1,0),(1,3),(-4,3)])
 elif k=='annex':poly=box(-3.2,-3,3.2,3)
 elif k=='ruin':poly=Polygon([(-3.5,-3),(3.5,-3),(3.5,1.4),(1.4,3),(-3.5,3)])
 elif k=='depot':poly=box(-3,-2.4,3,2.4)
 else:
  w=3.4 if k=='utility-kiosk' else 4.2;poly=box(-w/2,-1.5,w/2,1.5)
 pad=.35 if k in ['utility-kiosk','site-office'] else .48
 ring=poly.buffer(pad,join_style=2).difference(poly)
 rings.append(translate(rotate(ring,-p['angle'],origin=(0,0)),p['x'],p['z']))
actual=surface(load_tts_mesh(A/'urban-pavements.obj'),.115)
error=actual.symmetric_difference(unary_union(rings)).area
assert error<.003,error
result={'importConvention':'X reflection with winding correction','pitCutsAndFloorsAligned':len(pits),'buildingPavementsAligned':len(rings),'pavementSymmetricDifferenceSquareInches':error,'scope':'Offline OBJ import simulation; live TTS check pending.'}
(R/'Source/import-alignment-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
