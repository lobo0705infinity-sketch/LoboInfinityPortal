"""Azure Palace geometry uses tabletop inches, +Y up and +Z facing the courtyard."""
import json, math, sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
def release(n):
    return next(p for p in [ROOT.parent/f'azure{n}',ROOT.parent/f'azure-palace-r{n}'] if p.is_dir())
R4=release(4);R2=release(2);R3=release(3);OUT=ROOT/'Assets'
sys.path.insert(0,str(R4/'Source'))
import furnish as F
A=F.old;B=A.R;M=B.M
def read(p):return json.loads(Path(p).read_bytes())
def write(p,data):Path(p).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
poses={p['slug']:p for p in read(R3/'Source/placement.json')[1:13]}
def transform(x,z,yaw,u,v):
    c,s=math.cos(math.radians(yaw)),math.sin(math.radians(yaw))
    return (x+c*u+s*v,z-s*u+c*v)
def world(slug,x,z):
    p=poses[slug];return transform(p['x'],p['z'],p['rot'],x,z)
def origin(side,w,d,along=0):
    extent=(d if side%180==0 else w)/2
    return transform(0,0,side,along,extent+.125)
def mesh_from_obj(path):
    m=M();v=[];uv=[];pairs={}
    for line in Path(path).read_text().splitlines():
        s=line.split()
        if not s:continue
        if s[0]=='v':
            x,y,z=map(float,s[1:4]);v.append((-x,y,z))
        elif s[0]=='vt':uv.append(tuple(map(float,s[1:3])))
        elif s[0]=='f':
            face=[]
            for a in s[1:][::-1]:
                b=a.split('/');ij=(int(b[0])-1,int(b[1])-1 if len(b)>1 and b[1] else -1)
                if ij not in pairs:
                    pairs[ij]=len(m.v);m.v.append(v[ij[0]]);m.uv.append(uv[ij[1]] if ij[1]>=0 else (0,0))
                face.append(pairs[ij])
            for i in range(1,len(face)-1):m.f.append([face[0],face[i],face[i+1]])
    return m
def write_collision(c,path):
    pieces=A.compound(dict(physical_primitives=c.solids,physical_extras=c.physical_extras,free_faces=[]))
    A.write_compound(path,pieces,np.zeros(3))
