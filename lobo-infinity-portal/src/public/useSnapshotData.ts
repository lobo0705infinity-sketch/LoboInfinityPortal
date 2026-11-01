import { useEffect, useState } from 'react'
import { getPinnedPublicSnapshot, getPublicSnapshotDataset, type PublicSnapshotDataset } from '../services/publicSnapshot'
import { getTop40LivePublicData, mergeTop40LiveDataset } from '../services/top40LivePublicData'

export function useSnapshotData<T>(dataset: PublicSnapshotDataset) {
  const [attempt,setAttempt]=useState(0)
  const [state,setState]=useState<{data?:T;error?:string}>({})
  useEffect(()=>{
    let active=true
    let baseline:T | undefined
    const refreshEvent = async () => {
      if (!baseline || !['events','games','army-lists'].includes(dataset) || !/\/event\/(?:lobos-top-40|event-lobo-s-american-top-40)(?:\/|$)/.test(window.location.pathname)) return
      try {
        const [live, snapshot] = await Promise.all([getTop40LivePublicData(), getPinnedPublicSnapshot()])
        if (Date.parse(live.generatedAt) < Date.parse(snapshot.sourceCutoff)) {
          if(active) window.dispatchEvent(new CustomEvent('lobo:event-updated',{detail:{generatedAt:snapshot.sourceCutoff}}))
          return
        }
        if(active) {
          setState({data:mergeTop40LiveDataset(dataset,baseline,live)})
          window.dispatchEvent(new CustomEvent('lobo:event-updated',{detail:{generatedAt:live.generatedAt}}))
        }
      } catch { if(active) window.dispatchEvent(new Event('lobo:event-update-unavailable')) }
    }
    getPublicSnapshotDataset<T>(dataset).then(data=>{
      baseline=data
      if(active){setState({data});window.dispatchEvent(new Event('lobo:snapshot-ready'));void refreshEvent()}
    }).catch((error:unknown)=>{
      if(active)setState({error:error instanceof Error?error.message:'The requested data is unavailable.'})
    })
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refreshEvent()},30_000)
    window.addEventListener('lobo:refresh-event',refreshEvent)
    window.addEventListener('focus',refreshEvent)
    return ()=>{active=false;window.clearInterval(timer);window.removeEventListener('lobo:refresh-event',refreshEvent);window.removeEventListener('focus',refreshEvent)}
  },[dataset,attempt])
  const retry=()=>{setState({});setAttempt(value=>value+1)}
  return {...state,retry}
}
