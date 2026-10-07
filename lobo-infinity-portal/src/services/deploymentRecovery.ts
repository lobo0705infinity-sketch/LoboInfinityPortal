const recoveryKey = 'lobo:deployment-recovery-at'
const recoveryWindowMs = 60_000

/** Recover once when an open tab requests a chunk replaced by a deployment. */
export function initializeDeploymentRecovery() {
  window.addEventListener('vite:preloadError', event => {
    try {
      const previous = Number(sessionStorage.getItem(recoveryKey) || 0)
      const now = Date.now()
      if (now - previous < recoveryWindowMs) return
      sessionStorage.setItem(recoveryKey, String(now))
      event.preventDefault()
      window.location.reload()
    } catch {
      // Keep the normal error boundary available if browser storage is blocked.
    }
  })
}
