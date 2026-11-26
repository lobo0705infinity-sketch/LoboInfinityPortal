"""Export the saved Tech-Coffin prefab mesh and texture for the external preview."""
from base import ORIGINAL,WORK,local
import UnityPy

def extract():
    objective=next(o for o in ORIGINAL['ContainedObjects'] if o['GUID']=='c7f100')
    bundle=UnityPy.load(str(local(objective['CustomAssetbundle']['AssetbundleURL'])))
    for record in bundle.objects:
        if record.type.name in ('Mesh','Texture2D'):
            obj=record.read()
            if obj.m_Name=='TechCoffin':
                if record.type.name=='Mesh':(WORK/'tech-coffin.obj').write_text(obj.export())
                else:obj.image.save(WORK/'tech-coffin.png')
if __name__=='__main__':extract()
