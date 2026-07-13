import { useEffect, useMemo, useState } from 'react'
import Skeleton from '../components/Skeleton'
import { filterCanonicalMissionNames } from '../config/missions'
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
        setSelectedStreamId(
          streams.find((stream) => stream.featured)?.id ?? streams[0]?.id ?? null,
        )
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
        .filter((stream) =>
          matchesFilters(stream, {
            divisionFilter,
            missionFilter,
            playerFilter,
            query,
          }),
        )
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
        <p>Watch league matches without result spoilers</p>
      </section>

      {streamsState.status === 'loading' ? (
        <>
          <section className="stream-filters" aria-label="Stream filters loading">
            <label>
              <span>Search</span>
              <input disabled placeholder="Search players, factions, missions" />
            </label>
            <FilterSelect label="Division" onChange={() => undefined} options={[]} value="all" />
            <FilterSelect label="Mission" onChange={() => undefined} options={[]} value="all" />
            <FilterSelect label="Player" onChange={() => undefined} options={[]} value="all" />
          </section>
          <section className="stream-layout" aria-label="Streams loading">
            <Skeleton label="Featured stream loading" rows={8} />
            <Skeleton label="Stream list loading" rows={8} />
          </section>
        </>
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
                placeholder="Search players, factions, missions"
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
                onClick={() => handleStreamSelection(stream, setSelectedStreamId)}
                type="button"
              >
                <StreamThumbnail stream={stream} />
                <StreamSummary stream={stream} />
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
  const [embedFailure, setEmbedFailure] = useState<{
    failed: boolean
    streamId: number
  }>({
    failed: false,
    streamId: 0,
  })
  const embedFailed =
    embedFailure.streamId === stream.id && embedFailure.failed

  return (
    <section className="featured-stream panel" aria-labelledby="featured-stream-title">
      <div className="stream-player">
        {embedUrl && !embedFailed ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onError={() =>
              setEmbedFailure({
                failed: true,
                streamId: stream.id,
              })
            }
            src={embedUrl}
            title={getStreamTitle(stream)}
          />
        ) : (
          <StreamThumbnail stream={stream} />
        )}
      </div>
      <div className="featured-stream-copy">
        <p className="eyebrow">{stream.featured ? 'Featured Stream' : 'Selected Stream'}</p>
        <h2 id="featured-stream-title">
          {getStreamTitle(stream)}
        </h2>
        {stream.description ? <p>{stream.description}</p> : null}
        <dl className="stream-meta">
          {stream.streamer ? (
            <div>
              <dt>Streamer</dt>
              <dd>{stream.streamer}</dd>
            </div>
          ) : null}
          {stream.platform ? (
            <div>
              <dt>Platform</dt>
              <dd>{stream.platform}</dd>
            </div>
          ) : null}
          <div>
            <dt>Player 1</dt>
            <dd>{stream.player1 || 'Not reported'}</dd>
          </div>
          <div>
            <dt>Player 1 Faction</dt>
            <dd>{stream.player1Faction || 'Not reported'}</dd>
          </div>
          <div>
            <dt>Player 2</dt>
            <dd>{stream.player2 || 'Not reported'}</dd>
          </div>
          <div>
            <dt>Player 2 Faction</dt>
            <dd>{stream.player2Faction || 'Not reported'}</dd>
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
        <a href={stream.youtubeUrl} rel="noreferrer" target="_blank">
          Open on YouTube
        </a>
      </div>
    </section>
  )
}

function StreamSummary({ stream }: { stream: StreamedGame }) {
  return (
    <div>
      <span className="eyebrow">{stream.date || 'Stream'}</span>
      <h2>{stream.title || stream.mission || 'League Stream'}</h2>
      <p>{stream.description || stream.division}</p>
      <dl className="stream-card-matchup">
        <div>
          <dt>{stream.player1 || 'Player 1'}</dt>
          <dd>{stream.player1Faction || 'Faction not reported'}</dd>
        </div>
        <div>
          <dt>{stream.player2 || 'Player 2'}</dt>
          <dd>{stream.player2Faction || 'Faction not reported'}</dd>
        </div>
      </dl>
    </div>
  )
}

function StreamThumbnail({ stream }: { stream: StreamedGame }) {
  const videoId = getYouTubeVideoId(stream.youtubeUrl)

  if (stream.thumbnailUrl) {
    return (
      <img
        alt={getStreamTitle(stream)}
        className="stream-thumbnail"
        src={stream.thumbnailUrl}
      />
    )
  }

  if (!videoId) {
    return (
      <div className="stream-thumbnail stream-thumbnail-fallback">
        <span>{stream.title || stream.mission || 'Stream'}</span>
      </div>
    )
  }

  return (
    <img
      alt={getStreamTitle(stream)}
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
    missions: filterCanonicalMissionNames(Array.from(missions)),
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
    stream.title,
    stream.streamer,
    stream.platform,
    stream.description,
    stream.player1,
    stream.player1Faction,
    stream.player2,
    stream.player2Faction,
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

function getStreamTitle(stream: StreamedGame) {
  if (stream.title) {
    return stream.title
  }

  const players = [stream.player1, stream.player2].filter(Boolean)
  return players.length === 2 ? `${players[0]} vs ${players[1]}` : 'Streamed Game'
}

function getYouTubeVideoId(url: string) {
  const trimmedUrl = url.trim()

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmedUrl)) {
    return trimmedUrl
  }

  try {
    const parsed = new URL(trimmedUrl)
    const pathParts = parsed.pathname
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)

    if (parsed.hostname.includes('youtu.be')) {
      return normalizeYouTubeVideoId(pathParts[0] ?? '')
    }

    if (parsed.searchParams.has('v')) {
      return normalizeYouTubeVideoId(parsed.searchParams.get('v') ?? '')
    }

    const videoPathKeys = ['embed', 'live', 'shorts']
    const videoPathIndex = pathParts.findIndex((part) =>
      videoPathKeys.includes(part),
    )

    if (videoPathIndex !== -1) {
      return normalizeYouTubeVideoId(pathParts[videoPathIndex + 1] ?? '')
    }

    return ''
  } catch {
    return ''
  }
}

function getYouTubeEmbedUrl(url: string) {
  const videoId = getYouTubeVideoId(url)
  return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
}

function normalizeYouTubeVideoId(value: string) {
  const match = value.match(/[a-zA-Z0-9_-]{11}/)
  return match?.[0] ?? ''
}

function handleStreamSelection(
  stream: StreamedGame,
  setSelectedStreamId: (id: number) => void,
) {
  if (getYouTubeEmbedUrl(stream.youtubeUrl)) {
    setSelectedStreamId(stream.id)
    return
  }

  if (stream.youtubeUrl.trim()) {
    window.open(stream.youtubeUrl, '_blank', 'noopener,noreferrer')
  }
}

function getTime(dateText: string) {
  const date = new Date(dateText)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export default StreamedGames
