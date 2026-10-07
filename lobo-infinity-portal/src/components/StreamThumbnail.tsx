import { useState } from 'react'
export default function StreamThumbnail({src,alt}:{src:string;alt:string}) {
  const [failed,setFailed]=useState(false)
  return failed ? <span>Preview unavailable</span> : <img src={src} alt={alt} loading="lazy" decoding="async" width="320" height="180" onError={()=>setFailed(true)}/>
}
