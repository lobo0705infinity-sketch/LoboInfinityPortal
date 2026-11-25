"""Build three horizontally layered, smoothly lit cloud banks bounded by the rules footprint."""
from district import *
from scipy.ndimage import gaussian_filter
from vtkmodules.vtkCommonDataModel import vtkImageData
from vtkmodules.vtkFiltersCore import vtkFlyingEdges3D,vtkDecimatePro,vtkPolyDataNormals
from vtkmodules.util.numpy_support import numpy_to_vtk,vtk_to_numpy
def cloud(index):
 rng=np.random.default_rng(880+index*19);n=73;axis=np.linspace(-1.32,1.32,n);x,y,z=np.meshgrid(axis,axis,axis,indexing='ij')
 # Broad low decks carry denser towers on the upper surface.
 centers=[(0,-.09,0,.75,.50,.70)]
 for i in range(17):
  ang=i*math.tau/17+rng.uniform(-.14,.14);r=rng.uniform(.39,.63);xx=r*math.cos(ang);zz=r*math.sin(ang);yy=rng.uniform(-.17,.12)
  centers.append((xx,yy,zz,rng.uniform(.23,.46),rng.uniform(.22,.53),rng.uniform(.26,.46)))
 for i in range(30):
  xx,yy,zz,sx,sy,sz=centers[rng.integers(1,18)];a=rng.uniform(0,math.tau)
  centers.append((xx+sx*.50*math.cos(a),yy+sy*rng.uniform(-.09,.59),zz+sz*.49*math.sin(a),sx*.54,sy*rng.uniform(.46,.75),sz*.60))
 field=np.full_like(x,-9)
 for xx,yy,zz,sx,sy,sz in centers:
  dist=1-np.sqrt(((x-xx)/sx)**2+((y-yy)/sy)**2+((z-zz)/sz)**2)
  mix=np.maximum(.19-abs(dist-field),0)/.19;field=np.maximum(field,dist)+mix*mix*.0475
 field+=.053*np.sin(17*x+3*y)*np.cos(13*z-5*y)+.025*np.cos(28*y+12*z)*np.sin(23*x-7*z)
 image=vtkImageData();image.SetDimensions(n,n,n);step=axis[1]-axis[0];image.SetOrigin(*([axis[0]]*3));image.SetSpacing(step,step,step);image.GetPointData().SetScalars(numpy_to_vtk(np.array(field,dtype='float32').ravel(order='F'),deep=True))
 edge=vtkFlyingEdges3D();edge.SetInputData(image);edge.SetValue(0,0);edge.Update()
 dec=vtkDecimatePro();dec.SetInputConnection(edge.GetOutputPort());dec.SetTargetReduction(max(0,1-3900/edge.GetOutput().GetNumberOfPolys()));dec.PreserveTopologyOn();dec.SplittingOff();dec.Update()
 normals=vtkPolyDataNormals();normals.SetInputConnection(dec.GetOutputPort());normals.SplittingOff();normals.AutoOrientNormalsOn();normals.ConsistencyOn();normals.Update();poly=normals.GetOutput()
 v=vtk_to_numpy(poly.GetPoints().GetData()).copy();ns=vtk_to_numpy(poly.GetPointData().GetNormals()).copy()
 rxz=np.sqrt(v[:,0]**2+v[:,2]**2).max();span=np.ptp(v[:,1]);v[:,[0,2]]*=.985/rxz;v[:,1]=.025+.95*(v[:,1]-v[:,1].min())/span
 ns/=np.array([.985/rxz,.95/span,.985/rxz]);ns/=np.maximum(np.linalg.norm(ns,axis=1)[:,None],1e-6)
 f=vtk_to_numpy(poly.GetPolys().GetConnectivityArray()).reshape(-1,3);m=native.Mesh()
 for ids in f:
  p=v[ids];nv=ns[ids]
  if np.dot(np.cross(p[1]-p[0],p[2]-p[0]),nv.mean(axis=0))<0:ids=ids[::-1];p=v[ids];nv=ns[ids]
  brightness=np.clip(.32+.32*p[:,1]-.14*nv[:,0]+.21*nv[:,1]+.10*nv[:,2],.035,.97)
  direct_face(m,p,[(float(b),float(.49+.35*np.sin(x*6+z*5)))for b,(x,y,z) in zip(brightness,p)],nv)
 m.solids.append((native.rect(0,0,.02,.02),-5.01,-4.99));export(m,'alto-'+str(index))
 print(index,len(v),len(f),flush=True)
if __name__=='__main__':
 for k in range(3):cloud(k)
