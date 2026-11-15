"""Reassemble damaged texture atlases from existing pixels, without redrawing/resizing artwork."""
from pathlib import Path
import json,io,hashlib,numpy as np
from PIL import Image
R=Path(__file__).resolve().parent;out=R/'repaired-assets';refs=json.loads((R/'original-casualty-state-references.json').read_text());b=json.loads((R/'battle-original.json').read_text());done={};report=[]
for o in b['ContainedObjects']:
 m=json.loads(o.get('GMNotes') or '{}');profile=m.get('profile')
 if profile not in refs:continue
 for s in o.get('States',{}).values():
  url=s['CustomMesh']['DiffuseURL']
  if url in done:continue
  current=Image.open(R/'original-assets'/url.split('/')[-1]).convert('RGB')
  if current.size!=(1536,2048):continue
  match=json.loads((R/'matched-casualty-sources.json').read_text())[profile]
  assert match['difference']<2
  name=match['name']
  original_url='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/049c7a7692318ee03004ac4e789eef06b266e5c3/assets/tts/ancients-casualties-r1/'+name
  raw=(R/'recovered-casualty-art'/name).read_bytes()
  archived=Image.open(io.BytesIO(raw)).convert('RGB');assert archived.size==(2560,2048)
  # Recover the exact original casualty column and preserve every current pixel.
  assembled=archived.copy();assembled.paste(current,(0,0))
  stem='restored-atlas-'+hashlib.sha256(assembled.tobytes()).hexdigest()[:20];filename=stem+'.png';assembled.save(out/filename)
  check=np.array(Image.open(out/filename));assert np.array_equal(check[:,:1536],np.array(current));assert np.array_equal(check[:,2048:],np.array(archived)[:,2048:])
  assert np.abs(np.array(current)[:1050].astype(float)-np.array(archived)[:1050,:1536]).mean()<2
  done[url]=filename
  report.append({'profile':profile,'original_url':url,'repaired_file':filename,'source_casualty_url':original_url,'source_discovered_in':'Lobo-Ancients-Workshop-R23-Installer.zip / Source/build_r15.py','current_pixels_preserved_exactly':True,'original_casualty_pixels_restored_exactly':True,'sha256':hashlib.sha256((out/filename).read_bytes()).hexdigest()})
(R/'atlas-repair-manifest.json').write_text(json.dumps(report,indent=2));print('Restored original casualty panels:',len(report))
