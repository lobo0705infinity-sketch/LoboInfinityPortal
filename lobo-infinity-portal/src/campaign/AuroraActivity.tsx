import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { locationActivity, type Activity } from '../../shared/aurora-activity.mjs'
const COLORS:Record<string,string>={'PanOceania':'#63bafa','Yu Jing':'#f5b64d','Ariadna':'#9cca79','ALEPH':'#c5a1ff','Haqqislam':'#d5c785','O-12':'#81dce0','JSA':'#f4818e','Nomads':'#f96e64','NA2':'#b9c3d0','Tohaa':'#70d6ac','Combined Army':'#df7cb6'}
export function useCampaignActivity(turn:number) {
  const [data,setData]=useState<Activity|null>(null),[error,setError]=useState(''),[updated,setUpdated]=useState(''),[refresh,setRefresh]=useState(0)
  useEffect(()=>{
    const controller=new AbortController()
    let loading=false,lastCheck=0
    async function load(manual=false){
      if(document.visibilityState==='hidden'||loading||(!manual&&Date.now()-lastCheck<300000))return
      loading=true;lastCheck=Date.now()
      try{const r=await fetch(manual?'/api/aurora-activity?refresh=1':'/api/aurora-activity',{cache:manual?'no-store':'default',credentials:'omit',signal:controller.signal});if(!r.ok)throw Error('Confirmed game activity is temporarily unavailable. Try refreshing.');const v=await r.json();if(!Array.isArray(v.games)||!Array.isArray(v.totals)||v.turn!==turn)throw Error('Waiting for confirmed results for this Turn.');if(!controller.signal.aborted){setData(v);setError('');setUpdated(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}}
      catch(e){if(!controller.signal.aborted)setError((e as Error).message)}
      finally{loading=false}
    }
    void load(refresh>0);const timer=setInterval(()=>void load(),300000);const visible=()=>void load();document.addEventListener('visibilitychange',visible)
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible)}
  },[turn,refresh])
  return {data:data?.turn===turn?data:null,error,updated,reload:()=>setRefresh(n=>n+1)}
}
export function sampleActivity(turn:number):Activity {
  const totals=[{location:'korin-range',faction:'ALEPH',tp:30,op:48},{location:'korin-range',faction:'Yu Jing',tp:12,op:36},{location:'nova-prospect',faction:'PanOceania',tp:15,op:24},{location:'nova-prospect',faction:'Ariadna',tp:6,op:18},{location:'narrative',faction:'ALEPH',tp:5,op:8},{location:'narrative',faction:'Yu Jing',tp:2,op:6}]
  const game=(id:number,location:string,a:string,b:string)=>({id:`sample-${id}`,turn,date:'2026-10-13',location,mission:location==='narrative'?'Narrative Mission':'Territory Battle',playerA:{name:'Sample player A',faction:a},playerB:{name:'Sample player B',faction:b},opA:8,opB:6,tpA:5,tpB:2})
  return {turn,totals,games:[...Array.from({length:6},(_,i)=>game(i,'korin-range','aleph','yu-jing')),...Array.from({length:3},(_,i)=>game(i+6,'nova-prospect','pano','ariadna')),game(9,'narrative','aleph','yu-jing')]}
}
export function LocationActivity({activity,location,knownCount,sample=false}:{activity:Activity;location:string;knownCount:boolean;sample?:boolean}) {
  const {rows,games,leaders,count}=locationActivity(activity,location),max=Math.max(1,...rows.map(r=>r.tp)),narrative=location==='narrative'
  return <div className="aurora-battlefront">
    <div className="aurora-battlefront-heading"><span className="eyebrow">{narrative?'Narrative activity':'Fighting this Turn'}</span><strong>{knownCount?`${count} confirmed ${count===1?'battle':'battles'}`:'Published totals'}</strong></div>
    {!narrative&&rows.length?<p className="aurora-front-leader"><span>Provisional Conquest leader</span><strong>{leaders.length?leaders.join(' / '):'No leader yet'}</strong>{leaders.length>1?<small>Tied on TP and OP</small>:null}</p>:null}
    {rows.length?<div className="aurora-faction-bars">{rows.map(row=><div key={row.faction}><div className="aurora-bar-label"><strong>{row.faction}</strong><span>{row.tp} TP · {row.op} OP</span></div><div className="aurora-bar-track"><span style={{width:`${row.tp/max*100}%`,background:COLORS[row.faction]||'#91e4ff'}}/></div>{!narrative&&['NA2','Tohaa','Combined Army'].includes(row.faction)?<small>Faction system · no direct territorial Influence</small>:null}</div>)}</div>:<p className="aurora-muted">Results will appear after games are confirmed.</p>}
    <p className="aurora-muted">{narrative?'Narrative results stay separate from territorial Influence.':'Provisional Conquest Influence · OP breaks ties.'}</p>
    {games.length?<details><summary>Recent {sample?'sample':'confirmed'} battles</summary><ul className="aurora-front-battles">{games.slice(0,5).map(g=><li key={g.id}><strong>{g.playerA.name} vs {g.playerB.name}</strong><span>{g.opA}–{g.opB} OP · {g.tpA}–{g.tpB} TP</span><small>{g.mission} · {g.date}</small>{!sample ? <Link to={`/campaign/aurora-vii/standings#battle-${g.id}`}>View confirmed battle →</Link> : null}</li>)}</ul></details>:null}
  </div>
}
