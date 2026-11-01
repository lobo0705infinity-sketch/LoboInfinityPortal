import { useEffect, useState } from 'react'
import { getTop40LivePublicData } from '../services/top40LivePublicData'
import { preparationDate } from './top40PreparationModel'
export default function Top40PublicationStatus() {
  const [updated,setUpdated]=useState('')
  const [unavailable,setUnavailable]=useState(false)
  useEffect(()=>{
    const success=(event:Event)=>{setUpdated((event as CustomEvent<{generatedAt:string}>).detail.generatedAt);setUnavailable(false)}
    const failure=()=>setUnavailable(true)
    window.addEventListener('lobo:event-updated',success)
    window.addEventListener('lobo:event-update-unavailable',failure)
    return ()=>{window.removeEventListener('lobo:event-updated',success);window.removeEventListener('lobo:event-update-unavailable',failure)}
  },[])
  async function refresh() {
    try {const live=await getTop40LivePublicData(true);setUpdated(live.generatedAt);setUnavailable(false);window.dispatchEvent(new Event('lobo:refresh-event'))} catch {setUnavailable(true)}
  }
  return <div className="top40-publication-status" role="status"><span>{unavailable?'Event updates are temporarily unavailable; showing the last published data.':updated?`Event published ${preparationDate(updated)} · checks for changes every 30 seconds.`:'Checking event publication…'}</span><button type="button" onClick={()=>void refresh()}>Refresh event</button></div>
}
