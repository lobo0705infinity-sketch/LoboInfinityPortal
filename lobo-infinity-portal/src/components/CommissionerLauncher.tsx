import { Link } from 'react-router-dom'

export type CommissionerLauncherCard = {
  description: string
  title: string
  to: string
}

type CommissionerLauncherProps = {
  cards: CommissionerLauncherCard[]
  description: string
  eyebrow?: string
  title: string
}

function CommissionerLauncher({
  cards,
  description,
  eyebrow = 'Commissioner',
  title,
}: CommissionerLauncherProps) {
  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="commissioner-launcher-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="commissioner-launcher-title">{title}</h1>
        <p>{description}</p>
      </section>

      <section className="operations-grid" aria-label={`${title} tools`}>
        {cards.map((card) => (
          <Link className="panel operations-panel" key={card.title} to={card.to}>
            <p className="eyebrow">Commissioner Tool</p>
            <h2>{card.title}</h2>
            <p className="operations-empty">{card.description}</p>
          </Link>
        ))}
      </section>
    </main>
  )
}

export default CommissionerLauncher
