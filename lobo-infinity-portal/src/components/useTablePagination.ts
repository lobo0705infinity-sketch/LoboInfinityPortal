import { useState } from 'react'
export function useTablePagination<T>(rows:T[], resetKey:unknown) {
  const key=JSON.stringify(resetKey)
  const [state,setState]=useState({key,page:1,size:25})
  const pageCount=Math.max(1,Math.ceil(rows.length/state.size))
  const page=Math.min(state.key===key?state.page:1,pageCount)
  return { rows:rows.slice((page-1)*state.size,page*state.size),page,pageCount,size:state.size,total:rows.length,
    setPage:(next:number)=>setState({key,page:Math.max(1,Math.min(next,pageCount)),size:state.size}),
    setSize:(size:number)=>setState({key,page:1,size}) }
}
