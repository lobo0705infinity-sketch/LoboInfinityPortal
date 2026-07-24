import {
  buildCapabilityNavigation,
  buildCapabilityNavigationItem,
  type EventCapability,
  type EventNavigationConfig,
  getEventNavigationConfig,
  isNavigableEventCapability,
} from '../config/eventNavigation'

const eventWorkspaceMemoryStorageKey = 'lobo-event-workspace-memory:v1'
const eventWorkspaceStyleId = 'lobo-event-workspace-transition-style'
const eventWorkspaceMessages = [
  'Loading event configuration...',
  'Preparing navigation...',
  'Loading participants...',
  'Synchronizing event data...',
  'Building workspace...',
]

let eventWorkspaceMessageTimer = 0
let eventWorkspaceCloseTimer = 0

type EventWorkspaceMemory = Record<string, {
  capability: EventCapability
  path: string
}>

function readWorkspaceMemory(): EventWorkspaceMemory {
  try {
    const rawMemory = window.sessionStorage.getItem(eventWorkspaceMemoryStorageKey)
    return rawMemory ? JSON.parse(rawMemory) as EventWorkspaceMemory : {}
  } catch {
    return {}
  }
}

function writeWorkspaceMemory(memory: EventWorkspaceMemory) {
  try {
    window.sessionStorage.setItem(eventWorkspaceMemoryStorageKey, JSON.stringify(memory))
  } catch {
    // Workspace memory is an enhancement; capability navigation remains deterministic.
  }
}

export function rememberWorkspaceRoute(
  eventId: string,
  pathname: string,
  search: string,
  hash: string,
) {
  const capability = getRouteCapability(pathname, search, hash)

  if (!eventId || !capability) {
    return
  }

  const event = getEventNavigationConfig(eventId)
  if (!event?.capabilities.includes(capability)) {
    return
  }

  writeWorkspaceMemory({
    ...readWorkspaceMemory(),
    [eventId]: {
      capability,
      path: `${pathname}${search}${hash}`,
    },
  })
}

export function resolveEventWorkspacePath(
  event: EventNavigationConfig,
  pathname: string,
  search: string,
  hash: string,
) {
  const preferredCapability = getRouteCapability(pathname, search, hash)

  if (
    preferredCapability &&
    isNavigableEventCapability(preferredCapability) &&
    event.capabilities.includes(preferredCapability)
  ) {
    return buildCapabilityNavigationItem(event, preferredCapability).to
  }

  const rememberedWorkspace = readWorkspaceMemory()[event.id]
  if (
    rememberedWorkspace &&
    isNavigableEventCapability(rememberedWorkspace.capability) &&
    event.capabilities.includes(rememberedWorkspace.capability)
  ) {
    return buildCapabilityNavigationItem(event, rememberedWorkspace.capability).to
  }

  return buildCapabilityNavigationItem(event, 'overview').to
}

export function precomputeEventNavigation(event: EventNavigationConfig) {
  buildCapabilityNavigation(event)
}

export function startEventWorkspaceTransition(event: EventNavigationConfig) {
  const overlay = ensureEventWorkspaceOverlay()
  const name = overlay.querySelector<HTMLElement>('[data-event-workspace-name]')
  const message = overlay.querySelector<HTMLElement>('.event-workspace-message')
  let messageIndex = 0

  if (name) {
    name.textContent = event.label
  }

  if (message) {
    message.textContent = eventWorkspaceMessages[0]
  }

  window.clearInterval(eventWorkspaceMessageTimer)
  window.clearTimeout(eventWorkspaceCloseTimer)
  document.documentElement.classList.add('event-workspace-switching')
  overlay.classList.add('active')
  overlay.setAttribute('aria-hidden', 'false')

  eventWorkspaceMessageTimer = window.setInterval(() => {
    messageIndex = (messageIndex + 1) % eventWorkspaceMessages.length
    if (message) {
      message.textContent = eventWorkspaceMessages[messageIndex]
    }
  }, 520)

  eventWorkspaceCloseTimer = window.setTimeout(() => {
    window.clearInterval(eventWorkspaceMessageTimer)
    overlay.classList.remove('active')
    overlay.setAttribute('aria-hidden', 'true')
    document.documentElement.classList.remove('event-workspace-switching')
  }, 560)
}

function ensureEventWorkspaceOverlay() {
  ensureEventWorkspaceStyles()
  let overlay = document.querySelector<HTMLElement>('.event-workspace-overlay')

  if (overlay) {
    return overlay
  }

  overlay = document.createElement('div')
  overlay.className = 'event-workspace-overlay'
  overlay.setAttribute('aria-live', 'polite')
  overlay.setAttribute('role', 'status')
  overlay.innerHTML = [
    '<section class="event-workspace-card">',
    '<p class="event-workspace-kicker">Switching Event</p>',
    '<h2 data-event-workspace-name>Selected Event</h2>',
    '<p class="event-workspace-status">Preparing Event Workspace...</p>',
    '<div class="event-workspace-progress" aria-hidden="true"><span></span></div>',
    `<p class="event-workspace-message">${eventWorkspaceMessages[0]}</p>`,
    '</section>',
  ].join('')
  const shell = document.querySelector('.app-shell') ?? document.body
  shell.append(overlay)

  return overlay
}

