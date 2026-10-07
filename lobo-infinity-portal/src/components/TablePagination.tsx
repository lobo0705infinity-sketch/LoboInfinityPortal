import { useId, useState } from 'react'
export function useTablePagination<T>(rows:T[], resetKey:unknown) {
  const key=JSON.stringify(resetKey)
  const [state,setState]=useState({key,page:1,size:25})
  const pageCount=Math.max(1,Math.ceil(rows.length/state.size))
  const page=Math.min(state.key===key?state.page:1,pageCount)
  return { rows:rows.slice((page-1)*state.size,page*state.size),page,pageCount,size:state.size,total:rows.length,
    setPage:(next:number)=>setState({key,page:Math.max(1,Math.min(next,pageCount)),size:state.size}),
    setSize:(size:number)=>setState({key,page:1,size}) }
}
type Props={page:number;pageCount:number;size:number;total:number;setPage:(page:number)=>void;setSize:(size:number)=>void}
export default function TablePagination({page,pageCount,size,total,setPage,setSize}:Props){
  const id=useId();if(!total)return null
  return <nav className="table-pagination" aria-label="Table pagination"><p role="status">{(page-1)*size+1}–{Math.min(page*size,total)} of {total}</p>{total>25&&<><label htmlFor={id}>Rows per page</label><select id={id} value={size} onChange={e=>setSize(Number(e.target.value))}><option value={25}>25</option><option value={50}>50</option></select><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page===pageCount} onClick={()=>setPage(page+1)}>Next</button></>}</nav>
}
