import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  getArmiesForParent,
  getArmyParentFaction,
  getCanonicalArmyName,
  getCanonicalParentFactionOptions,
} from '../services/armyIdentity'
import { CANONICAL_MISSIONS } from '../config/missions'
import { apiClient, type ArmyListSubmission } from '../services/api'
import type { ArmyCodeValidationReport } from '../services/api'

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
      status: 'warning'
      validation: ArmyCodeValidationReport
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
  const playerName = auth.user.canonicalPlayer || auth.user.leaguePlayer
  const [submission, setSubmission] =
    useState<ArmyListSubmission>(initialSubmission)
  const [state, setState] = useState<SubmissionState>({
    status: 'idle',
  })
  const [overrideConfirmed, setOverrideConfirmed] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const canOverrideValidation =
    auth.hasPermission('viewOperations') ||
    auth.isAtLeastRole('Assistant Commissioner')

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
        validationOverride: state.status === 'warning' && overrideConfirmed,
        validationOverrideReason: overrideReason,
      })
      setSubmission(initialSubmission)
      setOverrideConfirmed(false)
      setOverrideReason('')
      setState({
        status: 'success',
      })
    } catch (error) {
      if (isArmyCodeValidationError(error)) {
        setState({
          status: 'warning',
          validation: error.validation,
        })
        return
      }

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
    if (field === 'faction') {
      setSubmission((current) => ({
        ...current,
        faction: value,
        sectorial:
          value === getArmyParentFaction(current.sectorial)
            ? current.sectorial
            : '',
      }))
      return
    }

    if (field === 'sectorial') {
      setSubmission((current) => ({
        ...current,
        faction: getArmyParentFaction(value) || current.faction,
        sectorial: getCanonicalArmyName(value),
      }))
      return
    }

    setSubmission((current) => ({
      ...current,
      [field]: value,
    }))
    setOverrideConfirmed(false)
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
            Sign in with a Portal account to submit an army list.
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
        <SelectField
          label="Faction"
          onChange={(value) => updateField('faction', value)}
          options={getCanonicalParentFactionOptions()}
          placeholder="Select faction"
          required
          value={submission.faction}
        />
        <SelectField
          label="Army / Sectorial"
          onChange={(value) => updateField('sectorial', value)}
          options={getArmiesForParent(submission.faction)}
          placeholder="Select army"
          value={submission.sectorial}
        />
        <FormField
          label="Army Name"
          onChange={(value) => updateField('armyName', value)}
          required
          value={submission.armyName}
        />
        <SelectField
          label="Mission"
          onChange={(value) => updateField('mission', value)}
          options={CANONICAL_MISSIONS}
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
        {state.status === 'warning' ? (
          <section className="army-validation-warning army-list-form-wide" role="alert">
            <h2>Army Code {state.validation.severity}</h2>
            <ValidationSummary validation={state.validation} />
            {canOverrideValidation && !state.validation.blocking ? (
              <div className="army-validation-override">
                <label>
                  <input
                    checked={overrideConfirmed}
                    onChange={(event) => setOverrideConfirmed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Confirm commissioner override</span>
                </label>
                <label>
                  <span>Override reason</span>
                  <input
                    onChange={(event) => setOverrideReason(event.target.value)}
                    value={overrideReason}
                  />
                </label>
              </div>
            ) : (
              <p>
                {state.validation.severity === 'Error'
                  ? 'This submission is blocked for normal players. Verify or regenerate the Army Code.'
                  : 'Commissioner confirmation is required before this warning can be accepted.'}
              </p>
            )}
          </section>
        ) : null}
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
            {state.status === 'submitting'
              ? 'Submitting...'
              : state.status === 'warning' && canOverrideValidation && overrideConfirmed
                ? 'Submit With Override'
                : 'Submit Army List'}
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

function isArmyCodeValidationError(
  error: unknown,
): error is Error & { validation: ArmyCodeValidationReport } {
  return (
    error instanceof Error &&
    'validation' in error &&
    Boolean(error.validation)
  )
}

function ValidationSummary({ validation }: { validation: ArmyCodeValidationReport }) {
  return (
    <div className="army-validation-summary">
      <dl>
        <div>
          <dt>Points</dt>
          <dd>{validation.derived.points}</dd>
        </div>
        <div>
          <dt>Models</dt>
          <dd>{validation.derived.unitCount}</dd>
        </div>
        <div>
          <dt>Combat Groups</dt>
          <dd>{validation.derived.combatGroups}</dd>
        </div>
        <div>
          <dt>Sectorial</dt>
          <dd>{validation.derived.sectorial || 'Unknown'}</dd>
        </div>
      </dl>
      <ul>
        {validation.issues
          .filter((issue) => issue.severity !== 'Info')
          .map((issue) => (
          <li key={`${issue.severity}:${issue.code}`}>
            <strong>{issue.severity}:</strong> {issue.message}
          </li>
        ))}
      </ul>
    </div>
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

function SelectField({
  label,
  onChange,
  options,
  placeholder = 'Select mission',
  required = false,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  required?: boolean
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export default SubmitArmyList
