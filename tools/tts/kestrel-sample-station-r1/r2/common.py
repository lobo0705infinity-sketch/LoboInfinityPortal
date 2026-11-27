from pathlib import Path
import json,sys
R2=Path(__file__).resolve().parent
sys.path.insert(0,str(R2.parent/'src'))
from base import ROOT,WORK,ASSETS,DATA,ORIGINAL,RAW,PIN,PREFIX,mesh,world,matrix,local,walk,sha256
R1PIN='c6e61136201dd2f85fd585bcfb17e9ad3b11927d'
RELEASE='assets/tts/kestrel-sample-station-r2'
OUT=R2/'assets'
W=R2/'work'
D=R2/'dist'
for d in [OUT,W,D]:d.mkdir(exist_ok=True)
def read(p):return json.loads(p.read_bytes())
def write(p,a):p.write_text(json.dumps(a,ensure_ascii=False,separators=(',',':')))
def original_r1():return read(WORK/'bag.json')['ObjectStates'][0]
def resource(url):
    if '/'+RELEASE+'/' in url:return OUT/url.rsplit('/',1)[-1]
    if '/'+PREFIX+'/' in url:return ASSETS/url.rsplit('/',1)[-1]
    return local(url)
BLANKED={f'c7b{s}{i:02x}' for s in (1,2) for i in range(6)}|{f'e5101{i}' for i in range(4)}
