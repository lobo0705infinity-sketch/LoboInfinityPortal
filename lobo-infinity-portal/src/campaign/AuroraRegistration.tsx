import { useCallback, useEffect, useState } from 'react'
import { AURORA_REGISTRATION_FACTIONS, type RegistrationSummary } from '../../shared/aurora-registration.mjs'
import { LOBO_DISCORD_INVITE_URL } from '../config/communityLinks'

type Signup = { name: string; faction: string; roleStatus: string }
export default function AuroraRegistration() {
  const [summary, setSummary] = useState<RegistrationSummary | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [ready, setReady] = useState(false)
  const [account, setAccount] = useState<{ displayName: string } | null>(null)
  const [registration, setRegistration] = useState<Signup | null>(null)
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/aurora-registration', { cache: 'no-store', signal })
      if (!response.ok) throw new Error('Live faction counts are temporarily unavailable. Refresh before registering.')
      setSummary(await response.json() as RegistrationSummary); setError('')
      const statusResponse = await fetch('/api/aurora-signup?action=status', { cache: 'no-store', signal })
      const status = await statusResponse.json()
      setReady(status.ready === true); setAccount(status.account || null); setRegistration(status.registration || null)
      if (status.draft) { setSelected(value => value || status.draft.faction); setName(value => value || status.draft.name) }
      if (!statusResponse.ok) setNotice(status.error || 'Portal registration is temporarily unavailable.')
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Registration is temporarily unavailable.') }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(controller.signal) }, 30000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [reload])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search), result = params.get('signup')
    if (!result) return
    const messages: Record<string, string> = {
      complete: 'Discord account confirmed. Your campaign registration has been processed.',
      retry: 'Discord account confirmed. Your place could not be reserved. Check faction availability and click Register again. Make sure you have joined Lobo’s Discord server.',
      expired: 'Discord confirmation expired. Please click Register again.',
      cancelled: 'Discord confirmation cancelled. No new place was reserved.',
      'verification-failed': 'Discord account confirmation failed. Please try again or contact Lobo.',
    }
    setNotice(messages[result] || '')
    params.delete('signup')
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`)
  }, [])
  const faction = AURORA_REGISTRATION_FACTIONS.find(value => value.id === selected)
  const count = summary?.factions.find(value => value.id === selected)
  const canContinue = Boolean(faction && name.trim() && summary?.available && ready && !error && !count?.locked && !busy && !registration)
  async function register() {
    setBusy(true); setNotice('')
    try {
      const response = await fetch('/api/aurora-signup?action=start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ faction: selected, name: name.trim() }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || 'Registration could not be completed.')
      if (value.authorizeUrl) { window.location.assign(value.authorizeUrl); return }
      setRegistration(value.registration)
      await reload()
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Registration could not be completed.'); await reload() }
    finally { setBusy(false) }
  }
  return <>
    <section className="panel aurora-panel">
      <p className="eyebrow">Join the Aurora VII league</p><h2>Choose your faction</h2>
      <p>Choose your faction, enter your player name, and click Register. Lobo’s Little Helper records your signup and automatically assigns your <strong>Aurora VII — Faction</strong> role and private faction channel access.</p>
      <p>Each faction starts with five places. When every campaign faction reaches five players, every faction opens to ten. The same pattern continues at fifteen, twenty, and beyond.</p>
      <div className="aurora-registration-status" aria-live="polite">
        {error ? <p role="alert">{error}</p> : summary ? <p><strong>{summary.total} players registered · Current limit: {summary.cap} per faction</strong><br/>The next batch opens at {summary.cap + 5} when every faction reaches {summary.cap} players.{!summary.available ? <><br/>{summary.issue}</> : null}</p> : <p>Checking available faction places…</p>}
        <button type="button" onClick={() => void reload()}>Refresh faction counts</button>
      </div>
      <fieldset className="aurora-registration-factions"><legend>Campaign faction</legend>{AURORA_REGISTRATION_FACTIONS.map(value => {
        const current = summary?.factions.find(item => item.id === value.id)
        const disabled = !summary?.available || Boolean(error) || Boolean(current?.locked) || busy || Boolean(registration)
        return <label key={value.id} data-selected={selected === value.id} data-locked={current?.locked || false}>
          <input type="radio" name="campaign-faction" value={value.id} checked={selected === value.id} disabled={disabled} onChange={() => { setSelected(value.id); setNotice('') }}/>
          <span><strong>{value.name}</strong><span>{current ? `${current.count} / ${summary!.cap} players${current.locked ? ' · Full—waiting for other factions' : ' · Places available'}` : 'Checking availability'}</span></span>
        </label>
      })}</fieldset>
      <label className="aurora-registration-name">Lobo Portal player name<input value={name} disabled={busy || Boolean(registration)} maxLength={80} autoComplete="nickname" onChange={event => { setName(event.target.value); setNotice('') }} placeholder="Your player name"/></label>
      <div className="aurora-registration-next">
        {registration ? <div role="status"><h3>You are registered for {AURORA_REGISTRATION_FACTIONS.find(value => value.id === registration.faction)?.name}</h3><p><strong>{registration.name}</strong> · {registration.roleStatus === 'assigned' ? 'Your faction role is assigned and your private faction channel is available in Discord.' : 'Your place is reserved. The bot will retry your faction role assignment automatically.'}</p></div> : <>
          <div className="aurora-registration-actions"><button className="aurora-primary" type="button" disabled={!canContinue} onClick={() => void register()}>{busy ? 'Registering…' : 'Register'}</button></div>
          <p>{account ? `Registering with Discord account: ${account.displayName}.` : 'Discord will ask you to confirm your account and approve joining Lobo’s server. The bot joins you if needed, completes your registration, and returns you here.'}</p>
          <p>The bot checks the latest faction limit when completing your signup.</p>
        </>}
        {notice ? <p role="status">{notice}</p> : null}
      </div>
    </section>
    <section className="panel aurora-panel"><h2>Your campaign registration</h2><p>Your confirmation appears above after the bot completes your signup. One Discord account can register once, and player names must be unique.</p><p>Your faction choice is locked after registration. Only <strong>Lobo, the commissioner</strong>, can approve and make a faction change. Contact Lobo if you need a correction.</p><p>Not in the server yet? <a href={LOBO_DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">Join Lobo’s Discord ↗</a></p></section>
  </>
}
