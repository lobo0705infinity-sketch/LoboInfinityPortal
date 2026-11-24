from pathlib import Path
p=Path(__file__).resolve().parents[2]/'lobo-infinity-portal/public/assets/maps/dig-access-20261124'
for f in p.glob('*.obj'):
 arrays={k:[] for k in ['v','vt','vn']};face=[]
 for l in f.read_text().splitlines():
  k=l.split(' ',1)[0]
  if k in arrays:arrays[k].append(tuple(float(v)for v in l.split()[1:]))
  elif k=='f':face.append(l.split()[1:])
 seen={k:{}for k in arrays};vals={k:[]for k in arrays};out=[]
 for ff in face:
  refs=[]
  for ref in ff:
   ids=ref.split('/');new=[]
   for i,k in enumerate(['v','vt','vn'][:len(ids)]):
    if not ids[i]:new.append('');continue
    val=arrays[k][int(ids[i])-1]
    if val not in seen[k]:seen[k][val]=len(vals[k])+1;vals[k].append(val)
    new.append(str(seen[k][val]))
   refs.append('/'.join(new))
  out.append('f '+' '.join(refs))
 lines=['# Dig access repair; original material UVs and unaffected surfaces retained']
 for k in arrays:
  lines += [k+' '+' '.join(format(v,'.9g')for v in a)for a in vals[k]]
 f.write_text('\n'.join(lines+out)+'\n')
print(sum(f.stat().st_size for f in p.glob('*.obj')),'mesh bytes')
