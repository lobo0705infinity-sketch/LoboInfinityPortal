"""Prepare the state comparison and the in-world lab close-up for the review folder."""
from PIL import Image,ImageDraw,ImageFont
from rooftops import Path,OUT,WORK


def font(size,bold=False):
    face='OpenSans-Semibold.ttf' if bold else 'OpenSans-Regular.ttf'
    return ImageFont.truetype(str(Path('/usr/share/fonts/truetype/open-sans')/face),size)


def prepare():
    page=Image.new('RGB',(1596,640),'#1b2c32')
    draw=ImageDraw.Draw(page)
    draw.text((28,10),'Courier Spire',font=font(38,True),fill='#f0f2eb')
    draw.text((1568,28),'Cloudbreak Array  /  Harmony City',font=font(22),fill='#b9c7c8',anchor='ra')
    for i,(name,label) in enumerate([('courier-floor','State 1    Dispatch floor'),('courier-roof','State 2    Rooftop and greenhouse')]):
        image=Image.open(WORK/(name+'.png')).convert('RGB')
        image.thumbnail((758,490),Image.Resampling.LANCZOS)
        x=28+i*784
        page.paste(image,(x,79))
        draw.text((x,585),label,font=font(26,True),fill='#e3e9e7')
    page.save(OUT/'Cloudbreak-Array-R4-Courier-Spire.jpg',quality=93,subsampling=0)
    Image.open(WORK/'lab.png').convert('RGB').save(OUT/'Cloudbreak-Array-R4-Weather-Lab.jpg',quality=93,subsampling=0)


if __name__=='__main__':prepare()