function ensureEventWorkspaceStyles() {
  if (document.getElementById(eventWorkspaceStyleId)) {
    return
  }

  const style = document.createElement('style')
  style.id = eventWorkspaceStyleId
  style.textContent = `
.app-main {
  transition: opacity 180ms ease, filter 180ms ease;
}

.event-workspace-switching .app-main {
  opacity: 0.4;
  filter: saturate(0.72);
  pointer-events: none;
}

.event-workspace-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: max(18px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(18px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition: opacity 180ms ease, transform 180ms ease;
}

.event-workspace-overlay.active {
  opacity: 1;
  transform: translateY(0);
}

.event-workspace-card {
  width: min(420px, 100%);
  border: 1px solid rgba(76, 201, 240, 0.32);
  border-radius: 18px;
  padding: 22px;
  background:
    linear-gradient(180deg, rgba(18, 27, 38, 0.96), rgba(8, 13, 19, 0.96)),
    #090e14;
  box-shadow:
    0 28px 70px rgba(0, 0, 0, 0.58),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
}

.event-workspace-kicker,
.event-workspace-status,
.event-workspace-message {
  margin: 0;
}

.event-workspace-kicker {
  color: var(--blue, #4cc9f0);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.event-workspace-card h2 {
  margin: 6px 0 8px;
  color: var(--text, #f4f8fb);
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  line-height: 1.05;
}

.event-workspace-status {
  color: var(--text-soft, #c2ccd6);
  font-weight: 850;
}

.event-workspace-progress {
  height: 10px;
  margin: 18px 0 12px;
  overflow: hidden;
  border: 1px solid rgba(76, 201, 240, 0.3);
  border-radius: 999px;
  background: rgba(5, 8, 12, 0.88);
}

.event-workspace-progress span {
  display: block;
  width: 42%;
  height: 100%;
  border-radius: inherit;
  background:
    linear-gradient(90deg, rgba(76, 201, 240, 0.16), rgba(76, 201, 240, 0.98), rgba(240, 177, 62, 0.84));
  animation: event-workspace-progress 920ms ease-in-out infinite;
}

.event-workspace-message {
  min-height: 1.3em;
  color: var(--text-muted, #8d98a6);
  font-size: 0.86rem;
  font-weight: 800;
}

@keyframes event-workspace-progress {
  0% {
    transform: translateX(-105%);
  }

  100% {
    transform: translateX(245%);
  }
}
`
  document.head.append(style)
}

function getRouteCapability(
  pathname: string,
  search: string,
  hash: string,
): EventCapability | null {
  const queryEventId = new URLSearchParams(search).get('eventId')

  if (pathname === '/match-finder' && queryEventId) return 'matchFinder'
  if (pathname === '/standings' && queryEventId) return 'standings'
  if (pathname === '/players' && queryEventId) return 'players'
  if (pathname === '/factions' && queryEventId) return 'factions'
  if (pathname === '/analytics' && queryEventId) return 'statistics'
  if (pathname === '/timeline' && queryEventId) return 'schedule'
  if (pathname === '/rules' && queryEventId) return 'rules'
  if (pathname === '/submit-game' && queryEventId) return 'submitResult'

  if (pathname.match(/^\/event\/[^/?#]+\/submit-result$/)) {
    return 'submitResult'
  }

  const tournamentSectionMatch = pathname.match(/^\/event\/[^/?#]+\/tournament\/([^/?#]+)$/)
  if (tournamentSectionMatch) {
    return getTournamentSectionCapability(tournamentSectionMatch[1])
  }

  if (pathname.match(/^\/event\/[^/?#]+\/tournament$/)) {
    if (hash.includes('pairings')) return 'pairings'
    if (hash.includes('results')) return 'results'
    if (hash.includes('standings')) return 'standings'
    if (hash.includes('register')) return 'registration'
    if (hash.includes('teams')) return 'teams'
    return 'overview'
  }

  if (pathname.match(/^\/event\/[^/?#]+$/)) {
    if (hash.includes('registration')) return 'registration'
    if (hash.includes('teams')) return 'teams'
    if (hash.includes('pairings')) return 'pairings'
    if (hash.includes('results')) return 'results'
    if (hash.includes('map')) return 'map'
    if (hash.includes('territories')) return 'territories'
    if (hash.includes('objectives')) return 'objectives'
    return 'overview'
  }

  return null
}

function getTournamentSectionCapability(section: string): EventCapability | null {
  if (section === 'pairings') return 'pairings'
  if (section === 'registration' || section === 'register') return 'registration'
  if (section === 'results') return 'results'
  if (section === 'standings') return 'standings'
  if (section === 'teams') return 'teams'

  return null
}
