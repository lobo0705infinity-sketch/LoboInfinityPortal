import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiClient, type ArmyListSubmission } from '../services/api'

type SubmissionState =
  | {
      status: 'idle'
    }
  | {
      status: 'submitting'
    }
  | {
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

const initialSubmission: ArmyListSubmission = {
  player: '',
  faction: '',
  sectorial: '',
  mission: '',
  event: '',
  armyCode: '',
  armyLink: '',
  armyName: '',
  description: '',
}

function SubmitArmyList() {
  const auth = useAuth()
  const playerName = auth.user.leaguePlayer
  const [submission, setSubmission] =
    useState<ArmyListSubmission>(initialSubmission)
  const [state, setState] = useState<SubmissionState>({
    status: 'idle',
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({
      status: 'submitting',
    })

    try {
      await apiClient.submitArmyList({
        ...submission,
        player: submission.player.trim() || playerName,
        submitterEmail: auth.user.email,
      })
      setSubmission(initialSubmission)
      setState({
        status: 'success',
      })
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : 'Army list could not be submitted.',
        status: 'error',
      })
    }
  }

  function updateField(field: keyof ArmyListSubmission, value: string) {
    setSubmission((current) => ({
      ...current,
      [field]: value,
    }))
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="submit-army-list-title">
        <p className="eyebrow">Community</p>
        <h1 id="submit-army-list-title">Submit Army List</h1>
        <p>Share a league-ready list with the vault for organizer approval.</p>
        <Link className="submit-match-button" to="/army-lists">
          Back to Army List Vault
        </Link>
      </section>

      {!auth.authenticated ? (
        <section className="dashboard-state" aria-label="Authentication required">
          <p role="alert">
            Sign in with an enabled league account to submit an army list.
          </p>
        </section>
      ) : null}

      <form className="army-list-form panel" onSubmit={(event) => void handleSubmit(event)}>
        <FormField
          label="Player"
          onChange={(value) => updateField('player', value)}
          required
          value={submission.player || playerName}
        />
        <FormField
          label="Google Email"
          onChange={() => undefined}
          type="email"
          value={auth.user.email}
        />
        <FormField
          label="Faction"
          onChange={(value) => updateField('faction', value)}
          required
          value={submission.faction}
        />
        <FormField
          label="Sectorial"
          onChange={(value) => updateField('sectorial', value)}
          value={submission.sectorial}
        />
        <FormField
          label="Army Name"
          onChange={(value) => updateField('armyName', value)}
          required
          value={submission.armyName}
        />
        <FormField
          label="Mission"
          onChange={(value) => updateField('mission', value)}
          value={submission.mission}
        />
        <FormField
          label="Tournament/Event"
          onChange={(value) => updateField('event', value)}
          value={submission.event}
        />
        <FormField
          label="Infinity Army Link"
          onChange={(value) => updateField('armyLink', value)}
          type="url"
          value={submission.armyLink}
        />
        <label className="army-list-form-wide">
          <span>Infinity Army Code</span>
          <textarea
            onChange={(event) => updateField('armyCode', event.target.value)}
            rows={4}
            value={submission.armyCode}
          />
        </label>
        <label className="army-list-form-wide">
          <span>Description</span>
          <textarea
            onChange={(event) => updateField('description', event.target.value)}
            rows={5}
            value={submission.description}
          />
        </label>

        <div className="army-list-form-actions">
          <button
            disabled={state.status === 'submitting' || !auth.authenticated}
            type="submit"
          >
            {state.status === 'submitting' ? 'Submitting...' : 'Submit Army List'}
          </button>
          {state.status === 'success' ? (
            <p role="status">
              Army list submitted. It will appear in the vault once approved.
            </p>
          ) : null}
          {state.status === 'error' ? <p role="alert">{state.error}</p> : null}
        </div>
      </form>
    </main>
  )
}

function FormField({
  label,
  onChange,
  required = false,
  type = 'text',
  value,
}: {
  label: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  )
}

export default SubmitArmyList
