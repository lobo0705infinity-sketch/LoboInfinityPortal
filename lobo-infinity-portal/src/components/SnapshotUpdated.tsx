import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getPinnedPublicSnapshot } from '../services/publicSnapshot'

export default function SnapshotUpdated() {
  const [updated,setUpdated] = useState('')
  const location = useLocation()
  useEffect(() => {
    let active=true
    const load=()=>{getPinnedPublicSnapshot().then(pointer=>{if(active)setUpdated(pointer.sourceCutoff)}).catch(()=>{})}
    load()
    window.addEventListener('lobo:snapshot-ready',load)
    return () => {active=false;window.removeEventListener('lobo:snapshot-ready',load)}
  },[location.pathname])
  const timestamp=Date.parse(updated)
  return Number.isFinite(timestamp) ? <p className="snapshot-updated" title="The source data cutoff for the results currently displayed.">Data last updated <time dateTime={updated}>{new Date(timestamp).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time></p> : null
}
