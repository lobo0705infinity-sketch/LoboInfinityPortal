"""Rebuild the R2 OBJ models and photo atlas. Requires numpy, scipy and Pillow."""
import json
from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
from finishes import PHOTOS,build_harbour,materials,extra
from fleet import build as build_fleet
from harbour import slipway,ferry,netyard,floodwall,weigh_office,ice_dispatch

def read_url(u):
    with urlopen(Request(u,headers={'User-Agent':'Saltwick-custom-scenery'}),timeout=30) as response:
        return response.read()

def prepare():
    PHOTOS.mkdir(exist_ok=True)
    prefix='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'
    meshes=prefix+'2620d023caf8b4af62aae6c1be11df388187b303/assets/tts/saltwick-quay-review/'
    urls={'estuary-day.jpg':prefix+'13f482a0d76dc3113da3667259bd42d4eb3c3149/assets/tts/saltwick-layout-418/saltwick-day.jpg',
          'quayside-diffuse.jpg':meshes+'quayside-diffuse.jpg','quayside-normal.png':meshes+'quayside-normal.png'}
    for name,url in urls.items():
        if not (PHOTOS/name).exists():(PHOTOS/name).write_bytes(read_url(url))
    def photo(asset):
        target=PHOTOS/(asset+'.jpg')
        if target.exists():return
        spec=json.loads(read_url('https://api.polyhaven.com/files/'+asset))
        k=next(k for k in ['Diffuse','diffuse','color','Color','albedo','Albedo'] if k in spec)
        sizes=spec[k]['1k'];target.write_bytes(read_url((sizes.get('jpg')or sizes['png'])['url']))
    with ThreadPoolExecutor(5) as pool:list(pool.map(photo,sorted({x[0] for x in {**materials,**extra}.values()})))
if __name__=='__main__':
    prepare();build_harbour();build_fleet()
    for model in (slipway,ferry,netyard,floodwall,weigh_office,ice_dispatch):model().write()
