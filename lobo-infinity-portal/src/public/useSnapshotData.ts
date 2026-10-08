import { useEffect, useState } from 'react'
import { getPublicSnapshotDataset, type PublicSnapshotDataset } from '../services/publicSnapshot'

export function useSnapshotData<T>(dataset: PublicSnapshotDataset) {
  const [attempt,setAttempt]=useState(0)
  const [state,setState]=useState<{data?:T;error?:string}>({})
  useEffect(()=>{
    let active=true
    getPublicSnapshotDataset<T>(dataset).then(data=>{if(active){setState({data});window.dispatchEvent(new Event('lobo:snapshot-ready'))}}).catch((error:unknown)=>{
      if(active)setState({error:error instanceof Error?error.message:'The requested data is unavailable.'})
    })
    return ()=>{active=false}
  },[dataset,attempt])
  const retry=()=>{setState({});setAttempt(value=>value+1)}
  return {...state,retry}
}
