import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { decodeInfinityArmyCode, getInfinityArmyAppUrl, isMobileOrTabletDevice } from '../services/infinityArmyLinks'

export function attemptInfinityArmyAppLaunch(appUrl = getInfinityArmyAppUrl()) {
  const frame = document.createElement('iframe')
  frame.hidden = true
  frame.setAttribute('aria-hidden', 'true')
  frame.src = appUrl
  document.body.appendChild(frame)
  window.setTimeout(() => frame.remove(), 1500)
}

export default function InfinityArmyLink({ armyCode, children, className, copyOnly = false, href }: {
  armyCode?: string
  children: ReactNode
  className?: string
  copyOnly?: boolean
  href: string
}) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const decodedCode = decodeInfinityArmyCode(armyCode, href)

  useEffect(() => {
    if (!feedback) return undefined
    const timer = window.setTimeout(() => setFeedback(''), 4000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  function activate(event: MouseEvent<HTMLAnchorElement>) {
    if (!isMobileOrTabletDevice()) return
    event.preventDefault()
    setOpen(true)
  }

  async function copy(message: string) {
    try {
      await navigator.clipboard.writeText(decodedCode)
      setFeedback(message)
      setOpen(false)
    } catch {
      setFeedback('Unable to copy the army code. Please try again.')
    }
  }

  if (copyOnly) {
    return <span className={`infinity-army-copy-action${className ? ` ${className}` : ''}`}>
      <button onClick={() => void copy('Army code copied.')} type="button">Copy Army Code</button>
      {feedback ? <span className="infinity-army-copy-action-feedback" role="status">{feedback}</span> : null}
    </span>
  }

  async function openApp() {
    try {
      await navigator.clipboard.writeText(decodedCode)
    } catch {
      setFeedback('Unable to copy the army code. Please use Copy Army Code.')
      return
    }
    try { attemptInfinityArmyAppLaunch() } catch { /* The copied code remains available. */ }
    setFeedback('Army code copied. In Infinity Army, tap Load List to import it.')
    setOpen(false)
  }

  return <>
    <a className={className} data-infinity-army-link href={href} onClick={activate} rel="noreferrer" target="_blank">{children}</a>
    {open ? <div className="infinity-army-action-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <section aria-label="Open army list" aria-modal="true" className="infinity-army-action-sheet" onClick={(event) => event.stopPropagation()} role="dialog">
        <button className="primary" onClick={openApp} type="button">Open in Infinity Army App</button>
        <button onClick={() => void copy('Army code copied.')} type="button">Copy Army Code</button>
        <button onClick={() => setOpen(false)} type="button">Cancel</button>
      </section>
    </div> : null}
    {feedback ? <div className="infinity-army-copy-feedback" role="status">{feedback}</div> : null}
  </>
}
