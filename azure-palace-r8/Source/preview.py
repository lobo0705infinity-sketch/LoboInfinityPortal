"""Make the play-table thumbnail and a four-panel detail sheet from the released meshes."""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
caps='/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf';regular='/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf'
items=[('porter-buggy','Electric baggage buggy','Resort Reception'),('pool-loungers','Teak loungers','Pool Club'),('banquet-dolly','Banquet-table dolly','Terrace Restaurant'),('housekeeping-cart','Housekeeping cart','North Guest Villa')]
def run():
    im=Image.new('RGB',(1660,1682),(239,236,226));draw=ImageDraw.Draw(im)
    for i,(slug,name,loc) in enumerate(items):
        x=22+824*(i%2);y=22+610*(i//2)
        pic=Image.open(ROOT/'Review'/(slug+'.png')).convert('RGB');pic.thumbnail((790,531),Image.Resampling.LANCZOS);im.paste(pic,(x,y))
        draw.text((x+3,y+544),name,font=ImageFont.truetype(caps,30),fill=(35,52,49))
        draw.text((x+5,y+580),loc,font=ImageFont.truetype(regular,19),fill=(67,81,73))
    for i,(slug,label,sub) in enumerate([('console','Crossing Lines console','Micro Art Studio · painted by MiG · 40 mm'),('overview','Azure Palace','Crossing Lines · full play table')]):
        x=22+824*i;y=1250
        pic=Image.open(ROOT/'Review'/(slug+'.png')).convert('RGB')
        pic.thumbnail((790,324),Image.Resampling.LANCZOS)
        im.paste(pic,(x+(790-pic.width)//2,y))
        draw.text((x+3,y+334),label,font=ImageFont.truetype(caps,28),fill=(35,52,49))
        draw.text((x+5,y+370),sub,font=ImageFont.truetype(regular,18),fill=(67,81,73))
    im.save(ROOT/'delivery/Azure-Palace-R8-Scatter.jpg',quality=91,optimize=True,subsampling=0)
    image=Image.open(ROOT/'Review/overview.png').convert('RGB');image.thumbnail((940,720),Image.Resampling.LANCZOS)
    image.save(ROOT/'Release/Preview.png',optimize=True)
if __name__=='__main__':run()
