"""Compare inherited assets serving the map to their original, already used local bytes."""
from plan import *
from build_station import build
from base import get
from concurrent.futures import ThreadPoolExecutor
import hashlib
def verify():
 b=build();assets={u for o in b['ContainedObjects']for st in r2.walk(o)for f in ('CustomMesh','CustomAssetbundle')for k,u in st.get(f,{}).items()if k.endswith('URL')and u and '/'+PREFIX+'/' not in u}
 def job(u):
  p=resource(u);data=get(u);assert p.is_file() and data==p.read_bytes(),u
  return u,hashlib.sha256(data).hexdigest()
 with ThreadPoolExecutor(7) as pool:sums=dict(pool.map(job,sorted(assets)))
 write(W/'dependencies-qa.json',sums);print(len(sums),'inherited public map assets matched.')
if __name__=='__main__':verify()
