from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
root=Path(__file__).resolve().parent;review=root/'Review'
page=Image.new('RGB',(1580,728),'#f4f0e7');dr=ImageDraw.Draw(page)
def font(path,n):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/'+path,n)
ink='#203c40';muted='#475c58'
dr.text((40,24),'Azure Palace',font=font('DejaVuSerif.ttf',52),fill=ink)
dr.text((1538,48),'Crossing Lines  /  R7',font=font('DejaVuSans.ttf',22),fill=muted,anchor='ra')
for x,name,heading,caption in [(40,'porter-lodge','Resort Reception','Porter’s lodge, luggage lockers and covered waiting bay.'),(804,'villa-garden','East Guest Villa','The garden walls, planting and seating on the villa’s patio.')]:
    tile=ImageOps.fit(Image.open(review/(name+'.png')).convert('RGB'),(736,487),method=Image.Resampling.LANCZOS)
    page.paste(tile,(x,111));dr.text((x,617),heading,font=font('DejaVuSans-Bold.ttf',29),fill=ink)
    dr.text((x,663),caption,font=font('DejaVuSans.ttf',20),fill=muted)
page.save(root/'delivery/Azure-Palace-R7-Corners.jpg',quality=93,optimize=True,subsampling=0)
thumb=Image.open(review/'overview.png').convert('RGB');thumb.thumbnail((850,630),Image.Resampling.LANCZOS);thumb.save(root/'Release/Preview.png',optimize=True)
