import { buildInfo } from './buildInfo'
import type { DivisionKey, Standing } from '../types/dashboard'

const STORAGE_KEY = 'lobo:standings-render-diagnostics'

type StandingSummary = {
  games: number
  losses: number
  op: number
  player: string
  rank: number
  tp: number
  vp: number
  wins: number
}

type RenderedRowSummary = {
  cellCount: number
  cells: string[]
  className: string
  html: string
  index: number
  text: string
}

export type StandingsRenderDiagnostics = {
  api: {
    length: number
    standings0: StandingSummary | null
    standings1: StandingSummary | null
  }
  assets: {
    scripts: string[]
    stylesheets: string[]
  }
  build: typeof buildInfo
  component: {
    standings: string
    standingsTable: string
  }
  division: DivisionKey
  reactState: {
    length: number
    standings0: StandingSummary | null
    standings1: StandingSummary | null
  }
  renderedDom: {
    rowCount: number
    row0: RenderedRowSummary | null
    row1: RenderedRowSummary | null
    rows: RenderedRowSummary[]
  }
  tableProps: {
    length: number
    standings0: StandingSummary | null
    standings1: StandingSummary | null
  }
  timestamp: string
}

type SnapshotInput = {
  apiStandings?: Standing[]
  division: DivisionKey
  reactStateStandings?: Standing[]
  tablePropsStandings?: Standing[]
}

declare global {
  interface Window {
    __LOBO_STANDINGS_DIAGNOSTICS__?: StandingsRenderDiagnostics
  }
}

export function publishStandingsDiagnostics(input: SnapshotInput) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const previous = readStoredStandingsDiagnostics()
  const apiStandings = input.apiStandings
  const reactStateStandings = input.reactStateStandings
  const tablePropsStandings = input.tablePropsStandings

  const snapshot: StandingsRenderDiagnostics = {
    api: apiStandings ? summarizeStandings(apiStandings) : previous?.api ?? emptyStage(),
    assets: collectAssetIdentity(),
    build: buildInfo,
    component: {
      standings: 'src/pages/Standings.tsx',
      standingsTable: 'src/components/StandingsTable.tsx',
    },
    division: input.division,
    reactState: reactStateStandings
      ? summarizeStandings(reactStateStandings)
      : previous?.reactState ?? emptyStage(),
    renderedDom: collectRenderedRows(),
    tableProps: tablePropsStandings
      ? summarizeStandings(tablePropsStandings)
      : previous?.tableProps ?? emptyStage(),
    timestamp: new Date().toISOString(),
  }

  window.__LOBO_STANDINGS_DIAGNOSTICS__ = snapshot

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Diagnostics should never interfere with standings rendering.
  }
}

export function getStoredStandingsDiagnostics() {
  if (typeof window === 'undefined') {
    return null
  }

  if (window.__LOBO_STANDINGS_DIAGNOSTICS__) {
    return window.__LOBO_STANDINGS_DIAGNOSTICS__
  }

  return readStoredStandingsDiagnostics()
}

function readStoredStandingsDiagnostics() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StandingsRenderDiagnostics) : null
  } catch {
    return null
  }
}

function emptyStage() {
  return {
    length: 0,
    standings0: null,
    standings1: null,
  }
}

function summarizeStandings(standings: Standing[]) {
  return {
    length: standings.length,
    standings0: summarizeStanding(standings[0]),
    standings1: summarizeStanding(standings[1]),
  }
}

function summarizeStanding(standing: Standing | undefined): StandingSummary | null {
  if (!standing) {
    return null
  }

  return {
    games: standing.games,
    losses: standing.losses,
    op: standing.op,
    player: standing.displayName || standing.player,
    rank: standing.rank,
    tp: standing.tp,
    vp: standing.vp,
    wins: standing.wins,
  }
}

function collectRenderedRows() {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.standings-table .table-row:not(.table-head)',
    ),
  ).map((row, index) => ({
    cellCount: row.querySelectorAll('[role="cell"]').length,
    cells: Array.from(row.querySelectorAll<HTMLElement>('[role="cell"]')).map(
      (cell) => cell.innerText.trim(),
    ),
    className: row.className,
    html: row.outerHTML.slice(0, 1000),
    index,
    text: row.innerText.trim(),
  }))

  return {
    rowCount: rows.length,
    row0: rows[0] ?? null,
    row1: rows[1] ?? null,
    rows: rows.slice(0, 5),
  }
}

function collectAssetIdentity() {
  return {
    scripts: Array.from(document.scripts)
      .map((script) => script.src)
      .filter((src) => src.includes('/assets/')),
    stylesheets: Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    )
      .map((link) => link.href)
      .filter((href) => href.includes('/assets/')),
  }
}
