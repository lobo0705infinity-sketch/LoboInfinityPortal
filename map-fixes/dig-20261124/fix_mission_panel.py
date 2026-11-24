from pathlib import Path
import json,zipfile,io
R=Path(__file__).resolve().parents[2]
OLD="local lines=0;for line in (body..'\\n'):gmatch('(.-)\\n')do lines=lines+math.max(1,math.ceil(#line/75))end"
NEW="""local lines,start=0,1
   while true do
    local stop=string.find(body,'\\n',start,true)
    local length=(stop or (#body+1))-start
    lines=lines+math.max(1,math.ceil(length/75))
    if not stop then break end
    start=stop+1
   end"""
def patch(o):
 count=0
 if isinstance(o,dict):
  if OLD in o.get('LuaScript',''):o['LuaScript']=o['LuaScript'].replace(OLD,NEW);count+=1
  for v in o.values():
   if isinstance(v,(dict,list)):count+=patch(v)
 elif isinstance(o,list):
  for v in o:count+=patch(v)
 return count
if __name__=='__main__':
 p=R/'tts-map-controls-standard/standard-owner.lua';s=p.read_text();assert OLD in s;p.write_text(s.replace(OLD,NEW))
 for folder in ['dig-access-20261124','standard-controls-20261118']:
  for n in ['810340','8a1c29']:
   p=R/f'lobo-infinity-portal/public/assets/maps/{folder}/{n}.json';d=json.loads(p.read_text());assert patch(d)==1;p.write_text(json.dumps(d,separators=(',',':')))
 # Recover the exact R3 clean collection, retaining all other map versions.
 z=zipfile.ZipFile(R.parent/'recovered/Lobo-The-Dig-Clean-Workshop-Update-R3.zip');z=zipfile.ZipFile(io.BytesIO(z.read('Files/payload.zip')))
 base=R.parent/'r14-payload';base.mkdir(exist_ok=True)
 for n in ['Workshop-Save.json','Workshop-Save.png']:(base/n).write_bytes(z.read(n))
 p=R/'map-fixes/dig-20261124/package.py';s=p.read_text().replace('Access R3','Access R4').replace('Access-R3-','Access-R4-').replace('UPDATE R3','UPDATE R4').replace('SETUP R3','SETUP R4')
 s=s.replace('Changes: two pictured','R4 also fixes the Mission button text measurement error without changing its text, panel, or other controls.\n\nChanges: two pictured');p.write_text(s)
 print('Updated mission text measurement in both Dig variants; geometry and broker unchanged.')
