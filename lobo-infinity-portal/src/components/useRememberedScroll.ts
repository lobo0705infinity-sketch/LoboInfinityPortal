import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export function useRememberedScroll() {
  const location = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  const key = `lobo:directory-scroll:v1:${location.pathname}${location.search}`
  useEffect(() => {
    const element = ref.current
    let saved: {windowY:number; tableY:number; tableX:number} | undefined
    try { saved = JSON.parse(sessionStorage.getItem(key) || 'null') || undefined } catch { /* Storage is optional. */ }
    const frame = requestAnimationFrame(() => {
      if (saved && [saved.windowY,saved.tableY,saved.tableX].every(Number.isFinite)) {
        window.scrollTo({left:0,top:saved.windowY,behavior:'instant'})
        element?.scrollTo({left:saved.tableX,top:saved.tableY,behavior:'instant'})
      }
    })
    const save = () => { try { sessionStorage.setItem(key,JSON.stringify({windowY:window.scrollY,tableY:element?.scrollTop || 0,tableX:element?.scrollLeft || 0})) } catch { /* Storage is optional. */ } }
    element?.addEventListener('click',save)
    window.addEventListener('scroll',save,{passive:true})
    element?.addEventListener('scroll',save,{passive:true})
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll',save); element?.removeEventListener('scroll',save); element?.removeEventListener('click',save) }
  },[key])
  return ref
}
