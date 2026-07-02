type StatCardProps = {
  icon: string
  label: string
  subtitle: string
  value: number | string
}

function StatCard({ icon, label, subtitle, value }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="stat-card-label">{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{subtitle}</p>
    </article>
  )
}

export default StatCard
