import { Navigate, useParams } from 'react-router-dom'

type DeepLinkRedirectProps = {
  target: 'armyLists' | 'career' | 'news' | 'season' | 'stream' | 'weeklyReport' | 'achievement'
}

function DeepLinkRedirect({ target }: DeepLinkRedirectProps) {
  const params = useParams()

  if (target === 'career') {
    const playerName = params.playerName ?? ''
    return <Navigate replace to={`/players/${encodeURIComponent(playerName)}`} />
  }

  if (target === 'achievement') {
    return <Navigate replace to="/profile" />
  }

  if (target === 'news') {
    return <Navigate replace to="/news" />
  }

  if (target === 'season' || target === 'weeklyReport') {
    return <Navigate replace to="/standings" />
  }

  if (target === 'stream') {
    return <Navigate replace to="/streams" />
  }

  return <Navigate replace to="/army-lists" />
}

export default DeepLinkRedirect
