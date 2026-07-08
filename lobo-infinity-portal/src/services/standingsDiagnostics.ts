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
  component: string
  html: string
  index: number
  player: string
  rank: string
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

type BoxSummary = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
  x: number
  y: number
}

type ComputedStyleSummary = {
  backgroundColor: string
  clipPath: string
  color: string
  display: string
  filter: string
  fontSize: string
  fontWeight: string
  height: string
  opacity: string
  overflow: string
  overflowX: string
  overflowY: string
  pointerEvents: string
  position: string
  transform: string
  visibility: string
  width: string
  zIndex: string
}

type CellInspection = {
  boundingRect: BoxSummary
  computedStyle: ComputedStyleSummary
  flags: string[]
  index: number
  offsetHeight: number
  offsetWidth: number
  text: string
}

type AncestorInspection = {
  boundingRect: BoxSummary
  className: string
  computedStyle: ComputedStyleSummary
  flags: string[]
  id: string
  tag: string
}

export type AuthenticatedStandingsDebugReport = {
  ancestorInspection: AncestorInspection[]
  build: typeof buildInfo
  cellInspection: CellInspection[]
  firstRowInspection: {
    boundingRect: BoxSummary | null
    childCount: number
    clientHeight: number
    clientWidth: number
    computedStyle: ComputedStyleSummary | null
    dataAttributes: Record<string, string>
    innerHTML: string
    offsetHeight: number
    offsetWidth: number
    outerHTML: string
    textContent: string
  }
  paintInspection: {
    applied: boolean
    computedStyle: ComputedStyleSummary | null
    firstRowStillBlank: boolean
    visibleText: string
  }
  pipeline: StandingsRenderDiagnostics | null
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

export function collectAuthenticatedStandingsDebugReport(
  paintApplied: boolean,
): AuthenticatedStandingsDebugReport {
  const pipeline = getStoredStandingsDiagnostics()
  const firstRow = getFirstRenderedStandingsRow()

  return {
    ancestorInspection: firstRow ? inspectAncestors(firstRow) : [],
    build: buildInfo,
    cellInspection: firstRow ? inspectCells(firstRow) : [],
    firstRowInspection: inspectFirstRow(firstRow),
    paintInspection: inspectPaint(firstRow, paintApplied),
    pipeline,
    timestamp: new Date().toISOString(),
  }
}

export function setFirstStandingsRowPaintDiagnostic(enabled: boolean) {
  const firstRow = getFirstRenderedStandingsRow()

  if (!firstRow) {
    return false
  }

  if (!enabled) {
    firstRow.removeAttribute('data-standings-paint-test')
    firstRow.style.removeProperty('background')
    firstRow.style.removeProperty('color')
    firstRow.style.removeProperty('outline')
    firstRow.style.removeProperty('position')
    firstRow.style.removeProperty('z-index')
    firstRow
      .querySelectorAll<HTMLElement>('[role="cell"], a, strong, span')
      .forEach((element) => {
        element.style.removeProperty('color')
        element.style.removeProperty('opacity')
        element.style.removeProperty('visibility')
      })
    return true
  }

  firstRow.dataset.standingsPaintTest = 'active'
  firstRow.style.setProperty('background', '#ffea00', 'important')
  firstRow.style.setProperty('color', '#000000', 'important')
  firstRow.style.setProperty('outline', '5px solid #ff0000', 'important')
  firstRow.style.setProperty('position', 'relative', 'important')
  firstRow.style.setProperty('z-index', '999999', 'important')
  firstRow
    .querySelectorAll<HTMLElement>('[role="cell"], a, strong, span')
    .forEach((element) => {
      element.style.setProperty('color', '#000000', 'important')
      element.style.setProperty('opacity', '1', 'important')
      element.style.setProperty('visibility', 'visible', 'important')
    })

  return true
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
    component: row.dataset.standingsComponent || 'unknown',
    html: row.outerHTML.slice(0, 1000),
    index,
    player: row.dataset.standingsPlayer || '',
    rank: row.dataset.standingsRank || '',
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

function getFirstRenderedStandingsRow() {
  return document.querySelector<HTMLElement>(
    '.standings-table .table-row:not(.table-head)',
  )
}

function inspectFirstRow(row: HTMLElement | null) {
  if (!row) {
    return {
      boundingRect: null,
      childCount: 0,
      clientHeight: 0,
      clientWidth: 0,
      computedStyle: null,
      dataAttributes: {},
      innerHTML: '',
      offsetHeight: 0,
      offsetWidth: 0,
      outerHTML: '',
      textContent: '',
    }
  }

  return {
    boundingRect: toBoxSummary(row.getBoundingClientRect()),
    childCount: row.children.length,
    clientHeight: row.clientHeight,
    clientWidth: row.clientWidth,
    computedStyle: summarizeComputedStyle(window.getComputedStyle(row)),
    dataAttributes: Object.fromEntries(
      Object.entries(row.dataset).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
    innerHTML: row.innerHTML,
    offsetHeight: row.offsetHeight,
    offsetWidth: row.offsetWidth,
    outerHTML: row.outerHTML,
    textContent: row.textContent?.trim() ?? '',
  }
}

function inspectCells(row: HTMLElement) {
  return Array.from(row.querySelectorAll<HTMLElement>('[role="cell"]')).map(
    (cell, index) => {
      const boundingRect = toBoxSummary(cell.getBoundingClientRect())
      const computedStyle = summarizeComputedStyle(window.getComputedStyle(cell))

      return {
        boundingRect,
        computedStyle,
        flags: getVisibilityFlags(boundingRect, computedStyle),
        index,
        offsetHeight: cell.offsetHeight,
        offsetWidth: cell.offsetWidth,
        text: cell.textContent?.trim() ?? '',
      }
    },
  )
}

function inspectAncestors(row: HTMLElement) {
  const ancestors: AncestorInspection[] = []
  let current: HTMLElement | null = row

  while (current) {
    const boundingRect = toBoxSummary(current.getBoundingClientRect())
    const computedStyle = summarizeComputedStyle(window.getComputedStyle(current))

    ancestors.push({
      boundingRect,
      className: current.className,
      computedStyle,
      flags: getVisibilityFlags(boundingRect, computedStyle),
      id: current.id,
      tag: current.tagName.toLowerCase(),
    })

    if (current.tagName.toLowerCase() === 'body') {
      break
    }

    current = current.parentElement
  }

  return ancestors
}

function inspectPaint(row: HTMLElement | null, paintApplied: boolean) {
  if (!row) {
    return {
      applied: paintApplied,
      computedStyle: null,
      firstRowStillBlank: true,
      visibleText: '',
    }
  }

  const visibleText = row.innerText.trim()

  return {
    applied: paintApplied,
    computedStyle: summarizeComputedStyle(window.getComputedStyle(row)),
    firstRowStillBlank: visibleText.length === 0,
    visibleText,
  }
}

function summarizeComputedStyle(style: CSSStyleDeclaration): ComputedStyleSummary {
  return {
    backgroundColor: style.backgroundColor,
    clipPath: style.clipPath,
    color: style.color,
    display: style.display,
    filter: style.filter,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    height: style.height,
    opacity: style.opacity,
    overflow: style.overflow,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
    pointerEvents: style.pointerEvents,
    position: style.position,
    transform: style.transform,
    visibility: style.visibility,
    width: style.width,
    zIndex: style.zIndex,
  }
}

function toBoxSummary(rect: DOMRect): BoxSummary {
  return {
    bottom: Math.round(rect.bottom * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
    left: Math.round(rect.left * 100) / 100,
    right: Math.round(rect.right * 100) / 100,
    top: Math.round(rect.top * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
  }
}

function getVisibilityFlags(
  boundingRect: BoxSummary,
  computedStyle: ComputedStyleSummary,
) {
  const flags: string[] = []

  if (computedStyle.display === 'none') {
    flags.push('display-none')
  }

  if (computedStyle.visibility === 'hidden') {
    flags.push('visibility-hidden')
  }

  if (computedStyle.opacity === '0') {
    flags.push('opacity-zero')
  }

  if (boundingRect.width === 0) {
    flags.push('zero-width')
  }

  if (boundingRect.height === 0) {
    flags.push('zero-height')
  }

  if (computedStyle.overflow.includes('hidden')) {
    flags.push('overflow-hidden')
  }

  if (computedStyle.clipPath !== 'none') {
    flags.push('clip-path')
  }

  if (computedStyle.filter !== 'none') {
    flags.push('filter')
  }

  return flags
}
