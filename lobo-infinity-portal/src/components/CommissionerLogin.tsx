import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getCommissionerPasswordStatus } from '../services/lightApi'

function CommissionerLogin() {
  const auth = useAuth()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    getCommissionerPasswordStatus()
      .then((value) => { if (active) setConfigured(value) })
      .catch(() => { if (active) setMessage('Unable to load Commissioner access.') })
    return () => { active = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (configured === false && password !== confirmation) {
      setMessage('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const success = configured === false
        ? await auth.createCommissionerPassword(password)
        : await auth.signInWithPassword(password)
      if (success) {
        setPassword('')
        setConfirmation('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (configured === null && !message) {
    return <main className="portal-shell"><section className="panel operations-panel"><p>Loading Commissioner access...</p></section></main>
  }

  const setup = configured === false

  return (
    <main className="portal-shell">
      <section className="panel operations-panel" aria-labelledby="commissioner-login-title">
        <p className="eyebrow">Commissioner</p>
        <h1 id="commissioner-login-title">{setup ? 'Set Up Commissioner Access' : 'Commissioner Login'}</h1>
        <form className="native-signin-form" onSubmit={submit}>
          <label>
            <span>{setup ? 'New Password' : 'Password'}</span>
            <input autoComplete={setup ? 'new-password' : 'current-password'} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          {setup ? (
            <label>
              <span>Confirm Password</span>
              <input autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
            </label>
          ) : null}
          <button disabled={submitting || configured === null} type="submit">
            {submitting ? 'Working...' : setup ? 'Create Password' : 'Sign In'}
          </button>
        </form>
        {message || auth.error ? <p role="alert">{message || auth.error}</p> : null}
      </section>
    </main>
  )
}

export default CommissionerLogin
