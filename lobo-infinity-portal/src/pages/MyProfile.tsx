import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import BarChart, { type BarChartPoint } from '../components/BarChart'
import OperatorBadge from '../components/OperatorBadge'
import Skeleton from '../components/Skeleton'
import { getCanonicalArmyOptions, normalizeArmyForDisplay } from '../config/armies'
import { resolvePlayerFactionPortrait, type FactionPortrait } from '../config/factionPortraits'
import { getCanonicalMissionName } from '../config/missions'
import {
  apiClient,
  type ArmyList,
  type LeagueTimelineItem,
  type MyProfileData,
  type ProfileAchievement,
  type ProfileStatisticsSnapshot,
  type RecentGame,
} from '../services/api'
import {
  formatPercentage,
  formatPlayerName,
  formatRank,
  formatRecord as formatRecordValue,
} from '../services/formatting'
import { isDrawGame } from '../services/gameResults'
import { getConfiguredEventDisplayName } from '../services/leagueEventDisplay'
import {
  resolvePlayerLeagueModel,
  type PlayerLeagueModel,
} from '../services/playerLeagueModel'
import type { PlayerClassification } from '../services/playerClassification'
import { standingsRepository } from '../services/data'
import type { DivisionStandings } from '../types/dashboard'
import './MyProfile.css'

type ProfileState =
  | {
      status: 'loading'
    }
  | {
      allStandings: DivisionStandings[]
      data: MyProfileData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

type ProfileSaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { message: string; status: 'success' }
  | { message: string; status: 'error' }

type GameContext = {
  faction: string
  game: RecentGame
  opponent: string
  opponentDisplayName: string
  op: number
  result: 'Draw' | 'Loss' | 'Unknown' | 'Win'
  tp: number
  vp: number
  wentFirst: boolean
}

type PerformanceRow = {
  averageTP: number
  averageOP: number
  averageVP: number
  games: number
  label: string
  losses: number
  draws: number
  wins: number
  winRate: number
}

type ProfileDerivedData = {
  achievements: AchievementCard[]
  armySummary: ArmySummary
  career: CareerSummary
  contexts: GameContext[]
  factionPerformance: PerformanceRow[]
  intelligence: PlayerIntelligenceSummary
  insights: Insight[]
  missionPerformance: PerformanceRow[]
  opponentRows: PerformanceRow[]
  records: PersonalRecord[]
  timeline: ProfileTimelineItem[]
  trend: BarChartPoint[]
  turnProfile: {
    averageFirstOP: number
    averageSecondOP: number
    firstGames: number
    firstWinRate: number
    secondGames: number
    secondWinRate: number
  }
}

type Insight = {
  body: string
  label: string
  tone: 'alert' | 'good' | 'neutral'
}

type IntelligenceMetric = {
  label: string
  meta: string
  tone: 'alert' | 'good' | 'neutral'
  value: string
}

type PlayerIntelligenceSummary = {
  coaching: Insight[]
  comparison: IntelligenceMetric[]
  factions: IntelligenceMetric[]
  missions: IntelligenceMetric[]
  opponents: IntelligenceMetric[]
  performance: IntelligenceMetric[]
  promotion: IntelligenceMetric[]
  trends: IntelligenceMetric[]
  turns: IntelligenceMetric[]
}

type PersonalRecord = {
  label: string
  to?: string
  value: string
}

type ArmySummary = {
  averageRating: number
  favoriteFaction: string
  highestRated: ArmyList | null
  mostUsedFaction: string
  newest: ArmyList | null
  submitted: number
}

type CareerSummary = {
  achievementPoints: number
  awards: number
  championships: number
  games: number
  losses: number
  op: number
  promotions: number
  relegations: number
  seasonsPlayed: number
  timeline: ProfileTimelineItem[]
  tp: number
  vp: number
  winPercentage: number
  wins: number
}

type AchievementCard = {
  category: string
  dateEarned: string
  description: string
  icon: string
  points: number
  progress: number
  rarity: 'Common' | 'Epic' | 'Legendary' | 'Rare'
  state: 'Locked' | 'Unlocked'
  title: string
}

type ProfileTimelineItem = Pick<
  LeagueTimelineItem,
  'body' | 'id' | 'link' | 'timestamp' | 'title' | 'type'
>

const CURRENT_SEASON_TARGET_GAMES = 9

function MyProfile() {
  const auth = useAuth()
  const [state, setState] = useState<ProfileState>({ status: 'loading' })

  useEffect(() => {
    if (!auth.authenticated) {
      return
    }

    const controller = new AbortController()

    async function loadProfile() {
      try {
        const [data, allStandings] = await Promise.all([
          apiClient.getMyProfile({
            signal: controller.signal,
          }),
          standingsRepository.getAllStandings({
            signal: controller.signal,
          }),
        ])
        setState({ allStandings, data, status: 'success' })
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            error:
              error instanceof Error
                ? error.message
                : 'Profile could not be loaded.',
            status: 'error',
          })
        }
      }
    }

    void loadProfile()

    return () => {
      controller.abort()
    }
  }, [auth.authenticated])

  if (!auth.authenticated) {
    return (
      <main className="portal-shell">
        <ProfileHeader />
        <section className="dashboard-state" aria-label="Profile unavailable">
          <p role="alert">
            Sign in with a Portal account to view your player profile.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <ProfileHeader />
        <section className="profile-card-grid" aria-label="Profile loading">
          <Skeleton label="Profile summary loading" rows={6} />
          <Skeleton label="Profile performance loading" rows={6} />
          <Skeleton label="Profile achievements loading" rows={6} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <ProfileHeader />
        <section className="dashboard-state" aria-label="Profile unavailable">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <ProfileDashboard
      data={state.data}
      allStandings={state.allStandings}
      onProfileSaved={(data) =>
        setState((current) =>
          current.status === 'success'
            ? { ...current, data }
            : { allStandings: [], data, status: 'success' },
        )
      }
    />
  )
}

function ProfileDashboard({
  allStandings,
  data,
  onProfileSaved,
}: {
  allStandings: DivisionStandings[]
  data: MyProfileData
  onProfileSaved: (data: MyProfileData) => void
}) {
  const leagueModel = useMemo(
    () => resolveMyProfileLeagueModel(data, allStandings),
    [allStandings, data],
  )
  const leaguePlayer = getMyProfileCompetitivePlayerName(data, leagueModel)
  const leagueStats = data.leagueStatistics
  const seasonStats =
    buildStatsFromLeagueModel(leagueModel) ??
    data.currentSeasonStatistics ??
    buildStatsFromProfile(leagueStats)
  const performance = data.leaguePerformance
  const derived = useMemo(
    () => buildProfileDerivedData(data, leaguePlayer, seasonStats),
    [data, leaguePlayer, seasonStats],
  )
  const careerHighlight = getMyProfileCareerHighlight(data.recentGames)

  return (
    <main className="portal-shell">
      <ProfileHeader />

      {!leagueModel ? (
        <section className="dashboard-state" aria-label="League profile missing">
          <p role="alert">
            This Google account is authenticated, but no current league standing
            could be resolved for this profile yet.
          </p>
        </section>
      ) : null}

      <section className="my-profile-v3-dashboard" aria-label="Competitive identity dashboard">
        <ProfileHero
          data={data}
          leagueModel={leagueModel}
          performance={performance}
          seasonStats={seasonStats}
        />
        <SeasonDashboardPanel
          leagueModel={leagueModel}
          performance={performance}
          seasonStats={seasonStats}
        />
      </section>

      <section className="my-profile-v3-support" aria-label="Season pulse">
        <RecentResultsPanel contexts={derived.contexts} />
        <CareerHighlightCard highlight={careerHighlight} />
      </section>

      <ProfileEditor
        data={data}
        favoriteArmy={derived.armySummary.favoriteFaction}
        leagueModel={leagueModel}
        onProfileSaved={onProfileSaved}
      />

      <section className="profile-section-grid" aria-label="Player intelligence">
        <IntelligencePanel intelligence={derived.intelligence} />
        <TurnAnalyticsPanel derived={derived} leagueStats={leagueStats} />
      </section>

      <section className="profile-wide-grid" aria-label="Career history">
        <CareerPanel
          career={derived.career}
          leaguePlayer={leaguePlayer}
          playerDisplayName={data.user.playerDisplayName}
        />
      </section>

      <section className="profile-chart-grid" aria-label="Advanced analytics">
        <ChartPanel title="Faction Performance" eyebrow="Win Rate by Faction">
          <BarChart
            points={derived.factionPerformance.map((row) => ({
              label: row.label,
              meta: `${row.wins}-${row.losses} / ${row.games} games`,
              value: row.winRate,
            }))}
            title="Faction performance"
          />
        </ChartPanel>
        <ChartPanel title="Mission Results" eyebrow="Win Rate by Mission">
          <BarChart
            points={derived.missionPerformance.map((row) => ({
              label: row.label,
              meta: `${row.wins}-${row.losses} / avg OP ${row.averageOP}`,
              value: row.winRate,
            }))}
            title="Mission performance"
          />
        </ChartPanel>
        <ChartPanel title="Performance Trend" eyebrow="Recent Form">
          <BarChart points={derived.trend} title="Performance trend" />
        </ChartPanel>
      </section>

      <section className="profile-section-grid" aria-label="Records and achievements">
        <RecordsPanel records={derived.records} />
        <AchievementsPanel achievements={derived.achievements} />
      </section>

      <section className="profile-section-grid" aria-label="Army lists">
        <ArmyListsPanel lists={data.submittedLists} summary={derived.armySummary} />
      </section>
    </main>
  )
}

