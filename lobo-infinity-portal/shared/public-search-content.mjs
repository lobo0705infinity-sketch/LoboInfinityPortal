import { selectFeaturedReport } from './featured-report.mjs'
import { LOBO_WORKSHOP_URL, loboWorkshopMapBySlug, loboWorkshopMaps } from './lobo-workshop-maps.mjs'

export const SITE_ORIGIN = 'https://lobo-infinity-portal.vercel.app'

const starterLinks = [
  { label: 'Explore Army Intelligence', href: '/army-intelligence' },
  { label: 'Read battle reports', href: '/games' },
  { label: 'Explore TTS maps', href: '/maps' },
  { label: 'Join a game or event', href: '/events' },
]

const publicPages = {
  '/': {
    title: 'Infinity N5 Army Intelligence & Battle Reports | Lobo Infinity Portal',
    description: 'Explore Infinity N5 faction intelligence, community battle reports, and upcoming games and events at the Lobo Infinity Portal.',
    heading: 'Lobo Infinity Portal',
    intro: 'Explore Infinity N5 army intelligence, read community battle reports, and find a game or event. You can browse public results without joining the league.',
    links: starterLinks,
  },
  '/explore': {
    title: 'Explore Infinity N5 Armies and Games | Lobo Infinity Portal',
    description: 'Find a starting point for Infinity N5 faction intelligence, battle reports, mission results, and Lobo community events.',
    heading: 'Explore the portal',
    intro: 'Choose a faction to study, follow a battle report, or find an event to play.',
    links: starterLinks,
  },
  '/little-helper': {
    title: "Lobo's Little Helper | Infinity N5 Discord Bot Commands",
    description: 'See how Lobo’s Little Helper turns Infinity Army codes into tactical briefs, compares exact profiles, and finds ARO counters in Discord.',
    heading: "Lobo's Little Helper: Infinity N5 Discord tools",
    intro: 'Explore /inf-list, /matchup, and /aro-counter with response previews and simple steps to try the bot in the Lobo Infinity League Discord.',
    image: '/assets/little-helper-share.png',
    imageAlt: "Lobo's Little Helper: Infinity N5 army list, matchup, and ARO counter tools",
    links: [
      { label: 'Explore Army Intelligence', href: '/army-intelligence' },
      { label: 'Read battle reports', href: '/games' },
      { label: 'Explore the portal', href: '/explore' },
    ],
  },
  '/army-intelligence': {
    title: 'Infinity N5 Army Intelligence: Gunfighters, ARO & Factions | Lobo Portal',
    description: 'Compare Infinity N5 faction gunfighters, ARO pieces, close combat specialists, hacking networks, and control tools in Army Intelligence.',
    heading: 'Army Intelligence',
    intro: 'Start with Corregidor to explore gunfighters, ARO defenders, close combat specialists, hacking, and control tools. Compare what submitted armies can bring to a game.',
    links: [
      { label: 'Explore Corregidor', href: '/factions/Corregidor%20Jurisdictional%20Command' },
      { label: "Read a Corregidor battle report: Dead Man's Switch", href: '/games/109' },
      { label: 'Browse all factions', href: '/factions' },
      { label: 'Read battle reports', href: '/games' },
    ],
  },
  '/games': {
    title: 'Infinity N5 Battle Reports and Match Results | Lobo Infinity Portal',
    description: 'Read recorded Infinity N5 games with missions, faction matchups, results, player highlights, and battle reports.',
    heading: 'Infinity N5 battle reports',
    intro: 'Browse played games by mission and matchup, then open a report for the result and its submitted highlight.',
    links: [{ label: 'Explore Army Intelligence', href: '/army-intelligence' }],
  },
  '/maps': {
    title: 'Infinity N5 TTS Map Library: 47 Lobo Workshop Tables | Lobo Portal',
    description: 'Explore 47 Infinity Tabletop Simulator maps from Lobo’s Workshop with original overhead and angled captures, source links, and deployment checks.',
    heading: 'Lobo Workshop TTS map library',
    intro: 'Browse 47 real TTS table previews. Each map has an overhead layout and an angled terrain view, with a link to the Lobo Workshop collection.',
    image: loboWorkshopMaps[46].angled,
    imageAlt: `Angled preview of ${loboWorkshopMaps[46].name} in Tabletop Simulator`,
    imageWidth: 1600,
    imageHeight: 900,
    links: [{ label: 'Read battle reports', href: '/games' }],
  },
  '/events': {
    title: 'Infinity N5 Games and Events | Lobo Infinity Portal',
    description: 'Find Infinity N5 league games, tournaments, event results, and ways to connect with players through the Lobo Infinity Portal.',
    heading: 'Games and events',
    intro: 'Find an event, read its standings and results, or connect with other players for a casual game.',
    links: [{ label: 'Read battle reports', href: '/games' }],
  },
  '/factions': {
    title: 'Infinity N5 Faction Results and Performance | Lobo Infinity Portal',
    description: 'Browse Infinity N5 factions, recorded match results, faction performance, missions, and related battle reports.',
    heading: 'Infinity N5 factions',
    intro: 'Choose a faction to see its recorded games, missions, player results, and battle reports.',
    links: [{ label: 'Explore Army Intelligence', href: '/army-intelligence' }],
  },
  '/missions': {
    title: 'Infinity N5 Mission Results and Analysis | Lobo Infinity Portal',
    description: 'Explore Infinity N5 missions played in the Lobo community, with match results and related battle reports.',
    heading: 'Infinity N5 missions',
    intro: 'Explore missions played by the community and follow the games behind each result.',
    links: [{ label: 'Read battle reports', href: '/games' }],
  },
  '/players': {
    title: 'Infinity N5 Players and Records | Lobo Infinity Portal',
    description: 'Explore public Lobo Infinity player profiles, faction choices, standings, and recorded games.',
    heading: 'Players', intro: 'See player profiles and follow their recorded matches.',
    links: [{ label: 'See standings', href: '/standings' }, { label: 'Browse games', href: '/games' }],
  },
  '/streams': {
    title: 'Infinity N5 Streams | Lobo Infinity Portal',
    description: 'Find community streams and recorded Infinity N5 games from the Lobo Infinity Portal.',
    heading: 'Streams', intro: 'Find community streams and follow the games being played.',
    links: [{ label: 'Read battle reports', href: '/games' }],
  },
  '/army-lists': {
    title: 'Infinity N5 Army Lists | Lobo Infinity Portal',
    description: 'Browse public Infinity N5 army lists connected to community games and battle reports.',
    heading: 'Army lists', intro: 'Explore public army lists and the games they were used in.',
    links: [{ label: 'Explore Army Intelligence', href: '/army-intelligence' }],
  },
  '/analytics': {
    title: 'Infinity N5 League Analytics | Lobo Infinity Portal',
    description: 'Explore public Infinity N5 match statistics, faction trends, and league records.',
    heading: 'League analytics', intro: 'Explore recorded game statistics and trends across the portal.',
    links: [{ label: 'Browse factions', href: '/factions' }],
  },
  '/compare': {
    title: 'Compare Infinity N5 Players | Lobo Infinity Portal',
    description: 'Compare Lobo Infinity player records and head-to-head results from public games.',
    heading: 'Compare players', intro: 'Compare players using their recorded league results.',
    links: [{ label: 'Browse players', href: '/players' }],
  },
  '/standings': {
    title: 'Infinity N5 League Standings | Lobo Infinity Portal',
    description: 'See current Lobo Infinity standings, divisions, match points, and player results.',
    heading: 'League standings', intro: 'See divisions, player records, and standings from league games.',
    links: [{ label: 'Read battle reports', href: '/games' }],
  },
  '/schedule': {
    title: 'Infinity N5 League Schedule | Lobo Infinity Portal',
    description: 'Find the current Lobo Infinity league schedule, missions, and upcoming games.',
    heading: 'League schedule', intro: 'Find the current league schedule and missions.',
    links: [{ label: 'Browse events', href: '/events' }],
  },
  '/league-operations': {
    title: 'Infinity N5 League Operations | Lobo Infinity Portal',
    description: 'Explore public Lobo Infinity league information, game schedules, and results.',
    heading: 'League operations', intro: 'Follow the public league program and its recorded results.',
    links: [{ label: 'Browse events', href: '/events' }],
  },
  '/community': {
    title: 'Infinity N5 Community | Lobo Infinity Portal',
    description: 'Connect with Infinity N5 players and explore Lobo community news, streams, and events.',
    heading: 'Infinity community', intro: 'Find players, news, streams, and community events.',
    links: [{ label: 'Browse events', href: '/events' }],
  },
  '/rules': {
    title: 'Infinity N5 Rules and Resources | Lobo Infinity Portal',
    description: 'Find Infinity N5 rules resources and links to play, missions, and community reports.',
    heading: 'Rules and resources', intro: 'Find rules resources for games and missions.',
    links: [{ label: 'Browse missions', href: '/missions' }],
  },
}

