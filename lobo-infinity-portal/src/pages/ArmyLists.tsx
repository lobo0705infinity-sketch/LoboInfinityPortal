import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import { filterCanonicalMissionNames } from '../config/missions'
import {
  apiClient,
  type ArmyList,
  type ArmyListCommunitySummary,
} from '../services/api'
import { formatPlayerName } from '../services/formatting'

type SortMode = 'newest' | 'popular' | 'rated' | 'downloaded'

type ArmyListsState =
  | {
      status: 'loading'
    }
  | {
      community: ArmyListCommunitySummary
      lists: ArmyList[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function ArmyLists() {
  const [state, setState] = useState<ArmyListsState>({
    status: 'loading',
  })
  const [query, setQuery] = useState('')
  const [faction, setFaction] = useState('all')
  const [sectorial, setSectorial] = useState('all')
  const [mission, setMission] = useState('all')
  const [player, setPlayer] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [votedIds, setVotedIds] = useState<Set<number>>(() => getStoredVotes())

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getArmyLists({
        signal: controller.signal,
      })
      .then((data) => {
        setState({
          community: data.community,
          lists: data.lists,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Army lists could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  const filters = useMemo(() => {
    if (state.status !== 'success') {
      return {
        factions: [],
        missions: [],
        players: [],
        sectorials: [],
      }
    }

    return {
      factions: getUniqueOptions(state.lists.map((list) => list.faction)),
      missions: filterCanonicalMissionNames(state.lists.map((list) => list.mission)),
      players: getUniqueOptions(state.lists.map((list) => list.player)),
      sectorials: getUniqueOptions(state.lists.map((list) => list.sectorial)),
    }
  }, [state])

  const visibleLists = useMemo(() => {
    if (state.status !== 'success') {
      return []
    }

    const normalizedQuery = query.trim().toLowerCase()

    return state.lists
      .filter((list) => matchesFilter(list.faction, faction))
      .filter((list) => matchesFilter(list.sectorial, sectorial))
      .filter((list) => matchesFilter(list.mission, mission))
      .filter((list) => matchesFilter(list.player, player))
      .filter((list) =>
        `${list.player} ${list.playerDisplayName} ${list.faction} ${list.sectorial} ${list.mission} ${list.armyName} ${list.description}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .sort((left, right) => sortArmyLists(left, right, sortMode))
  }, [faction, mission, player, query, sectorial, sortMode, state])

  async function handleVote(list: ArmyList, vote: 'up' | 'down') {
    if (votedIds.has(list.id)) {
      return
    }

    await apiClient.voteArmyList(list.id, vote)
    const nextVotes = new Set(votedIds)
    nextVotes.add(list.id)
    setVotedIds(nextVotes)
    storeVotes(nextVotes)

    if (state.status === 'success') {
      setState({
        ...state,
        lists: state.lists.map((candidate) =>
          candidate.id === list.id
            ? {
                ...candidate,
                downvotes:
                  vote === 'down'
                    ? candidate.downvotes + 1
                    : candidate.downvotes,
                score: candidate.score + (vote === 'up' ? 1 : -1),
                upvotes:
                  vote === 'up' ? candidate.upvotes + 1 : candidate.upvotes,
              }
            : candidate,
        ),
      })
    }
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="community-summary-grid" aria-label="Army list summary loading">
          <Skeleton label="Army list leaders loading" rows={5} />
          <Skeleton label="Army list designer loading" rows={5} />
          <Skeleton label="Army list trends loading" rows={5} />
        </section>
        <section className="army-list-filters" aria-label="Army list filters loading">
          <input disabled placeholder="Search army lists" />
          <select disabled><option>Faction</option></select>
          <select disabled><option>Sectorial</option></select>
          <select disabled><option>Mission</option></select>
        </section>
        <section className="army-list-grid" aria-label="Army lists loading">
          <Skeleton label="Army lists loading" rows={8} />
          <Skeleton label="Army lists loading" rows={8} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Army lists error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />

      <section className="community-summary-grid" aria-label="Community leaders">
        <CommunityCard title="Top Contributors">
          {state.community.topContributors.map((contributor) => (
            <Link key={contributor.name} to={`/players/${encodeURIComponent(contributor.name)}`}>
              <strong>{formatPlayerName(contributor.name, contributor.displayName)}</strong>
              <span>{contributor.count} lists</span>
            </Link>
          ))}
        </CommunityCard>
        <CommunityCard title="Highest Rated Designer">
          {state.community.highestRatedDesigner ? (
            <Link
              to={`/players/${encodeURIComponent(
                state.community.highestRatedDesigner.name,
              )}`}
            >
              <strong>
                {formatPlayerName(
                  state.community.highestRatedDesigner.name,
                  state.community.highestRatedDesigner.displayName,
                )}
              </strong>
              <span>{state.community.highestRatedDesigner.score} score</span>
            </Link>
          ) : null}
        </CommunityCard>
        <CommunityCard title="Most Popular Faction">
          {state.community.mostPopularFaction ? (
            <Link
              to={`/factions/${encodeURIComponent(
                state.community.mostPopularFaction,
              )}`}
            >
              <strong>{state.community.mostPopularFaction}</strong>
              <span>Most submitted</span>
            </Link>
          ) : null}
        </CommunityCard>
      </section>

      <section className="army-list-controls" aria-label="Army list filters">
        <label>
          <span>Search</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Player, faction, mission, army name"
            type="search"
            value={query}
          />
        </label>
        <FilterSelect label="Faction" onChange={setFaction} options={filters.factions} value={faction} />
        <FilterSelect label="Sectorial" onChange={setSectorial} options={filters.sectorials} value={sectorial} />
        <FilterSelect label="Mission" onChange={setMission} options={filters.missions} value={mission} />
        <FilterSelect label="Player" onChange={setPlayer} options={filters.players} value={player} />
        <label>
          <span>Sort</span>
          <select
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            value={sortMode}
          >
            <option value="newest">Newest</option>
            <option value="popular">Most Popular</option>
            <option value="rated">Highest Rated</option>
            <option value="downloaded">Most Downloaded</option>
          </select>
        </label>
      </section>

      {visibleLists.length === 0 ? (
        <section className="dashboard-state" aria-label="No army lists">
          <p>No approved army lists match the current filters.</p>
        </section>
      ) : (
        <section className="army-list-grid" aria-label="Army List Vault">
          {visibleLists.map((list) => (
            <ArmyListCard
              disabled={votedIds.has(list.id)}
              key={list.id}
              list={list}
              onVote={handleVote}
            />
          ))}
        </section>
      )}
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="army-lists-title">
      <p className="eyebrow">Community</p>
      <h1 id="army-lists-title">Army List Vault</h1>
      <p>Browse approved league lists, designer notes, and Infinity Army links</p>
      <Link className="submit-match-button" to="/army-lists/submit">
        Submit Army List
      </Link>
    </section>
  )
}

function CommunityCard({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="panel community-card">
      <p className="eyebrow">Community</p>
      <h2>{title}</h2>
      <div className="community-card-stack">
        {children || <span>No approved lists yet.</span>}
      </div>
    </section>
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

function ArmyListCard({
  disabled,
  list,
  onVote,
}: {
  disabled: boolean
  list: ArmyList
  onVote: (list: ArmyList, vote: 'up' | 'down') => void
}) {
  return (
    <article className="army-list-card">
      <div className="army-list-card-heading">
        <div>
          <p className="eyebrow">{list.faction}</p>
          <h2>{list.armyName}</h2>
        </div>
        <strong>{list.score}</strong>
      </div>
      <dl className="army-list-meta">
        <div>
          <dt>Player</dt>
          <dd>
            <Link to={`/players/${encodeURIComponent(list.player)}`}>
              {formatPlayerName(list.player, list.playerDisplayName)}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Mission</dt>
          <dd>{list.mission || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Sectorial</dt>
          <dd>{list.sectorial || 'Vanilla / Not recorded'}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{list.submissionDate || 'Not recorded'}</dd>
        </div>
      </dl>
      {list.description ? <p>{list.description}</p> : null}
      <div className="army-list-actions">
        {list.armyLink ? (
          <a href={list.armyLink} rel="noreferrer" target="_blank">
            View in Infinity Army
          </a>
        ) : list.armyCode ? (
          <code>{list.armyCode}</code>
        ) : null}
        <button disabled={disabled} onClick={() => void onVote(list, 'up')} type="button">
          Upvote {list.upvotes}
        </button>
        <button disabled={disabled} onClick={() => void onVote(list, 'down')} type="button">
          Downvote {list.downvotes}
        </button>
      </div>
    </article>
  )
}

function matchesFilter(value: string, filter: string) {
  return filter === 'all' || value === filter
}

function getUniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

function sortArmyLists(left: ArmyList, right: ArmyList, sortMode: SortMode) {
  if (sortMode === 'popular' || sortMode === 'downloaded') {
    return right.upvotes - left.upvotes || right.score - left.score
  }

  if (sortMode === 'rated') {
    return right.score - left.score || right.upvotes - left.upvotes
  }

  return right.id - left.id
}

function getStoredVotes() {
  try {
    const stored = window.localStorage.getItem('lobo-army-list-votes')
    const ids = stored ? (JSON.parse(stored) as number[]) : []
    return new Set(ids)
  } catch {
    return new Set<number>()
  }
}

function storeVotes(votes: Set<number>) {
  window.localStorage.setItem(
    'lobo-army-list-votes',
    JSON.stringify(Array.from(votes)),
  )
}

export default ArmyLists