function ProfileHeader() {
  return (
    <section className="page-header" aria-labelledby="my-profile-title">
      <p className="eyebrow">My Profile 3.0</p>
      <h1 id="my-profile-title">Combat Record</h1>
      <p>League identity, form, strengths, weaknesses, and career signals.</p>
    </section>
  )
}

function ProfileEditor({
  data,
  favoriteArmy,
  leagueModel,
  onProfileSaved,
}: {
  data: MyProfileData
  favoriteArmy: string
  leagueModel: PlayerLeagueModel | null
  onProfileSaved: (data: MyProfileData) => void
}) {
  const auth = useAuth()
  const [displayName, setDisplayName] = useState(data.user.displayName)
  const [discordName, setDiscordName] = useState(data.user.discordName)
  const [preferredArmy, setPreferredArmy] = useState(data.user.favoriteFaction)
  const [profileVisibility, setProfileVisibility] = useState(
    data.user.profileVisibility || 'Public',
  )
  const [saveState, setSaveState] = useState<ProfileSaveState>({ status: 'idle' })
  const armyOptions = useMemo(() => getCanonicalArmyOptions(), [])
  const currentLeague = getCurrentLeagueLabel(leagueModel)

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateProfileEditor(displayName, discordName)

    if (validationError) {
      setSaveState({ message: validationError, status: 'error' })
      return
    }

    setSaveState({ status: 'saving' })

    try {
      const updated = await apiClient.updateProfile({
        displayName: displayName.trim(),
        discordName: discordName.trim(),
        favoriteFaction: preferredArmy,
        profileVisibility,
      })

      onProfileSaved(updated)
      await auth.refreshSession()
      setSaveState({
        message: 'Profile saved. Your portal display name is now active.',
        status: 'success',
      })
    } catch (error) {
      setSaveState({
        message:
          error instanceof Error
            ? error.message
            : 'Profile could not be saved.',
        status: 'error',
      })
    }
  }

  return (
    <section
      className="panel profile-feature-panel profile-editor-panel"
      aria-labelledby="profile-editor-title"
      data-visual-surface="my-profile-edit-profile"
    >
      <div>
        <p className="eyebrow">Player Identity</p>
        <h2 id="profile-editor-title">Edit Profile</h2>
        <p>
          Google signs you in. Your portal profile controls how players see you.
        </p>
      </div>

      <form className="army-list-form profile-editor-form" onSubmit={(event) => void saveProfile(event)}>
        <label>
          <span>Display Name</span>
          <input
            maxLength={24}
            minLength={3}
            onChange={(event) => setDisplayName(event.target.value)}
            pattern="[A-Za-z0-9 _-]{3,24}"
            required
            value={displayName}
          />
        </label>

        <label>
          <span>Discord Name</span>
          <input
            maxLength={40}
            onChange={(event) => setDiscordName(event.target.value)}
            placeholder="Optional"
            value={discordName}
          />
        </label>

        <label>
          <span>Preferred Army</span>
          <select
            onChange={(event) => setPreferredArmy(event.target.value)}
            value={preferredArmy}
          >
            <option value="">No preference</option>
            {armyOptions.map((army) => (
              <option key={army} value={army}>
                {army}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Profile Visibility</span>
          <select
            onChange={(event) => setProfileVisibility(event.target.value)}
            value={profileVisibility}
          >
            <option value="Public">Public</option>
            <option value="Private">Private</option>
          </select>
        </label>

        <div className="profile-editor-readonly">
          <span>Favorite Army</span>
          <strong>{favoriteArmy || 'Not established'}</strong>
        </div>

        <div className="profile-editor-readonly">
          <span>League</span>
          <strong>{currentLeague}</strong>
        </div>

        <div className="profile-editor-readonly">
          <span>Current Tournament</span>
          <strong>{getCurrentTournamentLabel(data.user.eventRegistrations)}</strong>
        </div>

        <div className="army-list-form-actions profile-editor-actions">
          <button disabled={saveState.status === 'saving'} type="submit">
            {saveState.status === 'saving' ? 'Saving...' : 'Save Profile'}
          </button>
          {saveState.status === 'error' ? (
            <p role="alert">{saveState.message}</p>
          ) : null}
          {saveState.status === 'success' ? (
            <p>{saveState.message}</p>
          ) : null}
        </div>
      </form>
    </section>
  )
}

function ProfileHero({
  data,
  leagueModel,
  performance,
  seasonStats,
}: {
  data: MyProfileData
  leagueModel: PlayerLeagueModel | null
  performance: MyProfileData['leaguePerformance']
  seasonStats: ProfileStatisticsSnapshot | null
}) {
  const health = getLeagueHealth(data, leagueModel)
  const classifications = getMyProfileClassifications(data, seasonStats, leagueModel)
  const division = getMyProfileCompetitiveHome(leagueModel)
  const rank = getMyProfileCurrentRank(leagueModel)
  const operatorPlayer = buildOperatorBadgePlayer(data, seasonStats, leagueModel)
  const currentLeague = getCurrentLeagueLabel(leagueModel)
  const joinedDate = getProfileJoinedDate(data)
  const promotionStatus = getCompetitivePromotionStatus(leagueModel, seasonStats)
  const preferredFaction = leagueModel?.preferredArmy || data.user.favoriteFaction || ''
  const portrait = resolvePlayerFactionPortrait({
    currentEventArmy: leagueModel?.preferredArmy,
    preferredArmy: data.user.favoriteFaction,
  })

  return (
    <section
      className={`profile-hero-focus member-profile-hero player-combat-hero my-profile-operator-hero${portrait ? ' has-faction-portrait' : ''}`}
      aria-label="Authenticated player profile"
    >
      <div className="my-profile-operator-badge">
        <OperatorBadge
          achievements={data.achievements.map((achievement) => ({
            title: achievement.name || achievement.title,
            unlocked: achievement.unlocked,
          }))}
          classifications={classifications}
          competitiveHome={division}
          player={operatorPlayer}
          preferredFaction={preferredFaction}
          rank={rank}
          showBadges={false}
        />
      </div>

      <div className="profile-hero-main">
        <p className="eyebrow">Player Identity</p>
        <h1>{data.user.displayName}</h1>
        <div className="profile-badges">
          <span>{division}</span>
          <span>{formatRank(rank)}</span>
          <span>{formatRecord(seasonStats)}</span>
          <span>{promotionStatus}</span>
          <span>{performance.currentStreak}</span>
          <span>{health}</span>
        </div>
        <div className="my-profile-hero-meta" aria-label="Profile identity details">
          <span>{currentLeague}</span>
          <span>{joinedDate}</span>
        </div>
        <div className="my-profile-classifications" aria-label="Player classifications">
          {classifications.map((classification) => (
            <span className="player-status-badge" key={classification}>
              {classification}
            </span>
          ))}
        </div>
        <section className="my-profile-service-record" aria-labelledby="my-service-record-title">
          <span id="my-service-record-title">Service Record</span>
          <dl>
            <div>
              <dt>Operator Since</dt>
              <dd>{joinedDate}</dd>
            </div>
            <div>
              <dt>League</dt>
              <dd>{currentLeague}</dd>
            </div>
            <div>
              <dt>Preferred Army</dt>
              <dd>{preferredFaction || 'Not Selected'}</dd>
            </div>
            <div>
              <dt>Promotion Status</dt>
              <dd>{promotionStatus}</dd>
            </div>
          </dl>
        </section>
      </div>

      {portrait ? <FactionPortraitPanel portrait={portrait} /> : null}
    </section>
  )
}

function FactionPortraitPanel({ portrait }: { portrait: FactionPortrait }) {
  const [visible, setVisible] = useState(true)

  if (!visible) {
    return null
  }

  return (
    <aside className="my-profile-faction-portrait" aria-label={`${portrait.faction} portrait`}>
      <img
        alt={portrait.alt}
        decoding="async"
        loading="eager"
        onError={() => setVisible(false)}
        src={portrait.src}
      />
    </aside>
  )
}

function SeasonDashboardPanel({
  leagueModel,
  performance,
  seasonStats,
}: {
  leagueModel: PlayerLeagueModel | null
  performance: MyProfileData['leaguePerformance']
  seasonStats: ProfileStatisticsSnapshot | null
}) {
  const gamesPlayed = seasonStats?.games ?? 0
  const gamesRemaining = getGamesRemaining(seasonStats)
  const promotionStatus = getCompetitivePromotionStatus(leagueModel, seasonStats)
  const dashboardRows = [
    { label: 'Record', value: formatRecord(seasonStats) },
    { label: 'Rank', value: formatLeaguePosition(leagueModel, seasonStats) },
    { label: 'TP', value: seasonStats?.tp ?? 0 },
    { label: 'OP', value: seasonStats?.op ?? 0 },
    { label: 'VP', value: seasonStats?.vp ?? 0 },
    {
      label: 'Win Rate',
      value: formatPercentage(seasonStats?.winPercentage ?? 0),
    },
    { label: 'Remaining', value: gamesRemaining },
    { label: 'Streak', value: performance.currentStreak },
  ]

  return (
    <section className="panel my-profile-season-panel" aria-labelledby="my-current-season-title">
      <div className="panel-heading">
        <p className="eyebrow">{getCurrentLeagueLabel(leagueModel)}</p>
        <h2 id="my-current-season-title">Current Season</h2>
      </div>
      <div className="my-profile-season-record">
        <strong>{formatRecord(seasonStats)}</strong>
        <span>{promotionStatus}</span>
      </div>
      <dl className="my-profile-season-stats">
        {dashboardRows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <SeasonProgressMeter gamesPlayed={gamesPlayed} />
    </section>
  )
}

function SeasonProgressMeter({ gamesPlayed }: { gamesPlayed: number }) {
  const completed = Math.min(gamesPlayed, CURRENT_SEASON_TARGET_GAMES)
  const completion = percentage(completed, CURRENT_SEASON_TARGET_GAMES)

  return (
    <div className="my-profile-season-progress" aria-label="Season completion">
      <div>
        <span>Season Completion</span>
        <strong>{formatPercentage(completion)}</strong>
      </div>
      <div
        className="my-profile-progress-blocks"
        aria-label={`${completed} of ${CURRENT_SEASON_TARGET_GAMES} games played`}
      >
        {Array.from({ length: CURRENT_SEASON_TARGET_GAMES }, (_, index) => (
          <span
            className={index < completed ? 'is-complete' : undefined}
            key={index}
          />
        ))}
      </div>
      <p>
        {completed} / {CURRENT_SEASON_TARGET_GAMES}
      </p>
    </div>
  )
}

function RecentResultsPanel({ contexts }: { contexts: GameContext[] }) {
  const recent = contexts.slice(0, 5)

  return (
    <section className="panel my-profile-recent-panel" aria-labelledby="my-recent-results-title">
      <div className="panel-heading">
        <p className="eyebrow">Recent Results</p>
        <h2 id="my-recent-results-title">Last Five League Games</h2>
      </div>
      <div className="my-profile-recent-list">
        {recent.length > 0 ? (
          recent.map((context) => (
            <Link
              className={`my-profile-result-card result-${context.result.toLowerCase()}`}
              key={context.game.id}
              to={`/games/${context.game.id}`}
            >
              <span className="my-profile-result-mark">
                {formatRecentResultMark(context.result)}
              </span>
              <div>
                <strong>
                  {formatPlayerName(context.opponent, context.opponentDisplayName) ||
                    'Unknown Opponent'}
                </strong>
                <p>{getCanonicalMissionName(context.game.mission) || 'Unknown Mission'}</p>
              </div>
              <span>{context.game.date || 'Date Pending'}</span>
            </Link>
          ))
        ) : (
          <p className="operations-empty">No recent league games matched this player.</p>
        )}
      </div>
    </section>
  )
}

function CareerHighlightCard({ highlight }: { highlight: string }) {
  return (
    <section className="panel my-profile-highlight-card" aria-labelledby="my-career-highlight-title">
      <div className="panel-heading">
        <p className="eyebrow">Career Highlight</p>
        <h2 id="my-career-highlight-title">Featured Battle Story</h2>
      </div>
      <p>{highlight}</p>
    </section>
  )
}

function validateProfileEditor(displayName: string, discordName: string) {
  const name = displayName.trim()

  if (name.length < 3) {
    return 'Display name must be at least 3 characters.'
  }

  if (name.length > 24) {
    return 'Display name must be 24 characters or fewer.'
  }

  if (!/^[A-Za-z0-9 _-]+$/.test(name)) {
    return 'Display name may use letters, numbers, spaces, hyphen, and underscore only.'
  }

  if (
    ['admin', 'administrator', 'commissioner', 'guest', 'system', 'unknown']
      .includes(name.toLowerCase())
  ) {
    return 'That display name is reserved.'
  }

  const discord = discordName.trim()

  if (discord.length > 40) {
    return 'Discord name must be 40 characters or fewer.'
  }

  if (discord && !/^[A-Za-z0-9 ._#@-]+$/.test(discord)) {
    return 'Discord name contains unsupported characters.'
  }

  return ''
}

function buildOperatorBadgePlayer(
  data: MyProfileData,
  seasonStats: ProfileStatisticsSnapshot | null,
  leagueModel: PlayerLeagueModel | null,
) {
  const officialGames = getOfficialGamesPlayed(data, seasonStats)

  return {
    careerSummary: {
      records: {
        league: { games: officialGames },
        tournament: { games: 0 },
      },
      totalGames: data.leagueStatistics?.games ?? officialGames,
    },
    displayName: data.user.displayName,
    division: leagueModel?.division || '',
    favoriteFaction: data.user.favoriteFaction || '',
    name: getMyProfileCompetitivePlayerName(data, leagueModel),
    rank: leagueModel?.rank ?? 0,
  }
}

function resolveMyProfileLeagueModel(
  data: MyProfileData,
  allStandings: DivisionStandings[],
) {
  return resolvePlayerLeagueModel(
    allStandings,
    [data.user.canonicalPlayer],
  )
}

function getMyProfileCompetitivePlayerName(
  data: MyProfileData,
  leagueModel: PlayerLeagueModel | null,
) {
  return leagueModel?.standing.player || data.user.canonicalPlayer
}

function getMyProfileCompetitiveHome(leagueModel: PlayerLeagueModel | null) {
  return leagueModel?.division || 'Not Assigned'
}

function getMyProfileCurrentRank(leagueModel: PlayerLeagueModel | null) {
  return leagueModel?.rank ?? 0
}

function getMyProfileClassifications(
  data: MyProfileData,
  seasonStats: ProfileStatisticsSnapshot | null,
  leagueModel: PlayerLeagueModel | null,
): PlayerClassification[] {
  const registrations = data.user.eventRegistrations ?? []
  const hasLeague =
    Boolean(leagueModel) ||
    registrations.some((event) =>
      isActiveProfileRegistration(event, 'league'),
    )
  const hasTournament = registrations.some((event) =>
    isActiveProfileRegistration(event, 'tournament'),
  )
  const classifications: PlayerClassification[] = []
  const officialGames = getOfficialGamesPlayed(data, seasonStats)

  if (hasLeague) {
    classifications.push('League Player')
  }

  if (hasTournament) {
    classifications.push('Tournament Player')
  }

  if (!hasLeague && !hasTournament) {
    classifications.push('Casual Player')
  }

  if (officialGames === 0) {
    classifications.push('New Player')
  }

  if (officialGames >= 50) {
    classifications.push('Veteran')
  }

  if (data.user.role.toLowerCase().includes('commissioner')) {
    classifications.push('Commissioner')
  }

  return classifications
}

function getOfficialGamesPlayed(
  data: MyProfileData,
  seasonStats: ProfileStatisticsSnapshot | null,
) {
  return seasonStats?.games ?? data.careerStatistics?.games ?? data.leagueStatistics?.games ?? 0
}

function isActiveProfileRegistration(
  event: NonNullable<MyProfileData['user']['eventRegistrations']>[number],
  target: 'league' | 'tournament',
) {
  const normalizedStatus = String(event.status || '').trim().toLowerCase()

  if (
    ['deleted', 'removed', 'withdrawn', 'disabled', 'archived', 'completed'].includes(
      normalizedStatus,
    )
  ) {
    return false
  }

  if (isSyntheticCurrentLeagueRegistration(event)) {
    return false
  }

  const identity = `${event.eventType || ''} ${event.eventName || ''}`.toLowerCase()

  return target === 'league'
    ? identity.includes('league')
    : identity.includes('tournament')
}

function isSyntheticCurrentLeagueRegistration(
  event: NonNullable<MyProfileData['user']['eventRegistrations']>[number],
) {
  return event.eventId === 'event-current-league' &&
    String(event.registeredAt || '').trim() === '' &&
    String(event.updatedAt || '').trim() === ''
}

function getMyProfileCareerHighlight(games: RecentGame[]) {
  return games.find((game) => game.bestMoment.trim())?.bestMoment.trim() ||
    'No featured battle story yet.'
}

function getCurrentLeagueLabel(leagueModel: PlayerLeagueModel | null) {
  return getConfiguredEventDisplayName({
    eventName: leagueModel?.currentLeague,
  })
}

function getProfileJoinedDate(data: MyProfileData) {
  const registrationDates = (data.user.eventRegistrations ?? [])
    .map((event) => event.registeredAt)
    .filter(Boolean)
    .sort()
  const firstDate = registrationDates[0] || data.user.created
  const date = new Date(firstDate)

  if (!firstDate || !Number.isFinite(date.getTime())) {
    return 'Joined date unavailable'
  }

  return `Joined ${date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })}`
}

function getCurrentTournamentLabel(events: MyProfileData['user']['eventRegistrations']) {
  const tournament = events?.find((event) =>
    String(event.eventType ?? '').toLowerCase().includes('tournament') ||
    String(event.eventName ?? '').toLowerCase().includes('tournament') ||
    event.eventRole.toLowerCase().includes('tournament') ||
    String(event.registration.eventType ?? '').toLowerCase().includes('tournament'),
  )

  const status =
    String(tournament?.status || tournament?.registration.status || '').toLowerCase()

  if (!tournament || ['deleted', 'removed', 'withdrawn'].includes(status)) {
    return 'Not registered'
  }

  return (
    tournament.eventName ||
    String(tournament.registration.eventName ?? '') ||
    tournament.team ||
    tournament.eventId ||
    'Registered'
  )
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="profile-stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function IntelligencePanel({
  intelligence,
}: {
  intelligence: PlayerIntelligenceSummary
}) {
  const sections: Array<{
    items: IntelligenceMetric[]
    title: string
  }> = [
    { items: intelligence.performance, title: 'Performance' },
    { items: intelligence.trends, title: 'Trend' },
    { items: intelligence.missions, title: 'Missions' },
    { items: intelligence.factions, title: 'Factions' },
    { items: intelligence.opponents, title: 'Opponents' },
    { items: intelligence.turns, title: 'Turn Order' },
    { items: intelligence.promotion, title: 'Promotion' },
    { items: intelligence.comparison, title: 'League Comparison' },
  ]

  return (
    <section className="panel profile-feature-panel" data-visual-surface="my-profile-competitive-coaching">
      <div className="panel-heading">
        <p className="eyebrow">Player Intelligence</p>
        <h2>Competitive Coaching</h2>
      </div>
      <div className="profile-insight-list">
        {intelligence.coaching.map((insight) => (
          <article className={`profile-insight ${insight.tone}`} key={insight.body}>
            <span>{insight.label}</span>
            <p>{insight.body}</p>
          </article>
        ))}
      </div>
      <div className="player-intelligence-grid">
        {sections.map((section) => (
          <article className="player-intelligence-section" key={section.title}>
            <h3>{section.title}</h3>
            <div>
              {section.items.map((item) => (
                <dl className={`intelligence-metric ${item.tone}`} key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                  <small>{item.meta}</small>
                </dl>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function CareerPanel({
  career,
  leaguePlayer,
  playerDisplayName,
}: {
  career: CareerSummary
  leaguePlayer: string
  playerDisplayName: string
}) {
  const playerName = formatPlayerName(leaguePlayer, playerDisplayName)

  return (
    <section className="panel profile-feature-panel career-history-panel">
      <div className="panel-heading">
        <p className="eyebrow">Career</p>
        <h2>{playerName || 'League Player'} Legacy</h2>
      </div>
      <div className="career-summary-grid">
        <StatTile label="Career Games" value={career.games} />
        <StatTile label="Career Wins" value={career.wins} />
        <StatTile label="Career Losses" value={career.losses} />
        <StatTile label="Career Win %" value={formatPercentage(career.winPercentage)} />
        <StatTile label="Career TP" value={career.tp} />
        <StatTile label="Career OP" value={career.op} />
        <StatTile label="Career VP" value={career.vp} />
        <StatTile label="Achievement Points" value={career.achievementPoints} />
        <StatTile label="Seasons Played" value={career.seasonsPlayed} />
        <StatTile label="Promotions" value={career.promotions} />
        <StatTile label="Relegations" value={career.relegations} />
        <StatTile label="Championships" value={career.championships} />
      </div>
      <div className="profile-timeline-list career-timeline-list">
        {career.timeline.map((item) => (
          <article className="profile-timeline-card" key={item.id}>
            <span>{item.type}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <small>{item.timestamp}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

function ChartPanel({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <section className="panel profile-chart-panel">
      <div className="panel-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="intelligence-card-body">{children}</div>
    </section>
  )
}

function TurnAnalyticsPanel({
  derived,
  leagueStats,
}: {
  derived: ProfileDerivedData
  leagueStats: MyProfileData['leagueStatistics']
}) {
  return (
    <section className="panel profile-feature-panel" data-visual-surface="my-profile-advanced-analytics">
      <div className="panel-heading">
        <p className="eyebrow">Advanced Analytics</p>
        <h2>First / Second Turn</h2>
      </div>
      <dl className="operations-metrics compact">
        <div>
          <dt>Going First Win %</dt>
          <dd>{formatPercentage(leagueStats?.firstTurnWinRate ?? derived.turnProfile.firstWinRate)}</dd>
        </div>
        <div>
          <dt>Going Second Win %</dt>
          <dd>{formatPercentage(leagueStats?.secondTurnWinRate ?? derived.turnProfile.secondWinRate)}</dd>
        </div>
        <div>
          <dt>Avg OP Going First</dt>
          <dd>{derived.turnProfile.averageFirstOP}</dd>
        </div>
        <div>
          <dt>Avg OP Going Second</dt>
          <dd>{derived.turnProfile.averageSecondOP}</dd>
        </div>
        <div>
          <dt>First Turn Games</dt>
          <dd>{leagueStats?.firstTurnGames ?? derived.turnProfile.firstGames}</dd>
        </div>
        <div>
          <dt>Second Turn Games</dt>
          <dd>{leagueStats?.secondTurnGames ?? derived.turnProfile.secondGames}</dd>
        </div>
      </dl>
    </section>
  )
}

function RecordsPanel({ records }: { records: PersonalRecord[] }) {
  return (
    <section className="panel profile-feature-panel">
      <div className="panel-heading">
        <p className="eyebrow">Personal Records</p>
        <h2>Career Bests</h2>
      </div>
      <div className="profile-record-grid">
        {records.map((record) => {
          const content = (
            <>
              <span>{record.label}</span>
              <strong>{record.value}</strong>
            </>
          )

          return record.to ? (
            <Link className="profile-record-card" key={record.label} to={record.to}>
              {content}
            </Link>
          ) : (
            <article className="profile-record-card" key={record.label}>
              {content}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ArmyListsPanel({
  lists,
  summary,
}: {
  lists: ArmyList[]
  summary: ArmySummary
}) {
  return (
    <section className="panel profile-feature-panel">
      <div className="panel-heading">
        <p className="eyebrow">Army Lists</p>
        <h2>List Vault</h2>
      </div>
      <dl className="operations-metrics">
        <div>
          <dt>Submitted</dt>
          <dd>{summary.submitted}</dd>
        </div>
        <div>
          <dt>Highest Rated</dt>
          <dd>{summary.highestRated?.armyName || 'No rated list'}</dd>
        </div>
        <div>
          <dt>Newest</dt>
          <dd>{summary.newest?.armyName || 'No list submitted'}</dd>
        </div>
        <div>
          <dt>Most Used</dt>
          <dd>{summary.mostUsedFaction || 'Not established'}</dd>
        </div>
        <div>
          <dt>Favorite Faction</dt>
          <dd>{summary.favoriteFaction || 'Not established'}</dd>
        </div>
        <div>
          <dt>Average Rating</dt>
          <dd>{summary.averageRating}</dd>
        </div>
      </dl>
      <div className="profile-list-stack">
        {lists.slice(0, 4).map((list) => (
          <article className="operations-record" key={list.id}>
            <span>{list.faction || 'Unknown faction'}</span>
            <h3>{list.armyName || 'Untitled list'}</h3>
            <p>{getCanonicalMissionName(list.mission) || 'Open mission'} / Score {list.score}</p>
          </article>
        ))}
      </div>
      <div className="operations-actions profile-submit-action">
        <Link to="/army-lists/submit">Submit New Army List</Link>
      </div>
    </section>
  )
}

function AchievementsPanel({
  achievements,
}: {
  achievements: AchievementCard[]
}) {
  const unlocked = achievements.filter((achievement) => achievement.state === 'Unlocked')
  const achievementScore = unlocked.reduce(
    (total, achievement) => total + achievement.points,
    0,
  )
  const completion =
    achievements.length > 0 ? Math.round((unlocked.length / achievements.length) * 100) : 0
  const newest = unlocked
    .slice()
    .sort(
      (a, b) =>
        new Date(b.dateEarned || 0).getTime() - new Date(a.dateEarned || 0).getTime(),
    )[0]
  const rarest = unlocked
    .slice()
    .sort((a, b) => getAchievementTierWeight(b.rarity) - getAchievementTierWeight(a.rarity))[0]

  return (
    <section className="panel profile-feature-panel">
      <div className="panel-heading">
        <p className="eyebrow">Achievements</p>
        <h2>Badge Case</h2>
      </div>
      <div className="achievement-summary-grid">
        <div>
          <span>Score</span>
          <strong>{achievementScore}</strong>
        </div>
        <div>
          <span>Completion</span>
          <strong>{completion}%</strong>
        </div>
        <div>
          <span>Newest</span>
          <strong>{newest?.title ?? 'Locked'}</strong>
        </div>
        <div>
          <span>Rarest</span>
          <strong>{rarest ? `${rarest.rarity} / ${rarest.title}` : 'Locked'}</strong>
        </div>
      </div>
      <div className="achievement-grid">
        {achievements.map((achievement) => (
          <article
            className={`achievement-card ${achievement.state.toLowerCase()} ${achievement.rarity.toLowerCase()}`}
            key={achievement.title}
          >
            <span>{achievement.rarity}</span>
            <b aria-hidden="true">{achievement.icon || 'Badge'}</b>
            <h3>{achievement.title}</h3>
            <p>{achievement.description}</p>
            <strong>
              {achievement.state}
              {achievement.state === 'Unlocked' && achievement.points > 0
                ? ` / ${achievement.points} pts`
                : ''}
            </strong>
            <span className="profile-progress-track">
              <span style={{ width: `${achievement.progress}%` }} />
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}

function buildProfileDerivedData(
  data: MyProfileData,
  leaguePlayer: string,
  seasonStats: ProfileStatisticsSnapshot | null,
): ProfileDerivedData {
  const contexts = data.recentGames
    .map((game) => buildGameContext(game, leaguePlayer))
    .filter((context) => context.result !== 'Unknown')
  const factionPerformance = buildPerformanceRows(contexts, 'faction')
  const missionPerformance = buildPerformanceRows(contexts, 'mission')
  const opponentRows = buildPerformanceRows(contexts, 'opponent')
  const turnProfile = buildTurnProfile(contexts)
  const armySummary = buildArmySummary(data.submittedLists, data.leagueStatistics)
  const intelligence = buildPlayerIntelligence({
    contexts,
    factionPerformance,
    intelligence: data.intelligence,
    missionPerformance,
    opponentRows,
    performance: data.leaguePerformance,
    seasonStats,
    turnProfile,
  })

  return {
    achievements: buildAchievementCards(data.achievements, seasonStats, data.submittedLists),
    armySummary,
    career: buildCareerSummary(data, contexts, seasonStats),
    contexts,
    factionPerformance,
    intelligence,
    insights: buildInsights({
      contexts,
      factionPerformance,
      missionPerformance,
      opponentRows,
      performance: data.leaguePerformance,
      seasonStats,
      turnProfile,
    }),
    missionPerformance,
    opponentRows,
    records: buildPersonalRecords(contexts, data.leaguePerformance),
    timeline: buildProfileTimeline(data, leaguePlayer, contexts),
    trend: buildTrendPoints(contexts),
    turnProfile,
  }
}

function buildGameContext(game: RecentGame, leaguePlayer: string): GameContext {
  const player = leaguePlayer.toLowerCase()
  const isWinner = game.winner.toLowerCase() === player
  const isLoser = game.loser.toLowerCase() === player
  const isDraw = isDrawGame(game)
  const result = isDraw ? 'Draw' : isWinner ? 'Win' : isLoser ? 'Loss' : 'Unknown'
  const tp = getPlayerScore(game.tp, isWinner)
  const op = getPlayerScore(game.op, isWinner)
  const vp = getPlayerScore(game.vp, isWinner)

  return {
    faction: isWinner ? game.winnerFaction : isLoser ? game.loserFaction : '',
    game,
    opponent: isWinner ? game.loser : isLoser ? game.winner : '',
    opponentDisplayName:
      isWinner
        ? game.loserDisplayName
        : isLoser
          ? game.winnerDisplayName
          : '',
    op,
    result,
    tp,
    vp,
    wentFirst: game.firstTurn.toLowerCase() === player,
  }
}

function buildPerformanceRows(
  contexts: GameContext[],
  key: 'faction' | 'mission' | 'opponent',
): PerformanceRow[] {
  const rows = new Map<
    string,
    PerformanceRow & { totalOP: number; totalTP: number; totalVP: number }
  >()

  contexts.forEach((context) => {
    const label =
      key === 'mission'
        ? getCanonicalMissionName(context.game.mission)
        : key === 'opponent'
          ? context.opponent
          : context.faction

    if (!label) {
      return
    }

    const existing =
      rows.get(label) ??
      {
        averageOP: 0,
        averageTP: 0,
        averageVP: 0,
        games: 0,
        label,
        losses: 0,
        draws: 0,
        totalOP: 0,
        totalTP: 0,
        totalVP: 0,
        winRate: 0,
        wins: 0,
      }

    existing.games += 1
    existing.totalTP += context.tp
    existing.totalOP += context.op
    existing.totalVP += context.vp

    if (context.result === 'Win') {
      existing.wins += 1
    }

    if (context.result === 'Loss') {
      existing.losses += 1
    }

    if (context.result === 'Draw') {
      existing.draws += 1
    }

    rows.set(label, existing)
  })

  return Array.from(rows.values())
    .map((row) => ({
      averageOP: average(row.totalOP, row.games),
      averageTP: average(row.totalTP, row.games),
      averageVP: average(row.totalVP, row.games),
      games: row.games,
      label: row.label,
      losses: row.losses,
      draws: row.draws,
      winRate: percentage(row.wins, row.games),
      wins: row.wins,
    }))
    .sort((left, right) => {
      if (right.winRate !== left.winRate) {
        return right.winRate - left.winRate
      }

      return right.games - left.games
    })
}

function buildTurnProfile(contexts: GameContext[]) {
  const first = contexts.filter((context) => context.wentFirst)
  const second = contexts.filter((context) => !context.wentFirst)

  return {
    averageFirstOP: average(sum(first, 'op'), first.length),
    averageSecondOP: average(sum(second, 'op'), second.length),
    firstGames: first.length,
    firstWinRate: percentage(
      first.filter((context) => context.result === 'Win').length,
      first.length,
    ),
    secondGames: second.length,
    secondWinRate: percentage(
      second.filter((context) => context.result === 'Win').length,
      second.length,
    ),
  }
}

function buildPlayerIntelligence({
  contexts,
  factionPerformance,
  intelligence,
  missionPerformance,
  opponentRows,
  performance,
  seasonStats,
  turnProfile,
}: {
  contexts: GameContext[]
  factionPerformance: PerformanceRow[]
  intelligence: MyProfileData['intelligence']
  missionPerformance: PerformanceRow[]
  opponentRows: PerformanceRow[]
  performance: MyProfileData['leaguePerformance']
  seasonStats: ProfileStatisticsSnapshot | null
  turnProfile: ProfileDerivedData['turnProfile']
}): PlayerIntelligenceSummary {
  const coaching = buildCoachingInsights({
    contexts,
    factionPerformance,
    missionPerformance,
    opponentRows,
    performance,
    seasonStats,
    turnProfile,
  })

  return {
    coaching,
    comparison: buildComparisonMetrics(intelligence, seasonStats),
    factions: buildFactionIntelligence(factionPerformance),
    missions: buildMissionIntelligence(missionPerformance),
    opponents: buildOpponentIntelligence(opponentRows, performance),
    performance: buildPerformanceIntelligence(contexts, seasonStats),
    promotion: buildPromotionIntelligence(seasonStats),
    trends: buildTrendIntelligence(contexts),
    turns: buildTurnIntelligence(turnProfile),
  }
}

function buildPerformanceIntelligence(
  contexts: GameContext[],
  seasonStats: ProfileStatisticsSnapshot | null,
): IntelligenceMetric[] {
  if (contexts.length === 0) {
    return [notEnoughMetric('Performance')]
  }

  const wins = contexts.filter((context) => context.result === 'Win').length
  const vpMargins = contexts.map((context) => getPlayerVictoryPointMargin(context))
  const winningMargins = vpMargins.filter((margin) => margin > 0)

  return [
    {
      label: 'Current Record',
      meta: `${contexts.length} recorded games in the profile window`,
      tone: wins >= contexts.length - wins ? 'good' : 'alert',
      value: `${wins}-${contexts.length - wins}`,
    },
    {
      label: 'Average OP',
      meta: 'Objective scoring from attached games',
      tone: (seasonStats?.averageObjectivePoints ?? 0) >= 4 ? 'good' : 'neutral',
      value: String(seasonStats?.averageObjectivePoints ?? average(sum(contexts, 'op'), contexts.length)),
    },
    {
      label: 'Average Victory Margin',
      meta: winningMargins.length > 0 ? 'VP margin in wins' : 'No wins in the profile window',
      tone: winningMargins.length > 0 ? 'good' : 'neutral',
      value: winningMargins.length > 0 ? `${average(total(winningMargins), winningMargins.length)} VP` : 'Not enough games played yet.',
    },
  ]
}

function buildMissionIntelligence(rows: PerformanceRow[]): IntelligenceMetric[] {
  const qualified = rows.filter((row) => row.games > 0)

  if (qualified.length === 0) {
    return [notEnoughMetric('Mission Data')]
  }

  const bestWinRate = qualified[0]
  const bestOP = qualified.slice().sort((a, b) => b.averageOP - a.averageOP)[0]
  const weakestOP = qualified.slice().sort((a, b) => a.averageOP - b.averageOP)[0]

  return [
    {
      label: 'Best Mission',
      meta: `${bestWinRate.wins}-${bestWinRate.losses} over ${bestWinRate.games} games`,
      tone: 'good',
      value: bestWinRate.label,
    },
    {
      label: 'Highest Average OP',
      meta: `${bestOP.games} games on ${bestOP.label}`,
      tone: 'good',
      value: `${bestOP.averageOP} OP`,
    },
    {
      label: 'Lowest Average OP',
      meta: `${weakestOP.games} games on ${weakestOP.label}`,
      tone: weakestOP.averageOP < bestOP.averageOP ? 'alert' : 'neutral',
      value: `${weakestOP.averageOP} OP`,
    },
  ]
}

function buildFactionIntelligence(rows: PerformanceRow[]): IntelligenceMetric[] {
  const qualified = rows.filter((row) => row.games > 0)

  if (qualified.length === 0) {
    return [notEnoughMetric('Faction Data')]
  }

  const bestWinRate = qualified[0]
  const bestOP = qualified.slice().sort((a, b) => b.averageOP - a.averageOP)[0]
  const weakest = qualified.slice().reverse()[0]

  return [
    {
      label: 'Best Faction',
      meta: `${formatPercentage(bestWinRate.winRate)} win rate`,
      tone: 'good',
      value: bestWinRate.label,
    },
    {
      label: 'Faction OP Average',
      meta: `${bestOP.games} games with ${bestOP.label}`,
      tone: 'good',
      value: `${bestOP.averageOP} OP`,
    },
    {
      label: 'Needs Work',
      meta: `${weakest.wins}-${weakest.losses} record`,
      tone: weakest.losses > weakest.wins ? 'alert' : 'neutral',
      value: weakest.label,
    },
  ]
}

function buildOpponentIntelligence(
  rows: PerformanceRow[],
  performance: MyProfileData['leaguePerformance'],
): IntelligenceMetric[] {
  const qualified = rows.filter((row) => row.games > 0)

  if (qualified.length === 0) {
    return [notEnoughMetric('Opponent Data')]
  }

  const neverBeaten = qualified.find((row) => row.wins === 0 && row.losses > 0)
  const best = qualified.find((row) => row.wins > 0) ?? qualified[0]
  const rivalry = qualified.slice().sort((a, b) => b.games - a.games)[0]

  return [
    {
      label: 'Best Opponent',
      meta: `${best.wins}-${best.losses}-${best.draws} head-to-head`,
      tone: best.wins > best.losses ? 'good' : 'neutral',
      value: performance.bestOpponent || best.label,
    },
    {
      label: 'Current Rival',
      meta: `${rivalry.games} games played`,
      tone: 'neutral',
      value: performance.mostPlayedOpponent || rivalry.label,
    },
    {
      label: 'Unsolved Matchup',
      meta: neverBeaten ? `${neverBeaten.losses} losses` : 'No winless opponent matchup in the profile window',
      tone: neverBeaten ? 'alert' : 'good',
      value: neverBeaten?.label ?? 'None established',
    },
  ]
}

function buildTurnIntelligence(
  turnProfile: ProfileDerivedData['turnProfile'],
): IntelligenceMetric[] {
  if (turnProfile.firstGames + turnProfile.secondGames === 0) {
    return [notEnoughMetric('Turn Data')]
  }

  const betterSecond = turnProfile.averageSecondOP > turnProfile.averageFirstOP
  const betterFirst = turnProfile.averageFirstOP > turnProfile.averageSecondOP

  return [
    {
      label: 'Going First',
      meta: `${turnProfile.firstGames} games`,
      tone: betterFirst ? 'good' : 'neutral',
      value: `${formatPercentage(turnProfile.firstWinRate)} / ${turnProfile.averageFirstOP} OP`,
    },
    {
      label: 'Going Second',
      meta: `${turnProfile.secondGames} games`,
      tone: betterSecond ? 'good' : 'neutral',
      value: `${formatPercentage(turnProfile.secondWinRate)} / ${turnProfile.averageSecondOP} OP`,
    },
    {
      label: 'Observation',
      meta: 'Based on OP average by turn order',
      tone: betterFirst || betterSecond ? 'good' : 'neutral',
      value: betterSecond ? 'Better going second' : betterFirst ? 'Better going first' : 'Even profile',
    },
  ]
}

function buildTrendIntelligence(contexts: GameContext[]): IntelligenceMetric[] {
  if (contexts.length < 2) {
    return [notEnoughMetric('Trend Data')]
  }

  const lastFive = contexts.slice(0, 5)
  const previousFive = contexts.slice(5, 10)
  const recentWins = lastFive.filter((context) => context.result === 'Win').length
  const previousOP = previousFive.length > 0 ? average(sum(previousFive, 'op'), previousFive.length) : null
  const recentOP = average(sum(lastFive, 'op'), lastFive.length)
  const recentTP = average(sum(lastFive, 'tp'), lastFive.length)
  const opDelta = previousOP === null ? null : roundOne(recentOP - previousOP)

  return [
    {
      label: 'Last 5 Games',
      meta: `${lastFive.length} recent games`,
      tone: recentWins >= Math.ceil(lastFive.length / 2) ? 'good' : 'alert',
      value: `${recentWins}-${lastFive.length - recentWins}`,
    },
    {
      label: 'OP Trend',
      meta: previousOP === null ? 'Needs five more games for comparison' : `Previous window: ${previousOP} OP`,
      tone: opDelta === null ? 'neutral' : opDelta >= 0 ? 'good' : 'alert',
      value: opDelta === null ? 'Not enough games played yet.' : `${opDelta >= 0 ? '+' : ''}${opDelta} OP`,
    },
    {
      label: 'TP Momentum',
      meta: 'Average TP over recent games',
      tone: recentTP >= 3 ? 'good' : 'neutral',
      value: `${recentTP} TP`,
    },
  ]
}

function buildPromotionIntelligence(
  seasonStats: ProfileStatisticsSnapshot | null,
): IntelligenceMetric[] {
  if (!seasonStats || seasonStats.games === 0) {
    return [notEnoughMetric('Promotion Data')]
  }

  const gamesRemaining = getGamesRemaining(seasonStats)
  const isMain = seasonStats.division.toLowerCase().includes('main')
  const probability = getPromotionProbabilityLabel(seasonStats)

  return [
    {
      label: isMain ? 'Relegation Risk' : 'Promotion Probability',
      meta: seasonStats.promotionStatus,
      tone: probability === 'High' ? 'good' : probability === 'Low' ? 'alert' : 'neutral',
      value: probability,
    },
    {
      label: 'Games Remaining',
      meta: `${seasonStats.games} of ${CURRENT_SEASON_TARGET_GAMES} target games played`,
      tone: gamesRemaining <= 2 ? 'alert' : 'neutral',
      value: String(gamesRemaining),
    },
    {
      label: 'Required Wins',
      meta: 'Based on current rank band',
      tone: 'neutral',
      value: String(getRequiredWinsForMovement(seasonStats)),
    },
  ]
}

function buildComparisonMetrics(
  intelligence: MyProfileData['intelligence'],
  seasonStats: ProfileStatisticsSnapshot | null,
): IntelligenceMetric[] {
  if (!seasonStats || seasonStats.games === 0) {
    return [notEnoughMetric('League Comparison')]
  }

  const divisionOPDelta = roundOne(
    seasonStats.averageObjectivePoints - intelligence.divisionAverage.averageOP,
  )
  const leagueOPDelta = roundOne(
    seasonStats.averageObjectivePoints - intelligence.leagueAverage.averageOP,
  )

  return [
    {
      label: 'Division OP Delta',
      meta: `${intelligence.division || seasonStats.division} average: ${intelligence.divisionAverage.averageOP} OP`,
      tone: divisionOPDelta >= 0 ? 'good' : 'alert',
      value: `${divisionOPDelta >= 0 ? '+' : ''}${divisionOPDelta} OP`,
    },
    {
      label: 'League OP Delta',
      meta: `League average: ${intelligence.leagueAverage.averageOP} OP`,
      tone: leagueOPDelta >= 0 ? 'good' : 'alert',
      value: `${leagueOPDelta >= 0 ? '+' : ''}${leagueOPDelta} OP`,
    },
    {
      label: 'OP Rank',
      meta: 'Among active league players',
      tone: intelligence.ranks.objectivePoints <= 3 ? 'good' : 'neutral',
      value: formatRank(intelligence.ranks.objectivePoints),
    },
  ]
}

function buildCoachingInsights({
  contexts,
  factionPerformance,
  missionPerformance,
  opponentRows,
  performance,
  seasonStats,
  turnProfile,
}: {
  contexts: GameContext[]
  factionPerformance: PerformanceRow[]
  missionPerformance: PerformanceRow[]
  opponentRows: PerformanceRow[]
  performance: MyProfileData['leaguePerformance']
  seasonStats: ProfileStatisticsSnapshot | null
  turnProfile: ProfileDerivedData['turnProfile']
}): Insight[] {
  if (contexts.length === 0) {
    return [
      {
        body: 'Not enough games played yet.',
        label: 'Awaiting Data',
        tone: 'neutral',
      },
    ]
  }

  return buildInsights({
    contexts,
    factionPerformance,
    missionPerformance,
    opponentRows,
    performance,
    seasonStats,
    turnProfile,
  })
}

function buildInsights({
  contexts,
  factionPerformance,
  missionPerformance,
  opponentRows,
  performance,
  seasonStats,
  turnProfile,
}: {
  contexts: GameContext[]
  factionPerformance: PerformanceRow[]
  missionPerformance: PerformanceRow[]
  opponentRows: PerformanceRow[]
  performance: MyProfileData['leaguePerformance']
  seasonStats: ProfileStatisticsSnapshot | null
  turnProfile: ProfileDerivedData['turnProfile']
}): Insight[] {
  const insights: Insight[] = []
  const bestFaction = factionPerformance[0]
  const weakestMission = missionPerformance
    .slice()
    .reverse()
    .find((row) => row.games > 0)
  const bestMission = missionPerformance[0]
  const neverBeaten = opponentRows.find((row) => row.wins === 0 && row.losses > 0)

  if (bestFaction) {
    insights.push({
      body: `You perform best with ${bestFaction.label}: ${formatPercentage(bestFaction.winRate)} over ${bestFaction.games} games.`,
      label: 'Strength',
      tone: 'good',
    })
  }

  if (turnProfile.secondGames > 0) {
    insights.push({
      body: `Your average OP is ${turnProfile.averageSecondOP} when going second.`,
      label: 'Turn Profile',
      tone: turnProfile.averageSecondOP >= turnProfile.averageFirstOP ? 'good' : 'neutral',
    })
  }

  if (weakestMission) {
    insights.push({
      body: `You struggle most on ${weakestMission.label}: ${formatPercentage(weakestMission.winRate)} win rate.`,
      label: 'Weakness',
      tone: 'alert',
    })
  }

  if (performance.currentStreak !== 'None') {
    insights.push({
      body: `Current form: ${performance.currentStreak}. Protect the streak or stop the slide next round.`,
      label: 'Form',
      tone: performance.currentStreak.endsWith('W') ? 'good' : 'alert',
    })
  }

  if (seasonStats?.promotionStatus) {
    insights.push({
      body: formatPromotionGuidance(seasonStats),
      label: 'Promotion',
      tone: seasonStats.promotionStatus.includes('Promotion') ? 'good' : 'neutral',
    })
  }

  if (neverBeaten) {
    insights.push({
      body: `You have not beaten ${neverBeaten.label} yet. Review that matchup before the next pairing.`,
      label: 'Rivalry',
      tone: 'alert',
    })
  }

  if (bestMission) {
    insights.push({
      body: `${bestMission.label} is your strongest mission profile at ${formatPercentage(bestMission.winRate)}.`,
      label: 'Mission Edge',
      tone: 'good',
    })
  }

  if (contexts.length === 0) {
    insights.push({
      body: 'No league games are attached yet. Once results are reported, coaching signals will populate automatically.',
      label: 'Awaiting Data',
      tone: 'neutral',
    })
  }

  return insights.slice(0, 6)
}

function buildPersonalRecords(
  contexts: GameContext[],
  performance: MyProfileData['leaguePerformance'],
): PersonalRecord[] {
  const highestVP = getHighestContext(contexts, 'vp')
  const highestOP = getHighestContext(contexts, 'op')
  const largestTPWin = contexts
    .filter((context) => context.result === 'Win')
    .map((context) => ({
      context,
      margin: getScoreMargin(context.game.tp),
    }))
    .sort((left, right) => right.margin - left.margin)[0]

  return [
    {
      label: 'Highest VP',
      to: highestVP ? `/games/${highestVP.game.id}` : undefined,
      value: highestVP ? String(highestVP.vp) : 'Not recorded',
    },
    {
      label: 'Highest OP',
      to: highestOP ? `/games/${highestOP.game.id}` : undefined,
      value: highestOP ? String(highestOP.op) : 'Not recorded',
    },
    {
      label: 'Largest TP Victory',
      to: largestTPWin ? `/games/${largestTPWin.context.game.id}` : undefined,
      value: largestTPWin ? String(largestTPWin.margin) : 'Not recorded',
    },
    {
      label: 'Longest Win Streak',
      value: String(performance.longestWinStreak),
    },
    {
      label: 'Most Played Opponent',
      value: performance.mostPlayedOpponent || 'Not established',
    },
    {
      label: 'Favorite Opponent',
      value: performance.bestOpponent || performance.fallbackBestOpponent || 'Not established',
    },
  ]
}

function buildTrendPoints(contexts: GameContext[]): BarChartPoint[] {
  const recent = contexts.slice(0, 8).reverse()

  if (recent.length === 0) {
    return [{ label: 'No games', meta: 'Awaiting results', value: 0 }]
  }

  return recent.map((context, index) => ({
    label: `G${index + 1}`,
    meta: `${context.result} vs ${
      formatPlayerName(context.opponent, context.opponentDisplayName) ||
      'Unknown'
    }`,
    value: context.result === 'Win' ? 100 : 25,
  }))
}

function buildProfileTimeline(
  data: MyProfileData,
  leaguePlayer: string,
  contexts: GameContext[],
): ProfileTimelineItem[] {
  const timeline: ProfileTimelineItem[] = []
  const playerName =
    formatPlayerName(leaguePlayer, data.user.playerDisplayName) ||
    'League player'

  if (data.user.created) {
    timeline.push({
      body: `${playerName} joined the portal identity system.`,
      id: 'joined-league',
      link: '/profile',
      timestamp: data.user.created,
      title: 'Joined League',
      type: 'Identity',
    })
  }

  contexts.slice(0, 5).forEach((context) => {
    timeline.push({
      body: `${context.result} against ${
        formatPlayerName(context.opponent, context.opponentDisplayName) ||
        'Unknown'
      } on ${getCanonicalMissionName(context.game.mission) || 'unknown mission'}.`,
      id: `game-${context.game.id}`,
      link: `/games/${context.game.id}`,
      timestamp: context.game.date,
      title: context.result === 'Win' ? 'Game Won' : 'Game Lost',
      type: 'Match',
    })
  })

  data.submittedLists.slice(0, 3).forEach((list) => {
    timeline.push({
      body: `${list.armyName || 'Untitled list'} submitted for ${list.faction || 'unknown faction'}.`,
      id: `list-${list.id}`,
      link: '/army-lists',
      timestamp: list.submissionDate,
      title: 'Army List Submitted',
      type: 'Army List',
    })
  })

  data.achievements
    .filter((achievement) => achievement.unlocked)
    .slice(0, 5)
    .forEach((achievement) => {
      timeline.push({
        body: `${achievement.description} (${achievement.tier}, ${achievement.points} pts).`,
        id: `achievement-${achievement.id}`,
        link: '/profile',
        timestamp: achievement.dateEarned,
        title: achievement.name || achievement.title,
        type: 'Achievement Earned',
      })
    })

  data.recentActivity.slice(0, 5).forEach((item) => {
    timeline.push({
      body: item.body,
      id: item.id,
      link: item.link,
      timestamp: item.timestamp,
      title: item.title,
      type: item.type,
    })
  })

  return timeline.slice(0, 12)
}

function buildCareerSummary(
  data: MyProfileData,
  contexts: GameContext[],
  seasonStats: ProfileStatisticsSnapshot | null,
): CareerSummary {
  const unlockedAchievements = data.achievements.filter((achievement) => achievement.unlocked)
  const achievementPoints = unlockedAchievements.reduce(
    (totalPoints, achievement) => totalPoints + achievement.points,
    0,
  )
  const awards = unlockedAchievements.filter((achievement) => achievement.commissionerAward).length
  const movement = seasonStats?.promotionStatus ?? 'Unranked'
  const promotions = movement.includes('Promotion') ? 1 : 0
  const relegations = movement.includes('Relegation') ? 1 : 0
  const championships = seasonStats?.rank === 1 ? 1 : 0
  const timeline: ProfileTimelineItem[] = [
    {
      body: `${formatRecord(seasonStats)} with ${seasonStats?.tp ?? 0} TP, ${seasonStats?.op ?? 0} OP, and ${seasonStats?.vp ?? 0} VP.`,
      id: 'career-current-season',
      link: '/profile',
      timestamp: data.user.created || '',
      title: seasonStats?.division || 'Current Season',
      type: 'Season',
    },
    ...unlockedAchievements.slice(0, 5).map((achievement) => ({
      body: `${achievement.description} (${achievement.points} pts).`,
      id: `career-achievement-${achievement.id}`,
      link: '/profile',
      timestamp: achievement.dateEarned,
      title: achievement.name || achievement.title,
      type: 'Legacy Achievement',
    })),
  ]

  return {
    achievementPoints,
    awards,
    championships,
    games: seasonStats?.games ?? contexts.length,
    losses: seasonStats?.losses ?? contexts.filter((context) => context.result === 'Loss').length,
    op: seasonStats?.op ?? sum(contexts, 'op'),
    promotions,
    relegations,
    seasonsPlayed: seasonStats && seasonStats.games > 0 ? 1 : 0,
    timeline,
    tp: seasonStats?.tp ?? sum(contexts, 'tp'),
    vp: seasonStats?.vp ?? sum(contexts, 'vp'),
    winPercentage: seasonStats?.winPercentage ?? percentage(
      contexts.filter((context) => context.result === 'Win').length,
      contexts.length,
    ),
    wins: seasonStats?.wins ?? contexts.filter((context) => context.result === 'Win').length,
  }
}

function buildArmySummary(
  lists: ArmyList[],
  profile: MyProfileData['leagueStatistics'],
): ArmySummary {
  const favoriteArmy =
    normalizeProfileArmyMetric(profile?.favoriteFaction) ||
    normalizeProfileArmyMetric(profile?.armyListSummary.favoriteFaction) ||
    getMostCommon(lists.map((list) => list.sectorial || list.faction))

  return {
    averageRating:
      profile?.armyListSummary.averageRating ??
      average(
        lists.reduce((total, list) => total + list.score, 0),
        lists.length,
      ),
    favoriteFaction: favoriteArmy,
    highestRated:
      profile?.armyListSummary.highestRated ?? getHighestRatedList(lists),
    mostUsedFaction:
      normalizeProfileArmyMetric(profile?.favoriteFaction) ||
      getMostCommon(lists.map((list) => list.sectorial || list.faction)),
    newest: profile?.armyListSummary.newest ?? getNewestList(lists),
    submitted: profile?.armyListSummary.submitted ?? lists.length,
  }
}

function normalizeProfileArmyMetric(value: string | undefined) {
  if (!value) {
    return ''
  }

  return normalizeArmyForDisplay(value.replace(/\s*\(\d+\s+games?\)\s*$/i, ''))
}

function buildAchievementCards(
  achievements: ProfileAchievement[],
  seasonStats: ProfileStatisticsSnapshot | null,
  lists: ArmyList[],
): AchievementCard[] {
  if (achievements.length > 0) {
    return achievements.slice(0, 12).map((achievement) => ({
      category: achievement.category,
      dateEarned: achievement.dateEarned,
      description: achievement.description,
      icon: getAchievementIconLabel(achievement.icon),
      points: achievement.points,
      progress: achievement.unlocked ? 100 : Math.min(100, Math.max(0, achievement.progress)),
      rarity: normalizeAchievementTier(achievement.tier),
      state: achievement.unlocked ? 'Unlocked' : 'Locked',
      title: achievement.name || achievement.title,
    }))
  }

  const unlocked = achievements.map((achievement, index) => ({
    category: achievement.category,
    dateEarned: achievement.dateEarned,
    description: achievement.description,
    icon: getAchievementIconLabel(achievement.icon),
    points: achievement.points,
    progress: 100,
    rarity: index === 0 ? 'Rare' : 'Common',
    state: 'Unlocked',
    title: achievement.name || achievement.title,
  })) satisfies AchievementCard[]

  const placeholders: AchievementCard[] = [
    {
      category: 'Performance',
      dateEarned: '',
      description: 'Win three games in a row during the current season.',
      icon: 'Zap',
      points: 100,
      progress: Math.min(100, (seasonStats?.wins ?? 0) * 34),
      rarity: 'Rare',
      state: 'Locked',
      title: 'Momentum Spike',
    },
    {
      category: 'Army Building',
      dateEarned: '',
      description: 'Submit five approved lists to the army vault.',
      icon: 'Files',
      points: 45,
      progress: Math.min(100, lists.length * 20),
      rarity: 'Common',
      state: lists.length >= 5 ? 'Unlocked' : 'Locked',
      title: 'List Engineer',
    },
    {
      category: 'Season Awards',
      dateEarned: '',
      description: 'Reach rank #1 in your division.',
      icon: 'Crown',
      points: 200,
      progress: seasonStats?.rank === 1 ? 100 : 35,
      rarity: 'Legendary',
      state: seasonStats?.rank === 1 ? 'Unlocked' : 'Locked',
      title: 'Division Apex',
    },
  ]

  return [...unlocked, ...placeholders].slice(0, 8)
}

function normalizeAchievementTier(value: string): AchievementCard['rarity'] {
  if (value === 'Legendary') {
    return 'Legendary'
  }

  if (value === 'Epic') {
    return 'Epic'
  }

  if (value === 'Rare') {
    return 'Rare'
  }

  return 'Common'
}

function getAchievementTierWeight(value: AchievementCard['rarity']): number {
  if (value === 'Legendary') {
    return 4
  }

  if (value === 'Epic') {
    return 3
  }

  if (value === 'Rare') {
    return 2
  }

  return 1
}

function getAchievementIconLabel(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function buildStatsFromProfile(
  profile: MyProfileData['leagueStatistics'],
): ProfileStatisticsSnapshot | null {
  if (!profile) {
    return null
  }

  const winPercentage = percentage(profile.wins, profile.games)

  return {
    averageObjectivePoints: average(profile.op, profile.games),
    averageTournamentPoints: average(profile.tp, profile.games),
    averageVictoryPoints: average(profile.vp, profile.games),
    division: profile.division,
    games: profile.games,
    losses: profile.losses,
    draws: profile.draws,
    op: profile.op,
    promotionStatus: profile.rank > 0 ? 'In contention' : 'Unranked',
    rank: profile.rank,
    seasonProgress: profile.games,
    tp: profile.tp,
    vp: profile.vp,
    winPercentage,
    wins: profile.wins,
  }
}

function buildStatsFromLeagueModel(
  leagueModel: PlayerLeagueModel | null,
): ProfileStatisticsSnapshot | null {
  if (!leagueModel) {
    return null
  }

  const standing = leagueModel.standing
  const winPercentage = percentage(standing.wins, standing.games)

  return {
    averageObjectivePoints: average(standing.op, standing.games),
    averageTournamentPoints: average(standing.tp, standing.games),
    averageVictoryPoints: average(standing.vp, standing.games),
    division: leagueModel.division,
    games: standing.games,
    losses: standing.losses,
    draws: standing.draws,
    op: standing.op,
    promotionStatus:
      standing.rank > 0 ? getProfilePromotionStatus(leagueModel.division, standing.rank) : 'Unranked',
    rank: standing.rank,
    seasonProgress: standing.games,
    tp: standing.tp,
    vp: standing.vp,
    winPercentage,
    wins: standing.wins,
  }
}

function getProfilePromotionStatus(division: string, rank: number) {
  if (rank <= 0) {
    return 'Unranked'
  }

  if (rank === 1) {
    return '⭐ League Leader'
  }

  if (division.toLowerCase().includes('main')) {
    return rank >= 7 ? 'Relegation Position' : 'Safe'
  }

  if (rank <= 2) {
    return 'Promotion Position'
  }

  if (rank === 3) {
    return '⚔ Challenge Match'
  }

  return 'Safe'
}

function getPlayerScore(score: string, isWinner: boolean) {
  const [winnerScore, loserScore] = splitScore(score)
  return isWinner ? winnerScore : loserScore
}

function splitScore(score: string) {
  const [winnerScore = 0, loserScore = 0] = score
    .split('-')
    .map((value) => Number(value.trim()) || 0)

  return [winnerScore, loserScore] as const
}

function getScoreMargin(score: string) {
  const [winnerScore, loserScore] = splitScore(score)
  return Math.abs(winnerScore - loserScore)
}

function getPlayerVictoryPointMargin(context: GameContext) {
  const [winnerScore, loserScore] = splitScore(context.game.vp)
  const margin = context.result === 'Win' ? winnerScore - loserScore : loserScore - winnerScore
  return margin
}

function getHighestContext(contexts: GameContext[], key: 'op' | 'vp') {
  return contexts.slice().sort((left, right) => right[key] - left[key])[0] ?? null
}

function total(values: number[]) {
  return values.reduce((sumValue, value) => sumValue + value, 0)
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10
}

function notEnoughMetric(label: string): IntelligenceMetric {
  return {
    label,
    meta: 'Needs more reported league games',
    tone: 'neutral',
    value: 'Not enough games played yet.',
  }
}

function getHighestRatedList(lists: ArmyList[]) {
  return lists.reduce<ArmyList | null>((highest, list) => {
    if (!highest || list.score > highest.score) {
      return list
    }

    return highest
  }, null)
}

function getNewestList(lists: ArmyList[]) {
  return lists.reduce<ArmyList | null>((newest, list) => {
    if (!newest) {
      return list
    }

    return new Date(list.submissionDate).getTime() >
      new Date(newest.submissionDate).getTime()
      ? list
      : newest
  }, null)
}

function getMostCommon(values: string[]) {
  const counts = new Map<string, number>()

  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? ''
}

function formatRecord(stats: ProfileStatisticsSnapshot | null) {
  if (!stats) {
    return '0-0'
  }

  if (stats.draws > 0) {
    return `${stats.wins}-${stats.losses}-${stats.draws}`
  }

  return formatRecordValue(stats.wins, stats.losses)
}

function getCompetitivePromotionStatus(
  leagueModel: PlayerLeagueModel | null,
  stats: ProfileStatisticsSnapshot | null,
) {
  const rank = leagueModel?.rank ?? stats?.rank ?? 0
  const division = leagueModel?.division ?? stats?.division ?? ''
  const population = leagueModel?.divisionPopulation ?? 0

  if (rank <= 0) {
    return 'Unranked'
  }

  if (rank === 1) {
    return '⭐ League Leader'
  }

  if (division.toLowerCase().includes('main')) {
    const relegationLine =
      population > 0 ? Math.max(7, population - 1) : 7

    return rank >= relegationLine ? 'Relegation Position' : 'Safe'
  }

  if (rank <= 2) {
    return 'Promotion Position'
  }

  if (rank === 3) {
    return '⚔ Challenge Match'
  }

  return 'Safe'
}

function formatLeaguePosition(
  leagueModel: PlayerLeagueModel | null,
  stats: ProfileStatisticsSnapshot | null,
) {
  const rank = leagueModel?.rank ?? stats?.rank ?? 0

  if (rank <= 0) {
    return 'Unranked'
  }

  const population = leagueModel?.divisionPopulation ?? 0

  return population > 0 ? `#${rank} of ${population}` : `#${rank}`
}

function formatRecentResultMark(result: GameContext['result']) {
  if (result === 'Win') {
    return 'W'
  }

  if (result === 'Loss') {
    return 'L'
  }

  if (result === 'Draw') {
    return 'D'
  }

  return '-'
}

function getGamesRemaining(stats: ProfileStatisticsSnapshot | null) {
  return Math.max(0, CURRENT_SEASON_TARGET_GAMES - (stats?.games ?? 0))
}

function formatPromotionGuidance(stats: ProfileStatisticsSnapshot | null) {
  if (!stats || stats.rank <= 0) {
    return 'Play reported league games to establish a promotion track.'
  }

  if (stats.promotionStatus.includes('Promotion')) {
    return stats.rank <= 2
      ? 'You are inside the promotion zone. Protect the position with clean wins.'
      : 'One strong result can close the promotion gap.'
  }

  if (stats.promotionStatus.includes('Relegation')) {
    return 'You are in relegation watch. Prioritize reliable missions and objective points.'
  }

  return 'You are currently stable. Build win streak pressure to move up.'
}

function getPromotionProbabilityLabel(stats: ProfileStatisticsSnapshot) {
  if (stats.promotionStatus.includes('Promotion')) {
    return stats.rank <= 2 ? 'High' : stats.rank <= 4 ? 'Medium' : 'Low'
  }

  if (stats.promotionStatus.includes('Relegation')) {
    return stats.rank >= 7 ? 'High' : 'Medium'
  }

  return stats.rank <= 3 ? 'Medium' : 'Low'
}

function getRequiredWinsForMovement(stats: ProfileStatisticsSnapshot) {
  if (stats.rank <= 0) {
    return 0
  }

  if (stats.promotionStatus.includes('Promotion')) {
    return stats.rank <= 2 ? 0 : Math.min(3, Math.max(1, stats.rank - 2))
  }

  if (stats.promotionStatus.includes('Relegation')) {
    return 2
  }

  return stats.rank <= 4 ? 1 : 2
}

function getLeagueHealth(data: MyProfileData, leagueModel: PlayerLeagueModel | null) {
  if (!leagueModel) {
    return 'League Assignment Missing'
  }

  if (!data.leagueStatistics) {
    return 'Stats Pending'
  }

  return 'League Healthy'
}

function average(total: number, count: number) {
  return count === 0 ? 0 : Math.round((total / count) * 10) / 10
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 1000) / 10
}

function sum(contexts: GameContext[], key: 'op' | 'tp' | 'vp') {
  return contexts.reduce((total, context) => total + context[key], 0)
}

export default MyProfile
