import { useState } from 'react'
import { useLocation } from 'react-router-dom'

type PaginationState={key:string;storageKey:string;page:number;size:number}
function readSaved(storageKey:string,key:string):PaginationState {
  try {
    const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null')
    if(saved && Number.isInteger(saved.page) && saved.page>0 && [25,50].includes(saved.size))return {...saved,storageKey}
  } catch { /* Pagination still works without storage. */ }
  return {key,storageKey,page:1,size:25}
}
export function useTablePagination<T>(rows:T[], resetKey:unknown) {
  const location=useLocation()
  const key=JSON.stringify(resetKey)
  const storageKey=`lobo:pagination:v1:${location.pathname}${location.search}`
  const [state,setState]=useState(()=>readSaved(storageKey,key))
  const current=state.storageKey===storageKey?state:readSaved(storageKey,key)
  const pageCount=Math.max(1,Math.ceil(rows.length/current.size))
  const page=Math.min(current.key===key?current.page:1,pageCount)
  const save=(next:PaginationState)=>{setState(next);try{sessionStorage.setItem(storageKey,JSON.stringify(next))}catch{/* Storage is optional. */}}
  return { rows:rows.slice((page-1)*current.size,page*current.size),page,pageCount,size:current.size,total:rows.length,
    setPage:(next:number)=>save({key,storageKey,page:Math.max(1,Math.min(next,pageCount)),size:current.size}),
    setSize:(size:number)=>save({key,storageKey,page:1,size:[25,50].includes(size)?size:25}) }
}
