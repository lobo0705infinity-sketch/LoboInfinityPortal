from plan import *
from base import get
from concurrent.futures import ThreadPoolExecutor
import hashlib
pin=(W/'asset-pin.txt').read_text().strip()
def check(p):
 url=r2.RAW+pin+'/'+PREFIX+'/'+p.name
 data=get(url)
 assert data==p.read_bytes(),p.name
 return p.name,hashlib.sha256(data).hexdigest()
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=7) as pool:sums=dict(pool.map(check,sorted(p for p in A.iterdir() if p.is_file())))
 write(W/'public-qa.json',sums);print(len(sums),'public assets matched the authored bytes.')
