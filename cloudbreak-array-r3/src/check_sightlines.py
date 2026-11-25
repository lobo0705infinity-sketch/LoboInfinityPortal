"""Check the finished save against the same legible placements on the R2 rooftops."""
from sightlines import *
from release import DESIGN,BANKS
from airframes import BYKEY
def check():
 data=np.load(WORK3/'baseline.npz');sel=data['visible'];A,B,labels=(data[k][sel]for k in ('A','B','labels'));N=len(A)
 table=json.loads((OUT3/'Play-Table.json').read_text());new=[q for q in table['ObjectStates']if TAG in q.get('Tags',[])]
 ships=[o for o in new if slug(o).startswith('aerostat-')];high=[o for o in new if slug(o).startswith('alto-')]
 sky=np.zeros(N,dtype=bool);hull=sky.copy();visual=sky.copy();objects=[];named={}
 for o in ships:
  name=o['Nickname'].split(' |')[0];hits=rays_through([o],A,B);hull|=hits;named[name]=int(hits.sum())
  cfg=next(k for k in DESIGN['ships']if 'aerostat-'+k['key']==slug(o));s=BYKEY[cfg['key']];t=o['Transform']
  # Inscribed ellipsoid filters out crossing a propeller tip when picking an example.
  core=body_mask(A,B,t['posX'],t['posY'],t['posZ'],s['rx']*t['scaleX']*.84,s['ry']*t['scaleY']*.88,s['rz']*t['scaleZ']*.88,t['rotY'])
  objects.append((name,'blimp',t['posX'],t['posY'],t['posZ'],[o],None,hits&core))
 for o,c in zip(high,DESIGN['high']):
  hits=cylinder(A,B,c);art=rays_through([o],A,B);sky|=hits;visual|=art;named[c['name']]=int(hits.sum())
  assert all(~art|hits),c['name']
  objects.append((c['name'],'cloud',c['x'],(c['lo']+c['hi'])/2,c['z'],[o],c,hits&art))
 blocked=hull|sky
 distances=np.linalg.norm(A[:,[0,2]]-B[:,[0,2]],axis=1);profiles={}
 for title,mask in [('all',np.ones(N,dtype=bool)),('over_24_in',distances>=24),('both_highest_roofs',(A[:,1]>14)&(B[:,1]>14)),('one_or_more_highest_roofs',(A[:,1]>14)|(B[:,1]>14)),('both_at_or_below_second',(A[:,1]<13)&(B[:,1]<13))]:
  profiles[title]={'r2_clear':int(mask.sum()),'r3_newly_blocked':int((mask&blocked).sum()),'r3_clear':int((mask&~blocked).sum())}
 # Show four knockout examples where all sampled points across both standing silhouettes are masked by a single new piece.
 items=[];used=set();pairs=set()
 options=[('blimp',True),('cloud',True),('blimp',False),('cloud',False)]
 for kind,tall in options:
  possible=[]
  for name,typ,hx,hy,hz,obs,c,hit in objects:
   if typ!=kind or name in used:continue
   for i in np.flatnonzero(hit):
    pair=labels[i];a,b=A[i],B[i];is_high=a[1]>14 and b[1]>14
    if tall and not is_high:continue
    if pair in pairs:continue
    # Prefer center crossings, long enough to matter but still legible in a full-map view.
    d=b-a;center=np.array([hx,hy,hz]);f=np.dot(center-a,d)/np.dot(d,d)
    off=np.linalg.norm(center-(a+d*f));score=-off+.42*min(f,1-f)-.013*abs(distances[i]-28)
    possible.append((score,i,name,obs,c,center))
  chosen=False
  for _,i,name,obs,c,center in sorted(possible,key=lambda k:-k[0]):
   a,b=A[i],B[i];dr=b-a;perp=np.array([-dr[2],0,dr[0]]);perp/=np.linalg.norm(perp)
   offsets=[perp*v+np.array([0,h-EYE,0])for v in (-.44,0,.44)for h in (.12,.84,1.54)]
   a0=np.array([a+v for v in offsets for w in offsets]);b0=np.array([b+w for v in offsets for w in offsets]);sample=cylinder(a0,b0,c)if c else rays_through(obs,a0,b0)
   if not np.all(sample):continue
   pair=labels[i];items.append(dict(start=T[pair[0]].name,end=T[pair[1]].name,towers=str(pair),a=a.tolist(),b=b.tolist(),obstacle=name,kind=kind,center=center.tolist(),distance=round(float(distances[i]),1),bundle_hits=int(sample.sum())));used.add(name);pairs.add(pair);chosen=True;break
  if not chosen:print('No full cross-section example',kind,tall,flush=True)
 report={'legal_roof_positions':sum(len(v)for v in json.loads((WORK3/'positions.json').read_text()).values()),'candidate_lines':len(sel),'minimum_distance_in':10,'model_height_in':EYE,'new_ships':len(ships),'upper_clouds':len(high),'total_clouds':len(BANKS),'cloud_marks':int(sky.sum()),'new_hull_hits':int(hull.sum()),'union':int(blocked.sum()),'physically_visible_union':int((hull|visual).sum()),'pairs_affected':len(set(labels[blocked])),'profiles':profiles,'individual':named,'examples':items}
 (WORK3/'los-audit.json').write_text(json.dumps(report,indent=2))
 print(json.dumps({k:v for k,v in report.items() if k not in ('individual','examples')},indent=1));print([(v['start'],v['end'],v['obstacle'])for v in items],flush=True)
 assert min(named.values())>0 and report['profiles']['both_highest_roofs']['r3_newly_blocked']>0
 assert sum(v['kind']=='blimp'for v in items)>=1 and sum(v['kind']=='cloud'for v in items)>=1
if __name__=='__main__':check()
