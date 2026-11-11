from concurrent.futures import ThreadPoolExecutor,ProcessPoolExecutor
from io import BytesIO
import hashlib,json,subprocess,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).parent
ART=ROOT/'wave-art'
OUT=ROOT/'wave-assets'
CACHE=ROOT/'wave-cache'
def cache_path(url):
    return CACHE/url.rsplit('/',1)[-1]
def fetch(url):
    path=cache_path(url)
    if path.exists():return
    if '--local' in sys.argv:
        path.symlink_to((Path.cwd()/'rim-work/assets'/path.name).absolute())
    else:
        path.write_bytes(subprocess.check_output(['curl','-fLsS','--retry','3','--max-time','40',url]))
def font(n,bold=False):
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold.ttf' if bold else '.ttf'),n)
def fit(text,n,width,bold=False):
    while font(n,bold).getlength(text)>width and n>5:n-=1
    return font(n,bold)
def bake_label(row):
    key,state,url,(u0,v0,u1,v1),name,color,quality,line2,line3=row
    img=Image.open(cache_path(url)).convert('RGB')
    w,h=img.size
    x0,x1=round(u0*w),round(u1*w);y0,y1=round((1-v1)*h),round((1-v0)*h)
    ww,hh=x1-x0,y1-y0
    label=Image.new('RGB',(ww,hh),color)
    d=ImageDraw.Draw(label)
    body=int(ww*.17); avail=ww-body-8
    fill='#FAF4DF'
    d.text((int(ww*.045),int(hh*.19)),quality,font=fit(quality,round(hh*.43),ww*.09,True),fill=fill)
    d.line((int(ww*.145),hh*.14,int(ww*.145),hh*.88),fill='#E1CC9B',width=max(1,round(ww/600)))
    d.text((body,int(hh*.06)),name.upper(),font=fit(name.upper(),round(hh*.37),avail,True),fill=fill)
    d.text((body,int(hh*.49)),line2,font=fit(line2,round(hh*.23),avail),fill=fill)
    d.text((body,int(hh*.75)),line3,font=fit(line3,round(hh*.17),avail),fill=fill)
    img.paste(label,(x0,y0))
    img.save(OUT/f'{key}-{state}.png',compress_level=4)
def map_assets(row):
    slug,colors,features,stands,heights=row
    pts=[(-48+4*x,-36+4*z) for z in range(19) for x in range(25)]
    with (OUT/(slug+'.obj')).open('w') as f:
        for (x,z),y in zip(pts,heights):f.write(f'v {x} {y:.6f} {z}\n')
        for x,z in pts:f.write(f'vt {(x+48)/96:.8f} {(36-z)/72:.8f}\n')
        for z in range(18):
            for x in range(24):
                a=z*25+x+1
                for tri in ((a,a+25,a+26),(a,a+26,a+1)):
                    f.write('f '+' '.join(f'{i}/{i}' for i in tri)+'\n')
    source=ART/(slug+'.jpg')
    (OUT/source.name).write_bytes(source.read_bytes())
    img=Image.open(source).convert('RGB').resize((1152,864))
    d=ImageDraw.Draw(img)
    pos=lambda x,z:(round((x+48)*12),round((z+36)*12))
    for x in (-16,16):
        d.line([pos(x,-36),pos(x,36)],fill='#D8C3A2',width=2)
    for _,x,z,kind in features:
        a,b=pos(x,z);d.ellipse((a-13,b-13,a+13,b+13),fill='#B89442' if kind in ('objective','exit') else '#417B87',outline='#FFF2CC',width=2)
    for t in stands:
        a,b=pos(t['x'],t['z'])
        d.rounded_rectangle((a-16,b-16,a+16,b+16),3,fill=colors[t['side']],outline='#F1D38B' if t['turn']>1 else '#F7ECD6',width=3 if t['turn']>1 else 1)
        d.text((a,b),t['code'],anchor='mm',font=font(12,True),fill='white')
    img.save(OUT/(slug+'-deployment.jpg'),quality=87)
if __name__=='__main__':
    OUT.mkdir(exist_ok=True)
    CACHE.mkdir(exist_ok=True)
    plan=json.loads((ROOT/'wave-plan.json').read_text())
    with ThreadPoolExecutor(18) as p:list(p.map(fetch,sorted({r[2] for r in plan['labels']})))
    with ProcessPoolExecutor(6) as p:
        list(p.map(map_assets,plan['maps']))
        for i,_ in enumerate(p.map(bake_label,plan['labels']),1):
            if i%60==0:print(i,'labels',flush=True)
    hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.iterdir()) if p.name!='manifest.json'}
    (OUT/'manifest.json').write_text(json.dumps(hashes,indent=2))
    print('Published asset set',len(hashes))
