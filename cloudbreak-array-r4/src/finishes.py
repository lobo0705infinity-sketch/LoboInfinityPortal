"""Glass with real front/back separation and lower-noise architectural material tiles."""
from PIL import Image,ImageFilter
import numpy as np
from rooftops import *
def build():
    native.AS=ASSETS;m=native.Mesh()
    for tri in native.read_obj(R3/'assets/greenhouse-glazing.obj')[0]:
        m.faces.append(tuple((tuple(np.asarray(p)+np.asarray(n)*.009),u,n) for p,u,n in tri))
    m.save('greenhouse-glazing')
    im=Image.open(AS2/'civic-r2.jpg').convert('RGB')
    for name in ('zinc','ceramic','teal','concrete','membrane','louver','roofB','floorB','deck','timber','facade','charcoal','seam','terrazzo','hatch','vents'):
        x,y,w,h=native.RECT[native.TILES.index(name)]
        box=(x-4,y-4,x+w+4,y+h+4)
        tile=im.crop(box);blur=tile.filter(ImageFilter.GaussianBlur(1.16))
        im.paste(Image.blend(tile,blur,.72),box[:2])
    im.save(ASSETS/'civic-stable.jpg',quality=94,subsampling=0,optimize=True)
if __name__=='__main__':build()
