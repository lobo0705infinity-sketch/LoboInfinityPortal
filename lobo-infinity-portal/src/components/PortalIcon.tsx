export type PortalIconName =
  | 'analytics'
  | 'army'
  | 'bell'
  | 'compare'
  | 'dashboard'
  | 'factions'
  | 'hall'
  | 'missions'
  | 'news'
  | 'players'
  | 'rules'
  | 'search'
  | 'standings'
  | 'streams'
  | 'submit'
  | 'timeline'

const paths: Record<PortalIconName, string[]> = {
  analytics: ['M5 18h14', 'M7 15v3', 'M11 10v8', 'M15 6v12'],
  army: ['M5 17h14', 'M7 13h10', 'M8 7h8l2 6H6l2-6Z'],
  bell: ['M7 17h10', 'M9 17V9a3 3 0 0 1 6 0v8', 'M10 20h4'],
  compare: ['M7 6h10', 'M7 18h10', 'M8 6v12', 'M16 6v12'],
  dashboard: ['M5 5h6v6H5z', 'M13 5h6v4h-6z', 'M13 11h6v8h-6z', 'M5 13h6v6H5z'],
  factions: ['M12 4 19 8v8l-7 4-7-4V8l7-4Z', 'M12 8v8', 'M8 10l8 4'],
  hall: ['M7 5h10v5a5 5 0 0 1-10 0V5Z', 'M9 19h6', 'M12 15v4'],
  missions: ['M12 4v16', 'M4 12h16', 'M7 7l10 10', 'M17 7 7 17'],
  news: ['M6 5h12v14H6z', 'M8 9h8', 'M8 13h8', 'M8 17h5'],
  players: ['M8 9a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z', 'M5 20a7 7 0 0 1 14 0'],
  rules: ['M7 4h9l3 3v13H7z', 'M16 4v4h4', 'M9 11h7', 'M9 15h7'],
  search: ['M10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z', 'm15 15 5 5'],
  standings: ['M6 18h12', 'M8 14h8', 'M10 10h4', 'M12 4v6'],
  streams: ['M5 6h14v12H5z', 'm11 10 4-3-4-3v6Z'],
  submit: ['M12 4v12', 'M7 9l5-5 5 5', 'M6 20h12'],
  timeline: ['M7 5h10', 'M7 12h10', 'M7 19h10', 'M4 5h.01', 'M4 12h.01', 'M4 19h.01'],
}

function PortalIcon({ name }: { name: PortalIconName }) {
  return (
    <svg
      aria-hidden="true"
      className="portal-icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  )
}

export default PortalIcon
