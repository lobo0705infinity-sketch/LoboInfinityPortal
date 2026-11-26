"""Restore the pinned R2 room, both R2 Stage bags and their referenced terrain."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from hashlib import sha1,sha256
from urllib.request import urlopen,Request
import json,re,time
BASE=Path(__file__).resolve().parents[1]
PARENT='6903ca69b7e32d0654103fc595f4db5289b35408'
URL='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'+PARENT+'/assets/tts/cairnfall-courtyards-r2/release/'
def get(url):
    for attempt in range(4):
        try:
            with urlopen(Request(url,headers={'User-Agent':'Cairnfall-Sanctuary'}),timeout=30) as r:return r.read()
        except OSError:
            if attempt==3:raise
            time.sleep(1+attempt)
def links(o):
    if isinstance(o,list):
        for v in o:yield from links(v)
    elif isinstance(o,dict):
        for k,v in o.items():
            if k.endswith('URL') and isinstance(v,str) and v.startswith('https://'):yield v
            elif isinstance(v,(list,dict)):yield from links(v)
def main():
    for name in ['base','cache','assets','release','review','deliver','qa']:(BASE/name).mkdir(exist_ok=True)
    for name in ['Cairnfall-Sanctuary.json','Cairnfall-Top40-Losers-R4.json','Play-Table.json']:
        (BASE/'base'/name).write_bytes(get(URL+name))
    bag=json.loads((BASE/'base/Cairnfall-Sanctuary.json').read_bytes())['ObjectStates'][0]
    owner=next(o for o in bag['ContainedObjects'] if 'LOBO_STANDARD_VERSION=1' in o.get('LuaScript',''))
    sky=json.loads(json.loads(re.search(r'^local backgroundConfig=JSON.decode\((.+)\)$',owner['LuaScript'],re.M)[1]))
    urls=set(links(bag['ContainedObjects']))|{sky[k]for k in ('day','night','off')}
    def fetch(u):
        n=sha1(u.encode()).hexdigest()[:14]+'-'+u.rsplit('/',1)[-1];p=BASE/'cache'/n
        if not p.is_file():p.write_bytes(get(u))
        return u,n
    with ThreadPoolExecutor(10)as pool:records=dict(pool.map(fetch,sorted(urls)))
    workshop=next(o for o in bag['ContainedObjects'] if 'Gardeners Chamfered Workshop' in o['Nickname'])
    for state in [workshop,workshop['States']['1']]:
        for field in ('MeshURL','ColliderURL'):
            url=state['CustomMesh'][field]
            (BASE/'base'/url.rsplit('/',1)[-1]).write_bytes((BASE/'cache'/records[url]).read_bytes())
    (BASE/'base/cache.json').write_text(json.dumps(records,indent=1))
if __name__=='__main__':main()
