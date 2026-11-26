from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
root=Path(__file__).resolve().parent;review=root/'Review'
page=Image.new('RGB',(1760,1500),'#f4f0e7');draw=ImageDraw.Draw(page)
def font(f,size):return ImageFont.truetype('/usr/share/fonts/truetype/'+f,size)
serif=font('dejavu/DejaVuSerif.ttf',61);sub=font('dejavu/DejaVuSans.ttf',22)
bold=font('dejavu/DejaVuSans-Bold.ttf',29)
ink='#203c40';muted='#49615e'
draw.text((49,30),'Azure Palace',font=serif,fill=ink)
draw.text((1710,63),'Crossing Lines   /   R6',font=sub,fill=muted,anchor='ra')
data=[('hotel-access','Seaward Hotel Wing','Two ladder flights meet at a landing on the second floor.'),
      ('sealed-rear','Rear elevation','The ground entrance stays open. Both upper bays are sealed.'),
      ('linen-yard','Service Laundry','Linen lockers and a trolley line the screened delivery court.'),
      ('villa-garden','East Guest Villa','The walled garden has a planted trellis and two ways out.')]
for i,(name,title,caption) in enumerate(data):
    x=50+(i%2)*848;y=133+(i//2)*672
    view=Image.open(review/(name+'.png')).convert('RGB')
    thumb=ImageOps.fit(view,(812,533),method=Image.Resampling.LANCZOS,centering=(.5,.52))
    page.paste(thumb,(x,y));draw.text((x,y+551),title,font=bold,fill=ink)
    draw.text((x,y+594),caption,font=sub,fill=muted)
draw.line((50,1447,1710,1447),fill='#c9c7b7',width=2)
draw.text((50,1461),'Rendered from the playtest save.',font=font('dejavu/DejaVuSans.ttf',18),fill=muted)
page.save(root/'delivery/Azure-Palace-R6-Map-Review.jpg',quality=92,subsampling=0,optimize=True)
im=Image.open(review/'overview.png').convert('RGB');im.thumbnail((850,630),Image.Resampling.LANCZOS);im.save(root/'Release/Preview.png',optimize=True)
