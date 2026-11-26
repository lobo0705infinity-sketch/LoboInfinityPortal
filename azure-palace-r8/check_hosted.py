"""Byte-verify all assets in the installed Azure map, optional prop bag and native console."""
import hashlib,json,re,sys,time,urllib.request,concurrent.futures
from pathlib import Path
BASE=Path(__file__).resolve().parent;sys.path.insert(0,str(BASE/'Source'))
from validate_models import local_url,objects
read=lambda p:json.loads(p.read_bytes())
def run():
    urls={}
    for name in ['Azure-Palace.json','Azure-Palace-Scatter.json']:
        for root in read(BASE/'Release'/name)['ObjectStates']:
            for o in objects(root):
                for k,v in o.get('CustomMesh',{}).items():
                    if k.endswith('URL') and v:urls[v]=local_url(v)
                b=o.get('CustomAssetbundle',{})
                if b.get('AssetbundleURL'):urls[b['AssetbundleURL']]=BASE/'Review/cache/approved-console.unity3d'
                if o.get('GUID')=='8428d8':
                    cfg=json.loads(re.search(r'local config=JSON.decode\(\[==\[(.*?)\]==\]\)',o['LuaScript'],re.S)[1])
                    for k in ('day','night'):
                        u=cfg['background'][k];urls[u]=local_url(u)
    def fetch(entry):
        u,path=entry;data=path.read_bytes();expected=hashlib.sha256(data).digest()
        assert u.startswith('https://') and ('/ugc/' in u or re.search(r'/[0-9a-f]{40}/',u)),u
        for i in range(4):
            try:
                request=urllib.request.Request(u,headers={'Accept-Encoding':'identity','User-Agent':'Lobo-Azure-Palace-review'})
                with urllib.request.urlopen(request,timeout=23)as resp:body=resp.read()
                assert hashlib.sha256(body).digest()==expected,u
                return [u,len(body),expected.hex()]
            except Exception:
                if i==3:raise
                time.sleep(1+i)
    with concurrent.futures.ThreadPoolExecutor(12)as ex:results=list(ex.map(fetch,sorted(urls.items())))
    (BASE/'Review/hosted.json').write_text(json.dumps(results,indent=1));print('Verified',len(results),'distinct public assets, including the Steam console, new models, custom colliders, textures and day/night backgrounds.')
if __name__=='__main__':run()
