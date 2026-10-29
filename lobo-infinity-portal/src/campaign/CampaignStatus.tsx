import { AURORA_TURNS } from '../../shared/aurora-public.mjs'
import type { AuroraPublicState } from './auroraTypes'

export default function CampaignStatus({ state }: { state: AuroraPublicState }) {
  return <p className="aurora-campaign-status">{state.turn ? <>
    Turn {state.turn} of 6 · {AURORA_TURNS[state.turn - 1].title}
    {state.deadline ? <> · Confirmation deadline: <time dateTime={state.deadline}>{new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.deadline))} ET</time></> : ' · Confirmation deadline awaiting announcement'}
  </> : 'Registration open · Turn 1 awaiting announcement'}</p>
}
