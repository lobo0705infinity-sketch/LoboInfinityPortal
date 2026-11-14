from pathlib import Path
import hashlib,json,shutil,zipfile
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent/'lagash-package';D=ROOT.parent/'deliverables';D.mkdir(exist_ok=True)
notes=OUT/'Build-notes/Lagash-R1';notes.mkdir(exist_ok=True)
for name in ['figure-manifest.json','geometry-checks.json','surface-grid.json','tree-root-checks.json','validation.json','commander-controls-validation.json','public-url-validation.json','installer-validation.json','hosted-assets.json','briefing.txt']:
 shutil.copy2(ROOT/name,notes/name)
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font=lambda n,b=False:ImageFont.truetype(bold if b else fontpath,n)
im=Image.new('RGB',(1800,1910),(24,29,34));d=ImageDraw.Draw(im)
d.text((65,34),'LAGASH vs UMMA',font=font(58,True),fill=(245,228,194))
d.text((65,109),'R1 · Longer spears · One cart per base · Normal / Wounded commanders',font=font(28),fill=(215,221,226))
tiles=[('lagash-guard-0-front.png','Long spears · 12 figures'),('lagash-cart-0-0-front.png','One complete cart and team'),('umma-spears-0-rear.png','Readable rear labels'),('lagash-command-army-0-front.png','Commander · NORMAL'),('lagash-command-army-1-front.png','Commander · WOUNDED'),('umma-command-army-1-rear.png','Wounded commander · rear')]
for i,(filename,caption) in enumerate(tiles):
 x=35+(i%3)*590;y=175+(i//3)*760
 image=Image.open(ROOT/'render'/filename).convert('RGB');image.thumbnail((555,670),Image.Resampling.LANCZOS)
 im.paste(image,(x+(555-image.width)//2,y));d.text((x+8,y+680),caption,font=font(26,True),fill='white')
d.text((65,1725),'46 stands · 6 commanders · 8 single-cart bases',font=font(31,True),fill=(245,228,194))
d.text((65,1780),'37 battle routes, 224 replacement-state events and 800 cache hashes checked.',font=font(25),fill=(215,221,226))
d.text((65,1830),'Offline mesh renders and simulations. Live Tabletop Simulator import remains unverified.',font=font(22),fill=(173,185,195))
review=D/'Lagash-vs-Umma-R1-Figure-Review.jpg';im.save(review,quality=94)
shutil.copy2(review,notes/review.name);shutil.copy2(ROOT/'render/field.png',notes/'Battlefield-Render.png')
shutil.copy2(ROOT/'assets/fe0002-deployment.jpg',notes/'Deployment-Map.jpg')
summary='''LAGASH VS UMMA R1 / FULL COLLECTION R8

Updated 46 stands with new front/rear figure artwork, varied poses and full spears.
Heavy infantry: 12 figures in three ranks of four; slingers: four figures.
Eight cart bases: one complete cart and team per base, in all three states.
Six commander bases: exactly Normal (1) and Wounded (2); visible bandages.
Two-inch round commander bases; three-inch square troop/cart bases.
Rear labels follow the Bannockburn format and all figures face right from the front.
Flanking canals, four dry causeways, levees, cultivated margins and 20 date palms.
Base-only collisions, disabled gravity and terrain-aware placement/state changes.

VALIDATION PASSED
37 Lua catalogue loading routes; other 36 battle bags unchanged as parsed JSON.
132 stand/state objects; 58 terrain drops; 224 actual replacement-object state events.
18 commander-control checks, including rejecting Shaken without a false confirmation.
46 OBJ files checked for valid vertices/UVs/faces and figure footprint bounds.
All 800 packaged cache hashes match. All 70 NEW public asset URLs were downloaded
and verified byte-for-byte. These URLs are pinned to commit
ebab11ee1d43230bc78bc14ef2729b7de3d68511.

LIMITS
These checks use offline renderers and a mocked TTS Lua API. Live TTS rendering,
fresh-cache two-player import and Windows installer execution remain unverified.

INSTALL
Extract the entire ZIP, close TTS, run Install-Clash-of-Empires.cmd, then open
Clash of Empires - Full Collection R8 - Lagash vs Umma R1 in Games > Save & Load.
Load Lagash vs. Umma from the battle selector. Existing older saves keep their
older figures. The installer creates a new save slot; it does not publish to Steam.

BUILD SOURCE
https://github.com/lobo0705infinity-sketch/LoboInfinityPortal/tree/ebab11ee1d43230bc78bc14ef2729b7de3d68511/l1-source
Baseline: Clash-of-Empires-Bannockburn-R3-Full-Collection-R7-Installer.zip.
'''
(notes/'Release-Validation.txt').write_text(summary)
(OUT/'Build-notes/Validation.txt').write_text(summary)
zip_path=D/'Clash-of-Empires-Lagash-vs-Umma-R1-Full-Collection-R8-Installer.zip'
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(OUT.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(OUT))
with zipfile.ZipFile(zip_path) as z:assert z.testzip() is None
record={'installer':str(zip_path),'bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'review':str(review)}
(ROOT/'delivery.json').write_text(json.dumps(record,indent=2));print(json.dumps(record))
