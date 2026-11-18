"""Reject drift from the canonical Map Controls standard before release."""
from pathlib import Path
import argparse,json,re,hashlib,zipfile
from patch_maps import bags,walk,ROOT
from lupa.lua52 import LuaRuntime

def validate(path):
 if path.suffix=='.zip':
  with zipfile.ZipFile(path)as z:
   entry=next(n for n in z.namelist()if n.endswith('Workshop-Save.json'))
   data=json.loads(z.read(entry))
 else:data=json.loads(path.read_text())
 maps=list(bags(data));assert maps,'No map setups found'
 canonical=(ROOT/'standard-broker.lua').read_text();scripts=set();brokers=0
 for b in maps:
  owners=[o for o in walk(b)if 'LOBO_STANDARD_VERSION=1'in o.get('LuaScript','')]
  assert len(owners)==1,(b['GUID'],'missing or duplicate standard owner')
  for o in walk(b):
   s=o.get('LuaScript','')
   if not s:continue
   if o is not b:assert s.isascii(),(b['GUID'],o['GUID'],'non-ASCII map object script')
   scripts.add(s)
   match=re.search(r'local loboLifeBrokerData=(".*")',s)
   if match:
    embedded=json.loads(json.loads(match[1]))['LuaScript']
    assert embedded==canonical,(b['GUID'],o['GUID'],'panel drift')
    brokers+=1
  owner=owners[0]['LuaScript']
  for fn in ['loboRotateMap180','loboStandardClear','loboStandardGrid','loboStandardMissionOpen','loboZonePickColor','loboStandardInvoke']:
   assert 'function '+fn+'('in owner,(b['GUID'],fn)
 compiler=LuaRuntime().eval('function(s) local fn,err=load(s); return fn~=nil,err end')
 for s in scripts:
  ok,error=compiler(s);assert ok,error
 result={'passed':True,'maps':len(maps),'embedded_canonical_brokers':brokers,'unique_scripts_compiled':len(scripts),'canonical_sha256':hashlib.sha256(canonical.encode()).hexdigest()}
 print(json.dumps(result));return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('path',nargs='?',type=Path,default=ROOT/'output/Workshop-Save.json');p.add_argument('--report',type=Path);a=p.parse_args();r=validate(a.path)
 if a.report:a.report.write_text(json.dumps(r,indent=2))
