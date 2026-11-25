"""Prepare 2:1 wraparound textures and render four true perspective views from each."""
from pathlib import Path
import argparse
import numpy as np
from scipy.ndimage import gaussian_filter,gaussian_filter1d,map_coordinates
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
def smooth(t):
 t=np.clip(t,0,1);return t*t*(3-2*t)
def stitch(arrays):
 day=arrays[0];h,w=day.shape[:2];overlap=84
 cost=gaussian_filter(np.mean(abs(day[:,w-overlap:]-day[:,:overlap]),axis=-1),(4,2));cost+=8*np.square(np.linspace(-1,1,overlap))
 total=cost.copy();back=np.zeros((h,overlap),dtype='int8')
 for y in range(1,h):
  p=total[y-1];choices=np.vstack((np.r_[1e6,p[:-1]],p,np.r_[p[1:],1e6]));k=np.argmin(choices,axis=0);back[y]=k-1;total[y]+=np.min(choices,axis=0)
 seam=[int(np.argmin(total[-1]))]
 for y in range(h-1,0,-1):seam.append(seam[-1]+int(back[y,seam[-1]]))
 edge=gaussian_filter1d(np.array(seam[::-1],dtype=float),3)[:,None]
 mask=smooth((np.arange(overlap)[None,:]-edge+3.5)/7.)[:,:,None]
 result=[]
 for a in arrays:
  join=a[:,w-overlap:]*(1-mask)+a[:,:overlap]*mask
  b=np.concatenate((join,a[:,overlap:w-overlap]),axis=1)
  yy=np.linspace(0,1,h);fade=smooth(np.minimum(yy,1-yy)/.093)[:,None,None]
  b=fade*b+(1-fade)*np.mean(b,axis=1,keepdims=True)
  result.append(Image.fromarray(np.clip(b,0,255).astype('uint8')).resize((2048,1024),Image.Resampling.LANCZOS))
 return result
def perspective(src,heading,w=468,h=263,pitch=-4,hfov=84):
 a=np.array(src);yi,xi=np.mgrid[0:h,0:w];f=w*.5/np.tan(np.deg2rad(hfov/2));x=(xi+.5-w*.5)/f;y=(h*.5-yi-.5)/f;c,s=np.cos(np.deg2rad(pitch)),np.sin(np.deg2rad(pitch));d=c-y*s;u=y*c+s
 lon=np.arctan2(x,d)+np.deg2rad(heading);lat=np.arctan2(u,np.sqrt(x*x+d*d))
 xa=(lon/(2*np.pi)+.5)*a.shape[1]-.5;ya=(.5-lat/np.pi)*a.shape[0]-.5
 return Image.fromarray(np.stack([map_coordinates(a[:,:,i],[ya,np.mod(xa,a.shape[1])],order=1,mode='grid-wrap') for i in range(3)],axis=-1))
def sheet(images):
 w,h=1618,646;sheet=Image.new('RGB',(w,h),(14,25,33));d=ImageDraw.Draw(sheet)
 face='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold=face.replace('Sans.ttf','Sans-Bold.ttf')
 font=lambda sz,th=False:ImageFont.truetype(bold if th else face,sz)
 d.text((24,15),'Cloudbreak Array',font=font(28,True),fill=(242,237,222));d.text((326,23),'Harmony City  /  360° table backgrounds',font=font(17),fill=(175,193,202))
 for row,im in enumerate(images):
  y=92+row*282;d.text((24,y-29),('Day' if row==0 else 'Night'),font=font(19,True),fill=(234,219,184))
  for i,yaw in enumerate([0,90,180,270]):
   x=24+i*395;img=perspective(im,yaw,385,219);sheet.paste(img,(x,y));d.text((x,y+225),['Front','Right','Back · panorama seam','Left'][i],font=font(14),fill=(181,196,202))
 return sheet
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('day');p.add_argument('night');o=p.parse_args();a=[np.asarray(Image.open(x).convert('RGB'),dtype='float32')for x in [o.day,o.night]];assert a[0].shape==a[1].shape and a[0].shape[1]==2*a[0].shape[0]
 im=stitch(a)
 for s,b in zip(('day','night'),im):b.save(ROOT/'assets'/('sky-'+s+'.jpg'),quality=94,subsampling=0)
 sheet(im).save(ROOT/'out'/'Cloudbreak-Array-R2-Backgrounds.jpg',quality=94,subsampling=0)
