from pathlib import Path
from hashlib import sha1
import json,sys
R=Path(__file__).resolve().parents[1]
prefix='assets/tts/vanta-freeport-architecture-r2/'
def row(f,p):
 data=f.read_bytes();return dict(local=str(f),size=len(data),path=p,sha=sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest())
if sys.argv[-1]=='art':
 out=[row(f,prefix+f.name)for f in sorted((R/'assets').glob('*'))if f.is_file()]
else:
 out=[row(f,prefix+'source/'+f.name) for f in sorted((R/'src').glob('*.py'))]
 out += [row(f,prefix+'source/installer/'+f.name)for f in sorted((R/'installer').glob('*')) if f.is_file()]
 out += [row(R/'work'/'Vanta-Customs-Yard.json',prefix+'Stage-Bag.json'),row(R/'work'/'Play-Table.json',prefix+'Play-Table.json')]
 out += [row(f,prefix+f.name) for f in sorted((R/'dist').glob('*'))]
 out += [row(R/'work'/n,prefix+'verification/'+n) for n in ('qa.json','installer-qa.json','material-credits.txt')]
print(json.dumps(out))
