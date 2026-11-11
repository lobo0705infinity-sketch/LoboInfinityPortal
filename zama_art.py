from io import BytesIO
from pathlib import Path
from urllib.request import urlopen
from PIL import Image
out=Path('assets/tts/ancients-rating-audit')
for variant in ('rich','open'):
 url='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/17b383b7de89206e1d541edb846eb10ebc4d172f/assets/tts/ancients-r22/zama-'+variant+'.jpg'
 with urlopen(url,timeout=45) as r:
  im=Image.open(BytesIO(r.read())).convert('RGB')
 im=im.resize((1024,768),Image.Resampling.LANCZOS)
 im.save(out/('zama-briefing-'+variant+'.jpg'),quality=91,optimize=True)
