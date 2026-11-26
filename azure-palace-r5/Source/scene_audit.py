"""Check the complete deployed map, including compound joints, the pool rim and both objective models."""
from audit_surfaces import arrays,count
from common import *
def local(url):
    n=url.split('/')[-1]
    if '/azure-palace-r5/' in url:return OUT/n
    if '/azure-palace-r4/' in url:return R4/'Assets'/n
    if '/azure-palace-r2/' in url:return R2/'Assets'/n
    return next(d/n for d in [R2/'original/Assets',R2/'original/deps'] if (d/n).exists())
def triangles(o,t):
    a=math.radians(t['rotY']);c,s=math.cos(a),math.sin(a)
    shape=arrays(local(o['CustomMesh']['MeshURL']));shape[:,:,0]*=-1
    coords=shape*[t['scaleX'],t['scaleY'],t['scaleZ']]
    yield coords@np.array([[c,0,-s],[0,1,0],[s,0,c]])+[t['posX'],t['posY']-3.9,t['posZ']]
    for n in o.get('ChildObjects',[]):yield from triangles(n,t)
def main():
    reports={}
    for version,locroot in [('R5',ROOT),('R4',R4)]:
        play=read(locroot/'Release/Play-Table.json')
        objs=[o for o in play['ObjectStates']if 'LoboMap:87b699' in o.get('Tags',[]) and o.get('CustomMesh')]
        chosen=objs if version=='R5' else [o for o in objs if o['Nickname']=='Terrace Restaurant']
        meshes=[p for o in chosen for p in triangles(o,o['Transform'])];within,across=count(meshes)
        reports[version]={'triangles':sum(map(len,meshes)),'within_pairs':len(within),'interface_pairs':len(across),'same_facing_pairs':sum(q[1] for q in within+across),'largest':sorted(within+across,reverse=True)[:4]}
        print(version,reports[version],flush=True)
    write(ROOT/'Review/complete-surface-check.json',reports)
if __name__=='__main__':main()
