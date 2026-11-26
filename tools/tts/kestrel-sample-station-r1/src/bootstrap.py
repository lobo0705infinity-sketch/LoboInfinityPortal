"""Fetch the exact saved room, source bag and geometry referenced by the playtest."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import Request,urlopen
from zipfile import ZipFile
import json

repo='lobo0705infinity-sketch/LoboInfinityPortal'
baseline='732fc9377335d0c626b7a00e2f586014162cd229'
terrain='c6e61136201dd2f85fd585bcfb17e9ad3b11927d'
raw=f'https://raw.githubusercontent.com/{repo}/'
root=Path(__file__).resolve().parents[1]
def get(url):
    with urlopen(Request(url,headers={'User-Agent':'Kestrel-Playtest-Build'}),timeout=45) as r:return r.read()
def bootstrap():
    for d in ['work','data','cache','assets','dist']:(root/d).mkdir(exist_ok=True)
    data=root/'data';work=root/'work'
    (data/'api').write_text(json.dumps({'object':{'sha':baseline}}))
    if not (data/'repo-tree.json').exists():
        (data/'repo-tree.json').write_bytes(get(f'https://api.github.com/repos/{repo}/git/trees/{baseline}?recursive=1'))
    source=raw+baseline+'/lobo-infinity-portal/public/assets/maps/'
    if not (data/'original-bag.json').exists():
        (data/'original-bag.json').write_bytes(get(source+'army-sideboards-20261126/1008da.json'))
    if not (data/'table.json').exists():
        baseline_installer=get(source+'cairnfall-courtyards-final-20261126/Lobo-Cairnfall-Sanctuary-Final-Workshop-Installer.zip')
        with ZipFile(BytesIO(baseline_installer)) as z,ZipFile(BytesIO(z.read('Files/payload.zip'))) as p:
            (data/'table.json').write_bytes(p.read('Play-Table.json'))
    names=json.loads((root/'qa/public-assets.json').read_bytes())
    def mesa(name):
        f=root/'assets'/name
        if not f.exists():f.write_bytes(get(raw+terrain+'/assets/tts/kestrel-sample-station-r1/'+name))
        assert sha256(f.read_bytes()).hexdigest()==names[name],name
    with ThreadPoolExecutor(8) as workers:list(workers.map(mesa,names))
    (work/'asset-pin.txt').write_text(terrain)
    (work/'public-qa.json').write_text(json.dumps(names))
if __name__=='__main__':bootstrap()
