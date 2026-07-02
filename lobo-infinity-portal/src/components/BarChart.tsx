import { Link } from 'react-router-dom'

export type BarChartPoint = {
  label: string
  meta?: string
  to?: string
  value: number
}

type BarChartProps = {
  points: BarChartPoint[]
  title: string
}

function BarChart({ points, title }: BarChartProps) {
  const maxValue = Math.max(...points.map((point) => point.value), 1)

  return (
    <div className="bar-chart" aria-label={title}>
      {points.map((point) => {
        const width = `${Math.max((point.value / maxValue) * 100, 4)}%`
        const content = (
          <>
            <div className="bar-chart-row-heading">
              <strong>{point.label}</strong>
              <span>{point.value}</span>
            </div>
            <span className="bar-chart-track">
              <span className="bar-chart-fill" style={{ width }} />
            </span>
            {point.meta ? <small>{point.meta}</small> : null}
          </>
        )

        return point.to ? (
          <Link className="bar-chart-row" key={point.label} to={point.to}>
            {content}
          </Link>
        ) : (
          <div className="bar-chart-row" key={point.label}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

export default BarChart