export function publicDatasetForPath(pathname) {
  if (pathname === '/') return 'games'
  if (/^\/games\/\d+$/.test(pathname) || pathname === '/games') return 'games'
  if (/^\/event\/[a-zA-Z0-9_-]+$/.test(pathname) || pathname === '/events') return 'events'
  if (pathname.startsWith('/factions/') || pathname === '/factions') return 'factions'
  if (pathname.startsWith('/missions/') || pathname === '/missions') return 'missions'
  return null
}

export function describePublicSearchPage(pathname, datasets = {}) {
  const staticPage = publicPages[pathname]
  if (staticPage) {
    const links = [...staticPage.links]
    if (pathname === '/' && datasets.games) {
      const featured = selectFeaturedReport(datasets.games, datasets.pinnedId)
      if (featured) {
        links.push(
          { label: `Featured battle report: ${featured.mission} — ${featured.player1Faction} vs ${featured.player2Faction}`, href: `/games/${featured.id}` },
          { label: `Explore ${featured.mission} mission results`, href: `/missions/${encodeURIComponent(featured.mission)}` },
          { label: `Explore ${featured.player1Faction} faction results`, href: `/factions/${encodeURIComponent(featured.player1Faction)}` },
          { label: `Explore ${featured.player2Faction} faction results`, href: `/factions/${encodeURIComponent(featured.player2Faction)}` },
        )
      }
    }
    if (pathname === '/games' && datasets.games) {
      for (const game of [...datasets.games].slice(-12).reverse()) {
        if (Number.isSafeInteger(Number(game.id))) {
          links.push({ label: `${text(game.mission)}: ${text(game.player1Faction)} vs ${text(game.player2Faction)} · Report #${game.id}`, href: `/games/${game.id}` })
        }
      }
    }
    if (pathname === '/maps') {
      for (const map of loboWorkshopMaps) {
        links.push({ label: `${map.name} · ${map.family}`, href: `/maps/${map.slug}` })
      }
    }
    if (pathname === '/events' && datasets.events) {
      for (const event of datasets.events) links.push({ label: `${text(event.name)} · ${text(event.status || event.lifecycleStage)}`, href: `/event/${encodeURIComponent(event.id)}` })
    }
    if (pathname === '/factions' && datasets.factions) {
      for (const faction of datasets.factions) links.push({ label: `${text(faction.name)} · ${Number(faction.games) || 0} recorded games`, href: `/factions/${encodeURIComponent(faction.name)}` })
    }
    if (pathname === '/missions' && datasets.missions) {
      for (const mission of datasets.missions) links.push({ label: `${text(mission.mission)} · ${Number(mission.games) || 0} recorded games`, href: `/missions/${encodeURIComponent(mission.mission)}` })
    }
    return { ...staticPage, pathname, canonicalPath: pathname, links }
  }

  const mapSlug = /^\/maps\/([a-z0-9-]+)$/.exec(pathname)?.[1]
  if (mapSlug) {
    const map = loboWorkshopMapBySlug.get(mapSlug)
    if (!map) return null
    return {
      pathname,
      canonicalPath: `/maps/${map.slug}`,
      title: `${map.name} TTS Map: Overhead & Terrain Views | Lobo Portal`,
      description: shorten(`Explore ${map.name} from Lobo’s Infinity Maps Workshop collection. View original overhead and angled TTS captures and check the table before deployment.`, 170),
      heading: map.name,
      intro: `${map.family} in Lobo’s Infinity Maps Workshop collection. Compare the overhead layout with the angled terrain view before deploying.${map.sourceNote ? ` Workshop note: ${map.sourceNote}` : ''}`,
      image: map.angled,
      imageAlt: `Angled Tabletop Simulator preview of ${map.name}`,
      imageWidth: 1600,
      imageHeight: 900,
      links: [
        { label: 'All TTS maps', href: '/maps' },
        { label: 'Browse battle reports', href: '/games' },
        { label: 'Lobo’s Infinity Maps Workshop collection', href: LOBO_WORKSHOP_URL },
      ],
    }
  }

  const gameId = /^\/games\/(\d+)$/.exec(pathname)?.[1]
  if (gameId) {
    const game = datasets.games?.find(item => String(item.id) === gameId)
    if (datasets.games && !game) return null
    if (!game) return genericDetail(pathname, `Battle report #${gameId}`, 'Read this Infinity N5 game result and battle report.', '/games')
    const mission = text(game.mission, 'Infinity N5 match')
    const faction1 = text(game.player1Faction, 'Faction one')
    const faction2 = text(game.player2Faction, 'Faction two')
    const result = game.winnerFaction && game.tp ? `${text(game.winnerFaction)} won ${text(game.tp)} tournament points.` : ''
    const highlight = text(game.bestMoment)
    return {
      pathname,
      canonicalPath: `/games/${gameId}`,
      title: `${mission}: ${faction1} vs ${faction2} | Infinity N5 Battle Report`,
      description: shorten(`Read Infinity N5 battle report #${gameId}: ${faction1} vs ${faction2} on ${mission}. ${result}`, 170),
      heading: `${mission}: ${faction1} vs ${faction2}`,
      image: `/api/report-preview?id=${gameId}`,
      imageAlt: `Battle report #${gameId}: ${faction1} vs ${faction2} on ${mission}`,
      intro: `Battle report #${gameId}. ${result}${highlight ? ` Submitted highlight: ${shorten(highlight, 230)}` : ''}`,
      links: [
        ...(text(game.mission) ? [{ label: `Explore ${mission} mission results`, href: `/missions/${encodeURIComponent(mission)}` }] : []),
        { label: `${faction1} faction profile`, href: `/factions/${encodeURIComponent(faction1)}` },
        { label: `${faction2} faction profile`, href: `/factions/${encodeURIComponent(faction2)}` },
        { label: 'All battle reports', href: '/games' },
      ],
    }
  }

  const factionName = detailName(pathname, 'factions')
  if (factionName) {
    const faction = datasets.factions?.find(item => item.name === factionName)
    if (datasets.factions && !faction) return null
    const games = Number(faction?.games) || 0
    return {
      pathname,
      canonicalPath: `/factions/${encodeURIComponent(factionName)}`,
      title: `${factionName} Results & Battle Reports | Infinity N5 Factions`,
      description: shorten(`${factionName} in Infinity N5: ${games ? `${games} recorded games, ${Number(faction.wins) || 0} wins. ` : ''}Explore mission results, player performance, and battle reports.`, 170),
      heading: factionName,
      intro: `${factionName} faction profile.${games ? ` ${games} recorded games and ${Number(faction.wins) || 0} wins.` : ''} Explore match results, missions, and players.`,
      links: [
        ...((faction?.recentGames || []).slice(0, 8).map(item => ({ label: `Read battle report #${item.id}`, href: `/games/${item.id}` }))),
        { label: 'All factions', href: '/factions' },
        { label: 'Army Intelligence', href: '/army-intelligence' },
      ],
    }
  }

  const missionName = detailName(pathname, 'missions')
  if (missionName) {
    const mission = datasets.missions?.find(item => item.mission === missionName)
    if (datasets.missions && !mission) return null
    const games = Number(mission?.games) || 0
    return {
      pathname,
      canonicalPath: `/missions/${encodeURIComponent(missionName)}`,
      title: `${missionName} Mission Results | Infinity N5 Battle Reports`,
      description: shorten(`Explore ${missionName} in Infinity N5, with ${games ? `${games} recorded games, ` : ''}faction results, and related battle reports.`, 170),
      heading: missionName,
      intro: `Explore ${missionName} mission results and ${games ? `${games} recorded games` : 'related battle reports'}.`,
      links: [
        ...((mission?.recentGames || []).slice(0, 8).map(item => ({ label: `Read battle report #${item.id}`, href: `/games/${item.id}` }))),
        { label: 'All missions', href: '/missions' },
      ],
    }
  }

  const eventId = /^\/event\/([a-zA-Z0-9_-]+)$/.exec(pathname)?.[1]
  if (eventId) {
    const event = datasets.events?.find(item => item.id === eventId)
    if (datasets.events && !event) return null
    if (!event) return genericDetail(pathname, 'Infinity N5 event', 'See event details, standings, and games.', '/events')
    const name = text(event.name)
    const status = text(event.status || event.lifecycleStage)
    return {
      pathname,
      canonicalPath: `/event/${encodeURIComponent(eventId)}`,
      title: `${name} | Infinity N5 Events at Lobo Infinity Portal`,
      description: shorten(`Explore ${name}${status ? ` (${status})` : ''}: event details, schedule, standings, and ${Number(event.completedGames) || 0} recorded games.`, 170),
      heading: name,
      intro: `${name}${status ? ` · ${status}` : ''}. See event details, standings, and recorded games.`,
      links: [{ label: 'All events', href: '/events' }, { label: 'Read battle reports', href: '/games' }],
    }
  }

  return null
}

function genericDetail(pathname, heading, intro, listing) {
  return { pathname, canonicalPath: pathname, title: `${heading} | Lobo Infinity Portal`, description: intro, heading, intro, links: [{ label: 'Browse all', href: listing }] }
}

function detailName(pathname, prefix) {
  const match = new RegExp(`^/${prefix}/([^/]+)$`).exec(pathname)
  if (!match) return null
  try { return decodeURIComponent(match[1]) } catch { return null }
}

function text(value, fallback = '') {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim()
}

function shorten(value, limit) {
  const clean = text(value)
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`
}
