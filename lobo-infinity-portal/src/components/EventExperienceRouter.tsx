import type { ReactNode } from 'react'
import type { EventHomeData } from '../services/api'
import TeamTournament from '../pages/TeamTournament'

type EventExperienceRouterProps = {
  children: ReactNode
  data: EventHomeData
}

function EventExperienceRouter({ children, data }: EventExperienceRouterProps) {
  switch (data.event.type) {
    case 'Team Tournament':
      return <TeamTournament eventId={data.event.id} />
    case 'League':
      return children
    default:
      return children
  }
}

export default EventExperienceRouter
