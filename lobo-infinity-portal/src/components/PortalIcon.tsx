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
  analytics: [
    'M5 17.5h14',
    'M7.5 15.5v2',
    'M11.5 10v7.5',
    'M15.5 6.5v11',
    'M6.5 8.5l4 3 4.5-5 3 2.5',
  ],
  army: [
    'M5 17.5h14',
    'M7 13.5h10',
    'M8.5 7h7l2.5 6.5H6L8.5 7Z',
    'M9.5 7 12 4.5 14.5 7',
  ],
  bell: [
    'M7 16.5h10',
    'M9 16.5V10a3 3 0 0 1 6 0v6.5',
    'M10.3 19h3.4',
    'M8.2 8.8 6.5 7.2',
    'M15.8 8.8l1.7-1.6',
  ],
  compare: [
    'M7 6h10',
    'M7 18h10',
    'M8.5 6v12',
    'M15.5 6v12',
    'M10.5 10h3',
    'M10.5 14h3',
  ],
  dashboard: [
    'M5 5h6v6H5z',
    'M13 5h6v4h-6z',
    'M13 11h6v8h-6z',
    'M5 13h6v6H5z',
    'M7 8h2',
  ],
  factions: [
    'M12 4.5 19 8.5v7l-7 4-7-4v-7l7-4Z',
    'M12 8.2v7.6',
    'M8.5 10.2l7 4.1',
    'M15.5 10.2l-7 4.1',
  ],
  hall: [
    'M7 5.5h10v4.8a5 5 0 0 1-10 0V5.5Z',
    'M9.5 19h5',
    'M12 15.5V19',
    'M6 7H4.7a2.2 2.2 0 0 0 2.2 2.2',
    'M18 7h1.3a2.2 2.2 0 0 1-2.2 2.2',
  ],
  missions: [
    'M12 4.5v15',
    'M4.5 12h15',
    'M7 7l10 10',
    'M17 7 7 17',
    'M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z',
  ],
  news: [
    'M6 5h12v14H6z',
    'M8.5 9h7',
    'M8.5 12.5h7',
    'M8.5 16h4.5',
    'M15 5v14',
  ],
  players: [
    'M8.2 9a3.8 3.8 0 1 0 7.6 0 3.8 3.8 0 0 0-7.6 0Z',
    'M5 20a7 7 0 0 1 14 0',
    'M12 5.2v2.2',
    'M9.8 11.4h4.4',
  ],
  rules: [
    'M7 4.5h8.4L19 8.1v11.4H7z',
    'M15.4 4.5v4h4',
    'M9.5 11.5h6',
    'M9.5 15h6',
    'M9.5 18h3',
  ],
  search: [
    'M10.5 16.5a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z',
    'm15 15 4.5 4.5',
    'M8.2 10.5h4.6',
  ],
  standings: [
    'M5.5 18.5h13',
    'M7 14.5h10',
    'M9 10.5h6',
    'M12 4.5v6',
    'M9.5 6.5 12 4.5l2.5 2',
  ],
  streams: [
    'M5 6h14v12H5z',
    'm11 10 4-3-4-3v6Z',
    'M7.5 4.5h9',
    'M8 20h8',
  ],
  submit: [
    'M12 4.5v11',
    'M7.5 9l4.5-4.5L16.5 9',
    'M6 19.5h12',
    'M8 16.5h8',
  ],
  timeline: [
    'M7 5h10',
    'M7 12h10',
    'M7 19h10',
    'M4 5h.01',
    'M4 12h.01',
    'M4 19h.01',
    'M5 5v14',
  ],
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
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      <path
        className="portal-icon-frame"
        d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4l8-4.6Z"
        opacity="0.28"
      />
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  )
}

export default PortalIcon
