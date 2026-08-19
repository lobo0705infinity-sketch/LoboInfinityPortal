import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

function CommissionerLogin() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const success = await auth.signInWithPassword(password)
      if (success) setPassword('')
    } finally { setSubmitting(false) }
  }

  return (
    <main className="portal-shell">
      <section className="panel operations-panel" aria-labelledby="commissioner-login-title">
        <p className="eyebrow">Commissioner</p>
        <h1 id="commissioner-login-title">Commissioner Sign In</h1>
        <form className="native-signin-form" onSubmit={submit}>
          <label><span>Commissioner Password</span><input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          <button disabled={submitting} type="submit">{submitting ? 'Signing In…' : 'Sign In'}</button>
        </form>
        {auth.error ? <p role="alert">{auth.error}</p> : null}
      </section>
    </main>
  )
}

export default CommissionerLogin
