import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import { apiClient, type CommissionerNewsItem } from '../services/api'

type NewsState =
  | {
      status: 'idle'
    }
  | {
      news: CommissionerNewsItem[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function CommissionerNews() {
  const [state, setState] = useState<NewsState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getNews({
        signal: controller.signal,
      })
      .then((news) => {
        setState({
          news,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            error:
              error instanceof Error ? error.message : 'News could not be loaded.',
            status: 'error',
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (state.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="News loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="News error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />
      <section className="news-grid" aria-label="Commissioner news">
        {state.news.map((item) => (
          <Link className="news-article" key={item.id} to={item.link || '/news'}>
            <span>{item.date || 'Live League News'}</span>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <RelatedLine item={item} />
          </Link>
        ))}
      </section>
    </main>
  )
}

function RelatedLine({ item }: { item: CommissionerNewsItem }) {
  const related = [
    item.relatedPlayer ? `Player: ${item.relatedPlayer}` : '',
    item.relatedFaction ? `Faction: ${item.relatedFaction}` : '',
    item.relatedMission ? `Mission: ${item.relatedMission}` : '',
  ].filter(Boolean)

  if (related.length === 0) {
    return null
  }

  return <small>{related.join(' / ')}</small>
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="news-title">
      <p className="eyebrow">Commissioner News</p>
      <h1 id="news-title">League Dispatches</h1>
      <p>Manual announcements or automatically generated live league stories</p>
    </section>
  )
}

export default CommissionerNews
