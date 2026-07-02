import { useEffect, useMemo, useState } from 'react'
import Loading from '../components/Loading'
import { apiClient, type StreamedGame } from '../services/api'

type StreamsState =
  | {
      status: 'loading'
    }
  | {
      streams: StreamedGame[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
  }

const emptyStreams: StreamedGame[] = []

function StreamedGames() {
  const [streamsState, setStreamsState] = useState<StreamsState>({
    status: 'loading',
  })
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [missionFilter, setMissionFilter] = useState('all')
  const [playerFilter, setPlayerFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getStreams({
        signal: controller.signal,
      })
      .then((streams) => {
        setStreamsState({
          streams,
          status: 'success',
        })
        setSelectedStreamId(streams.find((stream) => stream.featured)?.id ?? streams[0]?.id ?? null)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStreamsState({
            error:
              error instanceof Error
                ? error.message
                : 'Streamed games could not be loaded.',
            status: 'error',
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

  const streams =
    streamsState.status === 'success' ? streamsState.streams : emptyStreams
  const options = useMemo(() => buildFilterOptions(streams), [streams])
  const filteredStreams = useMemo(
    () =>
      streams
        .filter((stream) => matchesFilters(stream, {
          divisionFilter,
          missionFilter,
          playerFilter,
          query,
        }))
        .sort((a, b) =>
          sortOrder === 'newest'
            ? getTime(b.date) - getTime(a.date)
            : getTime(a.date) - getTime(b.date),
        ),
    [divisionFilter, missionFilter, playerFilter, query, sortOrder, streams],
  )
  const selectedStream =
    filteredStreams.find((stream) => stream.id === selectedStreamId) ??
    filteredStreams.find((stream) => stream.featured) ??
    filteredStreams[0] ??
    null
  const remainingStreams = filteredStreams.filter(
    (stream) => stream.id !== selectedStream?.id,
  )

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="streams-title">
        <p className="eyebrow">Video Archive</p>
        <h1 id="streams-title">Streamed Games</h1>
        <p>Featured broadcasts and recorded league matches</p>
      </section>

      {streamsState.status === 'loading' ? (
        <section className="dashboard-state" aria-label="Streams loading">
          <Loading />
        </section>
      ) : streamsState.status === 'error' ? (
        <section className="dashboard-state" aria-label="Streams error">
          <p role="alert">{streamsState.error}</p>
        </section>
      ) : streams.length === 0 ? (
        <section className="panel streams-empty" aria-label="No streamed games">
          <p className="eyebrow">Streams</p>
          <h2>No streamed games have been posted yet.</h2>
          <p>Streams will appear here after the organizer adds rows to the Streams sheet.</p>
        </section>
      ) : (
        <>
          <section className="stream-filters" aria-label="Stream filters">
            <label>
              <span>Search</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search players, missions, notes"
                type="search"
                value={query}
              />
            </label>
            <FilterSelect
              label="Division"
              onChange={setDivisionFilter}
              options={options.divisions}
              value={divisionFilter}
            />
            <FilterSelect
              label="Mission"
              onChange={setMissionFilter}
              options={options.missions}
              value={missionFilter}
            />
            <FilterSelect
              label="Player"
              onChange={setPlayerFilter}
              options={options.players}
              value={playerFilter}
            />
            <label>
              <span>Sort</span>
              <select
                onChange={(event) =>
                  setSortOrder(event.target.value === 'oldest' ? 'oldest' : 'newest')
                }
                value={sortOrder}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </label>
          </section>

          {selectedStream ? (
            <FeaturedStream stream={selectedStream} />
          ) : (
            <section className="panel streams-empty" aria-label="No matching streams">
              <h2>No streams match those filters.</h2>
            </section>
          )}

          <section className="stream-grid" aria-label="Stream archive">
            {remainingStreams.map((stream) => (
              <button
                className="stream-card"
                key={stream.id}
                onClick={() => setSelectedStreamId(stream.id)}
                type="button"
              >
                <StreamThumbnail stream={stream} />
                <div>
                  <span className="eyebrow">{stream.date || 'Stream'}</span>
                  <h2>
                    {stream.player1} vs {stream.player2}
                  </h2>
                  <p>{stream.mission}</p>
                  <small>{stream.division}</small>
                </div>
              </button>
            ))}
          </section>
        </>
      )}
    </main>
  )
}

function FeaturedStream({ stream }: { stream: StreamedGame }) {
  const embedUrl = getYouTubeEmbedUrl(stream.youtubeUrl)

  return (
    <section className="featured-stream panel" aria-labelledby="featured-stream-title">
      <div className="stream-player">
        {embedUrl ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            src={embedUrl}
            title={`${stream.player1} vs ${stream.player2}`}
          />
        ) : (
          <StreamThumbnail stream={stream} />
        )}
      </div>
      <div className="featured-stream-copy">
        <p className="eyebrow">{stream.featured ? 'Featured Stream' : 'Selected Stream'}</p>
        <h2 id="featured-stream-title">
          {stream.player1} vs {stream.player2}
        </h2>
        <dl className="stream-meta">
          <div>
            <dt>Winner</dt>
            <dd>{stream.winner || 'Not reported'}</dd>
          </div>
          <div>
            <dt>Mission</dt>
            <dd>{stream.mission || 'Not reported'}</dd>
          </div>
          <div>
            <dt>Division</dt>
            <dd>{stream.division || 'Not reported'}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{stream.date || 'Not reported'}</dd>
          </div>
        </dl>
        {stream.notes ? <p>{stream.notes}</p> : null}
        <a href={stream.youtubeUrl} rel="noreferrer" target="_blank">
          Open on YouTube
        </a>
      </div>
    </section>
  )
}

function StreamThumbnail({ stream }: { stream: StreamedGame }) {
  const videoId = getYouTubeVideoId(stream.youtubeUrl)

  if (!videoId) {
    return (
      <div className="stream-thumbnail stream-thumbnail-fallback">
        <span>{stream.mission || 'Stream'}</span>
      </div>
    )
  }

  return (
    <img
      alt={`${stream.player1} vs ${stream.player2}`}
      className="stream-thumbnail"
      src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
    />
  )
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function buildFilterOptions(streams: StreamedGame[]) {
  const divisions = new Set<string>()
  const missions = new Set<string>()
  const players = new Set<string>()

  streams.forEach((stream) => {
    addOption(divisions, stream.division)
    addOption(missions, stream.mission)
    addOption(players, stream.player1)
    addOption(players, stream.player2)
  })

  return {
    divisions: Array.from(divisions).sort(),
    missions: Array.from(missions).sort(),
    players: Array.from(players).sort(),
  }
}

function addOption(set: Set<string>, value: string) {
  const trimmed = value.trim()

  if (trimmed) {
    set.add(trimmed)
  }
}

function matchesFilters(
  stream: StreamedGame,
  filters: {
    divisionFilter: string
    missionFilter: string
    playerFilter: string
    query: string
  },
) {
  const query = filters.query.trim().toLowerCase()
  const haystack = [
    stream.date,
    stream.division,
    stream.mission,
    stream.player1,
    stream.player2,
    stream.winner,
    stream.notes,
  ]
    .join(' ')
    .toLowerCase()

  return (
    (filters.divisionFilter === 'all' || stream.division === filters.divisionFilter) &&
    (filters.missionFilter === 'all' || stream.mission === filters.missionFilter) &&
    (filters.playerFilter === 'all' ||
      stream.player1 === filters.playerFilter ||
      stream.player2 === filters.playerFilter) &&
    (query === '' || haystack.includes(query))
  )
}

function getYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '')
    }

    if (parsed.searchParams.has('v')) {
      return parsed.searchParams.get('v')
    }

    const embedMatch = parsed.pathname.match(/\/embed\/([^/]+)/)
    return embedMatch?.[1] ?? ''
  } catch {
    return ''
  }
}

function getYouTubeEmbedUrl(url: string) {
  const videoId = getYouTubeVideoId(url)
  return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
}

function getTime(dateText: string) {
  const date = new Date(dateText)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export default StreamedGames
