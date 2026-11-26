"""Maritime paint, stone, rope and timber made from CC0 site scans with selectively placed wear."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
import numpy as np
from scipy.ndimage import gaussian_filter
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT;PHOTOS=Path(__file__).resolve().parent/'references';COLS=8;SIZE=256
materials={
'teak':('weathered_brown_planks',(129,101,71)), 'plywood':('rough_wood',(154,125,83)), 'darkwood':('rough_wood',(104,77,55)),
'gate':('rusty_painted_metal',(69,103,102)), 'gatebeam':('rusty_painted_metal',(72,89,84)), 'iron':('rusty_painted_metal',(54,58,57)),
'steel':('worn_corrugated_iron',(109,121,119)),'edge':('worn_corrugated_iron',(169,176,167)), 'cable':('rusty_painted_metal',(76,82,77)),
'stone':('concrete_wall_003',(167,165,146)),'wetstone':('concrete_wall_003',(151,149,128)), 'coping':('concrete_wall_003',(177,174,155)),
'tyre':('concrete_wall_003',(43,44,43)), 'rubber':('concrete_wall_003',(50,51,48)), 'cab':('rusty_painted_metal',(84,115,112)),
'body':('rusty_painted_metal',(106,121,122)), 'ivory':('rusty_painted_metal',(190,188,161)), 'glass':('worn_corrugated_iron',(55,79,85)),
'red':('rusty_painted_metal',(144,58,44)), 'amber':('worn_corrugated_iron',(189,139,65)), 'white':('worn_corrugated_iron',(212,210,182)),
'brass':('rusty_painted_metal',(150,123,75)), 'roof':('worn_corrugated_iron',(102,119,117)), 'soot':('rusty_painted_metal',(65,66,63)),
'mark':('rusty_painted_metal',(166,135,66)), 'bolt':('worn_corrugated_iron',(126,129,122)), 'grip':('concrete_wall_003',(73,80,76)),
'carton':('rough_wood',(155,133,99)), 'gauge':('rusty_painted_metal',(216,210,178)), 'sign':('rusty_painted_metal',(78,100,95)),
'plates':('rusty_painted_metal',(181,171,131)), 'tag':('rough_wood',(193,185,151)), 'stripe':('rusty_painted_metal',(189,157,75))}
INDEX={n:i for i,n in enumerate(materials)}
def font(size,heavy=False):
 face='DejaVuSansCondensed-Bold' if heavy else 'DejaVuSansCondensed'
 return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/'+face+'.ttf',size)
# Separate cells for vehicle bodies, upholstery, enameled lettering and tidal-yard materials.
extra={
 'fleetblue':('rusty_painted_metal',(83,117,125)), 'fleetcream':('rusty_painted_metal',(196,193,169)),
 'fleetochre':('rusty_painted_metal',(170,126,62)), 'fleetgreen':('rusty_painted_metal',(101,124,105)),
 'zinc':('worn_corrugated_iron',(163,167,159)), 'marinewhite':('weathered_brown_planks',(176,179,164)),
 'hullblue':('weathered_brown_planks',(66,103,111)), 'canvas':('rough_wood',(102,119,104)),
 'redoxide':('rusty_painted_metal',(128,72,56)), 'tyrewall':('concrete_wall_003',(39,42,40)),
 'windshield':('worn_corrugated_iron',(73,88,91)), 'sidelight':('worn_corrugated_iron',(67,77,76)),
 'lamp':('worn_corrugated_iron',(204,213,204)), 'netting':('rough_wood',(75,94,78)),
 'boardgreen':('weathered_brown_planks',(106,127,111)), 'washedconcrete':('concrete_wall_003',(157,158,144)),
 'ferryboard':('rusty_painted_metal',(226,220,192)),
 'weighsign':('rusty_painted_metal',(54,78,75)), 'fleetmark':('rusty_painted_metal',(63,88,89)),
 'fishmark':('rusty_painted_metal',(188,196,184)), 'watermark':('rusty_painted_metal',(86,113,97)),
 'fittermark':('rusty_painted_metal',(158,126,80)), 'boatname':('weathered_brown_planks',(48,81,88)),
 'fleetplate1':('rusty_painted_metal',(199,177,103)), 'fleetplate2':('rusty_painted_metal',(199,177,103)),
 'fleetplate3':('rusty_painted_metal',(199,177,103)), 'fleetplate4':('rusty_painted_metal',(199,177,103)),
 'tankalloy':('worn_corrugated_iron',(156,162,149)), 'redlamp':('worn_corrugated_iron',(155,45,35)),
 'ferrysign':('rusty_painted_metal',(57,85,84)), 'valvelabel':('rusty_painted_metal',(191,181,146))
}
INDEX.update({k:len(materials)+i for i,k in enumerate(extra)})
assert len(INDEX)<=COLS*COLS

def sign_tile(key,bg):
    specs={
      'ferrysign':(768,160,['SALTWICK  FERRY'],(232,227,199)),
      'ferryboard':(410,520,['SALTWICK  FERRY','DEPARTURES','07:10   WEST PIER','07:45   LOCK POINT','08:10   WEST PIER','08:45   LOCK POINT','CHECK TIDE BOARD'],(48,68,65)),
      'weighsign':(810,180,['WEIGH  OFFICE'],(230,224,193)),
      'fleetmark':(920,215,['SALTWICK   PORT','GOODS  INWARD'],(224,219,192)),
      'fishmark':(900,245,['SALTWICK','COLD  STORES'],(54,87,102)),
      'watermark':(860,190,['PORT  WATER  SERVICES'],(235,229,204)),
      'fittermark':(730,165,['SLIPWAY  ENGINEERING'],(51,59,55)),
      'boatname':(740,160,['M A R L O W'],(238,222,176)),
      'valvelabel':(630,210,['QUAY  PUMP','VALVE  02'],(46,61,55)),
    }
    for i,num in enumerate(['SJ 268','SW 417','SL 532','SP 104'],1):
        specs['fleetplate'+str(i)]=(530,125,[num],(43,45,40))
    if key not in specs:return None
    w,h,lines,ink=specs[key]
    surface=ImageOps.fit(bg,(w,h));draw=ImageDraw.Draw(surface)
    margin=8 if w>600 else 6
    draw.rounded_rectangle((margin,margin,w-margin-1,h-margin-1),radius=5,outline=ink,width=3)
    step=(h-20)/len(lines)
    for i,line in enumerate(lines):
        cap=int(step*(.59 if len(lines)>3 else .66))
        face=font(cap,True)
        while draw.textlength(line,font=face)>w*.90 and cap>12:
            cap-=2;face=font(cap,True)
        draw.text((w/2,10+step*(i+.5)),line,font=face,anchor='mm',fill=ink)
    return surface.resize((SIZE,SIZE),Image.Resampling.LANCZOS)

def build_harbour():
    previous=PHOTOS
    atlas=Image.open(previous/'quayside-diffuse.jpg').convert('RGB')
    normal=Image.open(previous/'quayside-normal.png').convert('RGB')
    panorama=Image.open(PHOTOS/'estuary-day.jpg').convert('RGB')
    rng=np.random.default_rng(11263);y,x=np.mgrid[:SIZE,:SIZE]
    for key,(source,colour) in extra.items():
        idx=INDEX[key];base=Image.open(PHOTOS/(source+'.jpg')).convert('RGB')
        a=np.asarray(ImageOps.fit(base,(SIZE,SIZE)),float);lum=a@np.array([.24,.60,.16]);detail=lum-lum.mean()
        wood=key in ('marinewhite','hullblue','boardgreen','netting')
        strength=.62 if wood or key in ('washedconcrete','zinc')else .27
        rgb=np.asarray(colour)+detail[:,:,None]*strength
        if key in ('fleetblue','fleetcream','fleetochre','fleetgreen','tankalloy','redoxide','zinc'):
            scratches=gaussian_filter(rng.normal(size=(SIZE,SIZE)),(.55,7))
            rgb+=np.clip(scratches-0.17,0,1)[:,:,None]*16
            rgb-=np.clip((y/SIZE-.62)/.38,0,1)[:,:,None]*(3+5*np.sin(x/28)**2)[:,:,None]
        if key=='washedconcrete':
            rgb-=(np.clip((y/SIZE-.57)/.43,0,1)*(18+9*np.sin(x/29)))[:,:,None]
            rgb[:,:,1]+=2
        if key in ('tyrewall','canvas','netting'):
            rgb+=(2.8*np.sin(x*(1.6 if key=='tyrewall'else 2.2))+1.9*np.cos(y*2.13))[:,:,None]
        if key in ('windshield','sidelight'):
            w,h=panorama.size
            crop=(int(w*.46),int(h*.28),int(w*.68),int(h*.65)) if key=='windshield' else (int(w*.16),int(h*.36),int(w*.30),int(h*.69))
            env=np.asarray(panorama.crop(crop).resize((SIZE,SIZE),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(2.1)),float)
            reflection=env@np.array([.24,.60,.16]);reflection=np.clip(reflection,24,231)
            rgb=(np.array([32,46,46])+reflection[:,:,None]*np.array([.29,.35,.39]))
            rgb-=np.clip((y/SIZE-.53)/.47,0,1)[:,:,None]*np.array([8,12,14])
            rgb-=np.exp(-((y-199+10*np.sin(x/143))/8)**2)[:,:,None]*3.5
        if key in ('lamp','redlamp'):
            rgb+=(np.cos(x*.78)*7.5+np.cos(y*.73)*4+21*np.exp(-((x-89)**2+(y-86)**2)/1300))[:,:,None]
        cell=Image.fromarray(np.uint8(np.clip(rgb,0,255)));lettered=sign_tile(key,cell)
        if lettered:cell=lettered
        cx,cy=(idx%COLS)*SIZE,(idx//COLS)*SIZE;atlas.paste(cell,(cx,cy))
        gy,gx=np.gradient(gaussian_filter(lum,.8));power=.014 if wood or key=='washedconcrete'else .003
        if key in ('windshield','sidelight','lamp','redlamp') or lettered:power=.0008
        ns=np.stack((-gx*power,gy*power,np.ones_like(lum)),axis=-1);ns/=np.linalg.norm(ns,axis=-1)[:,:,None]
        normal.paste(Image.fromarray(np.uint8((ns*.5+.5)*255)),(cx,cy))
    atlas.save(OUT/'harbour-diffuse.jpg',quality=95,subsampling=0,optimize=True)
    normal.save(OUT/'harbour-normal.png',optimize=True)
