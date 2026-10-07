const snapshotOrigin='https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
const caches=new WeakMap()
export async function readPublicDataset(name,fetchObject=fetch){
 if(!['games','events','factions','missions'].includes(name))throw new Error('Unsupported public snapshot dataset')
 let cache=caches.get(fetchObject);if(!cache){cache={datasets:new Map()};caches.set(fetchObject,cache)}
 if(!cache.pointer||cache.expires<Date.now()){
   cache.expires=Date.now()+60000
   cache.pointer=readJson(new URL('public-snapshots/current.json',snapshotOrigin),fetchObject).then(pointer=>{
     if(!/^\d{8}T\d{6}Z$/.test(pointer?.snapshotId)||pointer.basePath!==`public-snapshots/${pointer.snapshotId}/`)throw new Error('Invalid public snapshot pointer');return pointer
   }).catch(error=>{cache.pointer=null;throw error})
 }
 const pointer=await cache.pointer;const key=`${pointer.snapshotId}:${name}`
 if(!cache.datasets.has(key)){
   const pending=readJson(new URL(`${pointer.basePath}${name}.json`,snapshotOrigin),fetchObject).then(envelope=>{
    if(envelope.snapshotId!==pointer.snapshotId||!Array.isArray(envelope.data))throw new Error(`Invalid public ${name} snapshot`);return envelope.data
   }).catch(error=>{cache.datasets.delete(key);throw error})
   cache.datasets.set(key,pending)
   for(const old of cache.datasets.keys())if(!old.startsWith(`${pointer.snapshotId}:`))cache.datasets.delete(old)
 }
 return cache.datasets.get(key)
}
async function readJson(url,fetchObject){const result=await fetchObject(url,{signal:AbortSignal.timeout(7000)});if(!result.ok)throw new Error(`Public snapshot returned HTTP ${result.status}`);return result.json()}
