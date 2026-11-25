"""Presentation sheets made from real bilateral mesh portraits and the same corner camera."""
from PIL import Image,ImageDraw,ImageFont,ImageOps
from rooftops import WORK,OUT,RELEASE
W=WORK/'fleet'
def font(sz,bold=False):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',sz)
def image(path):return Image.open(path).convert('RGB')
def build():
    page=Image.new('RGB',(1700,663),'#172830');d=ImageDraw.Draw(page)
    d.text((32,18),'Commuter Hall',font=font(39,True),fill='#f8f2e5')
    d.text((1668,30),'Cloudbreak Array   /   Upper Terminal',anchor='rt',font=font(23),fill='#c8d6d8')
    d.line((32,83,1668,83),fill='#647f86')
    for j,(key,txt) in enumerate((('before','Previous corner'),('after','Sealed corner'))):
        p=image(WORK/('corner-'+key+'.png'));p=ImageOps.fit(p,(810,470),method=Image.Resampling.LANCZOS)
        x=32+j*825;page.paste(p,(x,100));d.text((x,589),txt,font=font(29,True),fill='#f1e4c8')
    page.save(OUT/'Cloudbreak-Array-Sealed-Corners-R4.2.jpg',quality=91,subsampling=0,optimize=True)
    page=Image.new('RGB',(1600,1540),'#e5e9e5');d=ImageDraw.Draw(page)
    d.rectangle((0,0,1600,132),fill='#182b30');d.text((40,24),'Harmony City air traffic',font=font(48,True),fill='#faf4e9')
    d.text((42,88),'Cloudbreak Array',font=font(20),fill='#a9c3bd');d.text((1561,86),'PORT  /  STARBOARD',anchor='rt',fill='#bbcfca',font=font(19))
    rows=[('compass','Compass Transportation','Mistral cargo aerostat'),('gojal','Gojal Safari Tours','Meridian passenger ferry'),('vissiorama','VissioRama','Cirrus broadcast blimp'),('shangmei','Shangmei Products','Kestrel express courier'),('accesstel','AccessTel','Beacon inspection blimp')]
    for i,(key,owner,job) in enumerate(rows):
        y=132+i*280
        d.rectangle((0,y,1600,y+279),fill='#d9e1df' if i%2==0 else '#e9eae3')
        d.text((43,y+94),owner,font=font(27,True),fill='#223c3d')
        d.text((44,y+142),job,font=font(20),fill='#476064')
        for j,side in enumerate(('port','starboard')):
            im=Image.open(W/(key+'-'+side+'.png')).convert('RGBA');im=im.crop(im.getchannel('A').getbbox())
            im.thumbnail((563,250),Image.Resampling.LANCZOS);x=382+j*591+(570-im.width)//2;page.paste(im,(x,y+(277-im.height)//2),im)
    page.save(OUT/'Cloudbreak-Array-Corporate-Fleet-R4.2.jpg',quality=91,subsampling=0,optimize=True)
    image(WORK/'cloud-detail.png').save(OUT/'Cloudbreak-Array-Rooftop-Clouds-R4.2.jpg',quality=88,optimize=True)
if __name__=='__main__':build()
