function Loading() {
  return (
    <div className="loading-indicator" aria-live="polite" role="status">
      <span aria-hidden="true" />
      <p>Synchronizing combat logs...</p>
    </div>
  )
}

export default Loading
