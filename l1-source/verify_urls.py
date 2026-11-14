from pathlib import Path
import concurrent.futures,hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parent
def check(a):
 with urllib.request.urlopen(a['url'],timeout=90) as r:
  assert r.status==200
  data=r.read()
 assert len(data)==a['bytes'] and hashlib.sha256(data).hexdigest()==a['sha256'],a['file']
 return {'file':a['file'],'url':a['url'],'bytes':len(data),'sha256':a['sha256'],'passed':True}
if __name__=='__main__':
 assets=json.loads((ROOT/'hosted-assets.json').read_text())
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(check,assets))
 (ROOT/'public-url-validation.json').write_text(json.dumps({'passed':True,'assets':results},indent=2))
 print('PASS:',len(results),'public HTTPS downloads match packaged SHA-256 hashes.')
