from base import *
from assemble import build_bag
from scipy.spatial.transform import Rotation
def manifest():
    bag=build_bag();rows=[]
    def resource(u):return str((ASSETS/u.split('/')[-1]) if '/'+PREFIX+'/' in u else local(u))
    def descend(o,parent):
        t=parent@matrix(o['Transform']);cm=o.get('CustomMesh',{});base=cm.get('MeshURL')
        if base:
            col=o.get('ColorDiffuse',{});color=[float(col.get(k,1))for k in ['r','g','b','a']]
            glass='glass' in ' '.join(o.get('Tags',[])).lower() or 'glaz' in o.get('Nickname','').lower() and 'glass' in base
            rows.append({'name':o['Nickname'],'mesh':resource(base),'image':resource(cm['DiffuseURL']) if cm.get('DiffuseURL') else '', 't':t.tolist(),'rgba':color,'glass':glass})
        if o['GUID'].startswith('c7f') and o['Name']=='Custom_Assetbundle':
            # Native Unity prefab transforms exported from the original mission objective.
            child=np.eye(4);child[:3,:3]=Rotation.from_quat([-.581407547,-.407184035,-.405585378,.575905323]).as_matrix()@np.diag([80.2216873,80.2216797,80.2216949]);child[:3,3]=[-2.07829452,12.7776670,-.03887921]
            root=np.diag([.4,.4,.4,1]);rows.append({'name':'Tech-Coffin','mesh':str(WORK/'tech-coffin.obj'),'image':str(WORK/'tech-coffin.png'),'t':(t@root@child).tolist(),'rgba':[1,1,1,1],'glass':False})
        for ch in o.get('ChildObjects',[]):descend(ch,t)
    for o in bag['ContainedObjects']:descend(o,np.eye(4))
    dump(WORK/'render-scene.json',rows)
if __name__=='__main__':manifest()
