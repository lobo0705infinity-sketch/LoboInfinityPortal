import json,subprocess
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).parent
out=root/'assets'
def font(n,bold=False):
    f='/usr/share/fonts/truetype/dejavu/DejaVuSans'
    return ImageFont.truetype(f+('-Bold.ttf' if bold else '.ttf'),n)
def bake(job):
    key,state,url,uv,name,color,quality,line2,line3=job
    source=subprocess.check_output(['curl','-fsSL','--retry','2','--max-time','35',url])
    img=Image.open(BytesIO(source)).convert('RGB')
    u0,v0,u1,v1=uv
    w,h=img.size
    x0,x1=round(u0*w),round(u1*w)
    y0,y1=round((1-v1)*h),round((1-v0)*h)
    ww,hh=x1-x0,y1-y0
    label=Image.new('RGB',(ww,hh),color)
    d=ImageDraw.Draw(label)
    body_x=int(ww*.17)
    line_size=round(hh*.37)
    while font(line_size,True).getlength(name.upper())>ww*.77:line_size-=1
    d.text((int(ww*.06),int(hh*.19)),quality,font=font(round(hh*.43),True),fill='#FAF4DF')
    d.line((int(ww*.145),hh*.14,int(ww*.145),hh*.88),fill='#E1CC9B',width=max(1,round(ww/600)))
    d.text((body_x,int(hh*.06)),name.upper(),font=font(line_size,True),fill='#FAF4DF')
    d.text((body_x,int(hh*.49)),line2,font=font(round(hh*.23)),fill='#FAF4DF')
    d.text((body_x,int(hh*.75)),line3,font=font(round(hh*.17)),fill='#FAF4DF')
    img.paste(label,(x0,y0))
    img.save(out/f'{key}-{state}.png',compress_level=4)
if __name__=='__main__':
    out.mkdir(exist_ok=True)
    with ThreadPoolExecutor(10) as p:
        list(p.map(bake,json.loads((root/'asset-plan.json').read_text())))
