type SkeletonProps = {
  label: string
  rows?: number
}

function Skeleton({ label, rows = 4 }: SkeletonProps) {
  return (
    <section className="skeleton-panel" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <span className="skeleton-line" key={index} />
      ))}
    </section>
  )
}

export default Skeleton
