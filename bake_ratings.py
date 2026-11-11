"""Bake army-colored labels into the existing plaque UV rectangle."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

from PIL import Image, ImageColor, ImageDraw, ImageFont, ImageOps, JpegImagePlugin
from io import BytesIO

PALETTE = {
    'Macedon': ('#244DA8','#FFFFFF'), 'Persia': ('#713B91','#FFFFFF'),
    'Rome': ('#A52532','#FFFFFF'), 'Carthage': ('#126B61','#FFFFFF'),
    'India': ('#E59A28','#111111'), 'Ptolemaic Egypt': ('#E4C44D','#111111'),
    'Seleucid Empire': ('#A9C5DA','#111111'), 'Rome and Pergamon': ('#CC512C','#FFFFFF'),
    'Eastern Roman Empire': ('#E8DEC5','#111111'), 'Gothic Coalition': ('#353D46','#FFFFFF'),
}
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans'

@lru_cache(maxsize=160)
def font(size,bold=False):
    return ImageFont.truetype(FONT+('-Bold' if bold else '')+'.ttf',size)

def fit(draw, s, limit, size, bold=False):
    while draw.textlength(s,font=font(size,bold)) > limit:
        size -= 1
    assert size >= 15, (s,size)
    return font(size,bold)

def label(d):
    bg, fg = PALETTE[d['army']]
    im = Image.new('RGB',(720,160),bg)
    draw = ImageDraw.Draw(im)
    blend = tuple(round(x*.60+y*.40) for x,y in zip(ImageColor.getrgb(bg),ImageColor.getrgb(fg)))
    draw.text((55,80),d['quality'],font=fit(draw,d['quality'],87,63,True),anchor='mm',fill=fg)
    draw.line((106,22,106,138),fill=blend,width=2)
    name = d['name'].upper()
    draw.text((130,15),name,font=fit(draw,name,568,43,True),fill=fg)
    kind = d['type']
    if kind in ('Heavy','Medium','Light','Rigid'):kind += ' Infantry'
    detail = ' · '.join(x for x in (kind,d['weapons']) if x)
    draw.text((132,70),detail,font=fit(draw,detail,568,24),fill=fg)
    if not d['commander']:
        def val(v):
            return str(v) if v not in (None,'') else '—'
        stats = f"CV Foot {val(d['cv_foot'])}   CV Mounted {val(d['cv_mounted'])}   CB {val(d['cb'])}   MD {val(d['md'])}"
        draw.text((132,112),stats,font=fit(draw,stats,568,23),fill=fg)
    return im

def read_image(url, inputs):
    if inputs:
        return (inputs/url.rsplit('/',1)[-1]).read_bytes()
    for attempt in range(3):
        try:
            with urlopen(url,timeout=45) as r:
                return r.read()
        except OSError:
            if attempt == 2:raise

def bake(url, d, rects, inputs, output, name):
    raw=read_image(url,inputs)
    original=Image.open(BytesIO(raw))
    working=original.copy()
    rendered=label(d)
    regions=[]
    for u0,u1,v0,v1,flip_x,flip_y in rects:
        box=(round(u0*working.width),round((1-v1)*working.height),
             round(u1*working.width),round((1-v0)*working.height))
        w,h=box[2]-box[0],box[3]-box[1]
        assert w>=200 and h>=55,(url,box)
        art=rendered.resize((w,h),Image.Resampling.LANCZOS)
        if flip_x:art=ImageOps.mirror(art)
        if flip_y:art=ImageOps.flip(art)
        working.paste(art.convert(working.mode),box)
        regions.append(box)
    dst=output/name
    if original.format=='JPEG':
        working.save(dst,format='JPEG',qtables=original.quantization,
                     subsampling=JpegImagePlugin.get_sampling(original),optimize=True)
    elif original.format=='PNG':
        working.save(dst,format='PNG',compress_level=6)
    else:raise ValueError((url,original.format))
    with Image.open(dst) as check:
        assert check.size==original.size
        for x,y,_,_ in regions:
            a=check.convert('RGB').getpixel((x+4,y+4))
            b=ImageColor.getrgb(PALETTE[d['army']][0])
            assert max(abs(i-j) for i,j in zip(a,b))<18,(url,a,b)
    return name,hashlib.sha256(dst.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--inputs',type=Path)
    parser.add_argument('--workers',type=int,default=8)
    args=parser.parse_args()
    source=json.loads(args.plan.read_text())
    args.output.mkdir(parents=True,exist_ok=True)
    def one(item):
        url,d,rects,name=item
        return bake(url,d,rects,args.inputs,args.output,name)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results=dict(pool.map(one,source))
    assert len(results)==len(source)
    (args.output/'SHA256SUMS.json').write_text(json.dumps(results,indent=2)+'\n')
    print('Baked and verified',len(results),'textures',flush=True)

if __name__=='__main__':
    main()
