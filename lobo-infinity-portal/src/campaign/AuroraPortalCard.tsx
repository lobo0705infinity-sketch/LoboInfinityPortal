import { Link } from 'react-router-dom'
import { useAuroraPublication } from './useAuroraPublication'
import CampaignStatus from './CampaignStatus'
import { AuroraGuideLink } from './AuroraPlayerGuide'

export default function AuroraPortalCard({ reporting = false }: { reporting?: boolean }) {
  const { publication, error } = useAuroraPublication()
  const state = publication?.state
  const Heading = reporting ? 'h2' : 'h3'
  return <article className={reporting ? 'panel operations-panel submit-game-form-card' : 'snapshot-dashboard-program snapshot-dashboard-program--aurora'}>
    <p className="eyebrow">Narrative Campaign</p>
    <Heading>Aurora VII · Race for the Gate</Heading>
    {state ? <CampaignStatus state={state}/> : <p role="status">{error ? 'Campaign status temporarily unavailable. Open the campaign for details.' : 'Checking campaign status…'}</p>}
    <p>{reporting ? !state ? 'Open the campaign to check reporting availability.' : state.turn ? 'Record both players in one campaign result, then share the verification link with your opponent.' : 'Game reporting opens with Lobo’s Turn 1 briefing.' : 'Coordinate with your faction, choose where to fight, and make your result count.'}</p>
    <p><Link className={reporting ? 'submit-match-button' : 'snapshot-dashboard-section-link'} to={`/campaign/aurora-vii${reporting ? '/submit' : ''}`}>{reporting ? state?.turn ? 'Open campaign reporting' : 'Campaign reporting & launch information' : 'Explore Aurora VII'} →</Link></p>
    <p><AuroraGuideLink/></p>
  </article>
}
