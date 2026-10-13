import { useCallback, useEffect, useState } from 'react'
import { AURORA_DISCORD_GUILD_ID, AURORA_REGISTRATION_FACTIONS, type RegistrationSummary } from '../../shared/aurora-registration.mjs'
import { LOBO_DISCORD_INVITE_URL } from '../config/communityLinks'

export default function AuroraRegistration() {
  const [summary, setSummary] = useState<RegistrationSummary | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [name, setName] = useState('')
  const [copied, setCopied] = useState(false)
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/aurora-registration', { cache: 'no-store', signal })
      if (!response.ok) throw new Error('Live faction counts are temporarily unavailable. Refresh before registering.')
      const value = await response.json() as RegistrationSummary
      setSummary(value); setError('')
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Registration is temporarily unavailable.') }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(controller.signal) }, 30000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [reload])
  const faction = AURORA_REGISTRATION_FACTIONS.find(value => value.id === selected)
  const count = summary?.factions.find(value => value.id === selected)
  const command = faction ? `/aurora register faction:${faction.name} player:${name.trim() || 'Your portal player name'}` : ''
  const canContinue = Boolean(faction && name.trim() && summary?.available && !error && !count?.locked)
  async function copyCommand() {
    try { await navigator.clipboard.writeText(command); setCopied(true) }
    catch { setCopied(false) }
  }
  return <>
    <section className="panel aurora-panel">
      <p className="eyebrow">Join the Aurora VII league</p><h2>Choose your faction</h2>
      <p>Register with your Discord account through Lobo’s Little Helper. Your signup reserves a faction place and automatically assigns your <strong>Aurora VII — Faction</strong> role.</p>
      <p>Each faction starts with five places. When all ten factions reach five players, every faction opens to ten. The same pattern continues at fifteen, twenty, and beyond.</p>
      <div className="aurora-registration-status" aria-live="polite">
        {error ? <p role="alert">{error}</p> : summary ? <p><strong>{summary.total} players registered · Current limit: {summary.cap} per faction</strong><br/>The next batch opens at {summary.cap + 5} when every faction reaches {summary.cap} players.{!summary.available ? <><br/>{summary.issue}</> : null}</p> : <p>Checking available faction places…</p>}
        <button type="button" onClick={() => void reload()}>Refresh faction counts</button>
      </div>
      <fieldset className="aurora-registration-factions"><legend>Campaign faction</legend>{AURORA_REGISTRATION_FACTIONS.map(value => {
        const current = summary?.factions.find(item => item.id === value.id)
        const disabled = !summary?.available || Boolean(error) || Boolean(current?.locked)
        return <label key={value.id} data-selected={selected === value.id} data-locked={current?.locked || false}>
          <input type="radio" name="campaign-faction" value={value.id} checked={selected === value.id} disabled={disabled} onChange={() => { setSelected(value.id); setCopied(false) }}/>
          <span><strong>{value.name}</strong><span>{current ? `${current.count} / ${summary!.cap} players${current.locked ? ' · Locked for this batch' : ' · Places available'}` : 'Checking availability'}</span></span>
        </label>
      })}</fieldset>
      <label className="aurora-registration-name">Lobo Portal player name<input value={name} maxLength={80} autoComplete="nickname" onChange={event => { setName(event.target.value); setCopied(false) }} placeholder="Your player name"/></label>
      {faction ? <div className="aurora-registration-next"><h3>Finish registration in Discord</h3>
        <ol><li>Open Lobo’s Discord server.</li><li>Type <strong>/aurora register</strong>, choose <strong>{faction.name}</strong> from the faction menu, and enter your player name.</li><li>Submit the command. Lobo’s Little Helper confirms your place privately and assigns <strong>Aurora VII — {faction.name}</strong>.</li></ol>
        <p>Choosing a faction here does not reserve a place. The bot checks the latest limit when you submit in Discord.</p>
        <code className="aurora-registration-command">{command}</code>
        <div className="aurora-registration-actions"><button type="button" disabled={!canContinue} onClick={() => void copyCommand()}>{copied ? 'Command copied' : 'Copy registration command'}</button>{canContinue ? <a className="aurora-primary" href={`https://discord.com/channels/${AURORA_DISCORD_GUILD_ID}`} target="_blank" rel="noopener noreferrer">Open Discord to register ↗</a> : null}</div>
        <p aria-live="polite">{copied ? 'Paste the command in Discord, then select the faction and player options if Discord asks.' : 'You can also type the command directly using the instructions above.'}</p>
      </div> : null}
    </section>
    <section className="panel aurora-panel"><h2>Your campaign registration</h2><p>Use <strong>/aurora status</strong> in Discord to check your faction and role assignment. One Discord account can register once, and player names must be unique.</p><p>To change factions, use <strong>/aurora withdraw</strong> first, then register for an available faction. Withdrawing removes your campaign role and releases your place; your new choice depends on the current availability.</p><p>Not in the server yet? <a href={LOBO_DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">Join Lobo’s Discord ↗</a></p></section>
  </>
}
