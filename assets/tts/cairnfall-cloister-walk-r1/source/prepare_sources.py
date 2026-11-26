"""Restore upstream models, textures, Stage saves and the production Infinity room used for this revision."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha1, sha256
from io import BytesIO
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'fbb23e200fcfd066cb020f95f47c344757247d9f'
PUBLIC = f'https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/{VERSION}/lobo-infinity-portal/public/assets/maps/'
BASES = {'100326':'9f628979086b55991fb354045206705491cb69a99e49ba722b67a68b1fd3dc9c',
         'bc00b7':'876bb2a638c07f71b4073681834e2ac963cb1b1d3fa858d3e2c3c9fdd35c5e24'}


def download(url):
    for attempt in range(4):
        try:
            with urlopen(Request(url,headers={'User-Agent':'Cairnfall-TTS-artwork'}), timeout=35) as response:
                return response.read()
        except OSError:
            if attempt==3:raise
            time.sleep(1+attempt)


def mesh_urls(nodes):
    if isinstance(nodes,list):
        for node in nodes:yield from mesh_urls(node)
    elif isinstance(nodes,dict):
        for key,value in nodes.items():
            if key.endswith('URL') and isinstance(value,str) and value.startswith('https://'):yield value
            elif isinstance(value,(list,dict)):yield from mesh_urls(value)


def prepare():
    for name in ('base','cache','assets','release','review','qa'):
        (ROOT/name).mkdir(exist_ok=True)
    for guid,digest in BASES.items():
        data=download(PUBLIC+'army-sideboards-20261126/'+guid+'.json')
        assert sha256(data).hexdigest()==digest
        (ROOT/'base'/(guid+'.json')).write_bytes(data)
    archive=download(PUBLIC+'saltwick-working-harbour-final-20261126/Lobo-Saltwick-Floodgate-Workshop-Installer-R4.zip')
    with ZipFile(BytesIO(archive)) as outer:
        with ZipFile(BytesIO(outer.read('Files/payload.zip'))) as inner:
            payload=inner.read('Play-Table.json')
            assert sha256(payload).hexdigest()==json.loads(inner.read('manifest.json'))['Play-Table.json']
            (ROOT/'base/Play-Room.json').write_bytes(payload)
    objects=json.loads((ROOT/'base/100326.json').read_bytes())['ObjectStates'][0]['ContainedObjects']
    owner=next(o for o in objects if 'LOBO_STANDARD_VERSION=1' in o.get('LuaScript',''))
    raw=re.search(r'^local backgroundConfig=JSON.decode\((.+)\)$',owner['LuaScript'],re.M)[1]
    sky=json.loads(json.loads(raw));urls=set(mesh_urls(objects))|{sky[k] for k in ('day','night','off')}
    def fetch(url):
        name=sha1(url.encode()).hexdigest()[:14]+'-'+url.rsplit('/',1)[-1].split('?')[0]
        dest=ROOT/'cache'/name
        if not dest.is_file():dest.write_bytes(download(url))
        return url,name
    with ThreadPoolExecutor(10) as workers:files=dict(workers.map(fetch,sorted(urls)))
    (ROOT/'base/cache.json').write_text(json.dumps(files,indent=1))

if __name__=='__main__':
    prepare()
