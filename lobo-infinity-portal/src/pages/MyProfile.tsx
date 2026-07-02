import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import { apiClient, type MyProfileData } from '../services/api'

type ProfileState =
  | {
      status: 'loading'
    }
  | {
      data: MyProfileData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function MyProfile() {
  const auth = useAuth()
  const [state, setState] = useState<ProfileState>({ status: 'loading' })
  const [favoriteFaction, setFavoriteFaction] = useState('')
  const [themePreference, setThemePreference] = useState('system')

  async function loadProfile(signal?: AbortSignal) {
    try {
      const data = await apiClient.getMyProfile({ signal })
      setFavoriteFaction(data.user.favoriteFaction)
      setThemePreference(data.user.themePreference)
      setState({ data, status: 'success' })
    } catch (error) {
      if (!signal?.aborted) {
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

  useEffect(() => {
    if (!auth.authenticated) {
      return
    }

    const controller = new AbortController()
    void Promise.resolve().then(() => loadProfile(controller.signal))

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
            Sign in with an enabled league account to view your profile.
          </p>
        </section>
      </main>
    )
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = await apiClient.updateProfile({
      favoriteFaction,
      themePreference,
    })
    setState({ data, status: 'success' })
    await auth.refreshSession()
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <ProfileHeader />
        <section className="dashboard-state" aria-label="Profile loading">
          <Loading />
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

  const { data } = state

  return (
    <main className="portal-shell">
      <ProfileHeader />

      <section className="profile-hero-focus member-profile-hero">
        <div>
          <p className="eyebrow">Authenticated League Identity</p>
          <h1>{data.user.displayName}</h1>
          <div className="profile-badges">
            <span>{data.user.role}</span>
            <span>{data.user.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <p>{data.user.email}</p>
        </div>
        <div className="member-avatar-card">
          {data.user.avatarUrl ? (
            <img alt="" src={data.user.avatarUrl} />
          ) : (
            <strong>{data.user.displayName.slice(0, 1).toUpperCase()}</strong>
          )}
        </div>
      </section>

      <section className="profile-card-grid">
        <article className="panel profile-card">
          <div className="panel-heading">
            <p className="eyebrow">Preferences</p>
            <h2>Member Settings</h2>
          </div>
          <form className="member-profile-form" onSubmit={saveProfile}>
            <label>
              <span>Favorite Faction</span>
              <input
                onChange={(event) => setFavoriteFaction(event.target.value)}
                value={favoriteFaction}
              />
            </label>
            <label>
              <span>Theme Preference</span>
              <select
                onChange={(event) => setThemePreference(event.target.value)}
                value={themePreference}
              >
                <option value="system">System</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <button type="submit">Save Profile</button>
          </form>
        </article>

        <MetricCard
          title="League Statistics"
          values={[
            ['Games', data.leagueStatistics?.games ?? 0],
            ['Wins', data.leagueStatistics?.wins ?? 0],
            ['TP', data.leagueStatistics?.tp ?? 0],
            ['OP', data.leagueStatistics?.op ?? 0],
            ['VP', data.leagueStatistics?.vp ?? 0],
          ]}
        />

        <MetricCard
          title="Member Activity"
          values={[
            ['Submitted Lists', data.submittedLists.length],
            ['Votes Cast', data.votesCast],
            ['Read Alerts', data.user.readAlerts.length],
            ['Dismissed Alerts', data.user.dismissedAlerts.length],
          ]}
        />
      </section>

      <section className="profile-card-grid">
        <article className="panel profile-card">
          <div className="panel-heading">
            <p className="eyebrow">Army Lists</p>
            <h2>Submitted Lists</h2>
          </div>
          <div className="army-list-mini-grid">
            {data.submittedLists.length > 0 ? (
              data.submittedLists.slice(0, 6).map((list) => (
                <article className="army-list-mini-card" key={list.id}>
                  <span>{list.faction}</span>
                  <h3>{list.armyName}</h3>
                  <p>{list.description || 'No description submitted.'}</p>
                </article>
              ))
            ) : (
              <p className="operations-empty">No submitted army lists yet.</p>
            )}
          </div>
        </article>

        <article className="panel profile-card">
          <div className="panel-heading">
            <p className="eyebrow">Activity</p>
            <h2>Recent Activity</h2>
          </div>
          <div className="operations-stack">
            {data.recentActivity.length > 0 ? (
              data.recentActivity.map((item) => (
                <Link className="operations-record" key={item.id} to={item.link || '/timeline'}>
                  <span>{item.type}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </Link>
              ))
            ) : (
              <p className="operations-empty">No recent activity matched yet.</p>
            )}
          </div>
        </article>
      </section>
    </main>
  )
}

function ProfileHeader() {
  return (
    <section className="page-header" aria-labelledby="my-profile-title">
      <p className="eyebrow">My Profile</p>
      <h1 id="my-profile-title">League Member Profile</h1>
      <p>Identity, preferences, notifications, army lists, and league activity.</p>
    </section>
  )
}

function MetricCard({
  title,
  values,
}: {
  title: string
  values: Array<[string, number | string]>
}) {
  return (
    <article className="panel profile-card">
      <div className="panel-heading">
        <p className="eyebrow">Snapshot</p>
        <h2>{title}</h2>
      </div>
      <dl className="operations-metrics">
        {values.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export default MyProfile
