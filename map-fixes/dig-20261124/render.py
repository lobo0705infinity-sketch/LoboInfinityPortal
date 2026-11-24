import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from pathlib import Path
from mesh_tools import Obj
root=Path(__file__).resolve().parents[2];p=root/'lobo-infinity-portal/public/assets/maps/dig-access-20261124'
fig=plt.figure(figsize=(15,9))
for i,(f,label) in enumerate([('annex-state-1-mesh.obj','Annex ground'),('annex-state-2-mesh.obj','Annex upper'),('annex-state-3-mesh.obj','Annex roof'),('civic-state-2-mesh.obj','Civic upper / moved exterior ladder'),('civic-state-3-mesh.obj','Civic roof'),('terrain-cbd29d03-ledge-state-3-mesh.obj','Tenement ledge access')]):
 o=Obj(p/f);ax=fig.add_subplot(2,3,i+1,projection='3d');tri=o.v[o.faces][:,:,[0,2,1]];c=['#c7c9c9']*len(tri)
 # new ladder/landing geometry appended after the last original normal declaration
 start=next((j for j,l in enumerate(o.lines)if l.startswith('f ') ),0)
 lastold=max(j for j,l in enumerate(o.lines)if l.startswith('vn ')) if any(l.startswith('vn ')for l in o.lines)else 0
 # Gold faces are new geometry, identified by UV-only face refs after original faces.
 for j,idx in enumerate(o.fi):
  if '//'not in o.lines[idx] and len(o.lines[idx].split()[1].split('/'))==2:c[j]='#d7a322'
 ax.add_collection3d(Poly3DCollection(tri,facecolors=c,edgecolors='#555555',linewidths=.08,zsort='average'))
 ax.set(xlim=(-4.6,4.6),ylim=(-4.6,4.6),zlim=(0,8),title=label);ax.set_box_aspect((9.2,9.2,8));ax.view_init(75,115);ax.set_axis_off()
fig.tight_layout();fig.savefig(root/'map-fixes/dig-20261124/review.png',dpi=125)
