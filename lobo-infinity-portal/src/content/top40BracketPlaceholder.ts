export type Top40BracketSlot = {
  label: string
  initialEntry?: boolean
}

export type Top40BracketMatch = {
  id: string
  slots: [Top40BracketSlot, Top40BracketSlot]
}

export type Top40BracketRound = {
  id: string
  title: string
  matches: Top40BracketMatch[]
}

export type Top40BracketSection = {
  id: 'winners' | 'losers' | 'grand-final'
  title: string
  rounds: Top40BracketRound[]
}

const slot = (label: string, initialEntry = false): Top40BracketSlot => ({
  label,
  ...(initialEntry ? { initialEntry: true } : {}),
})

const match = (
  id: string,
  first: Top40BracketSlot,
  second: Top40BracketSlot,
): Top40BracketMatch => ({ id, slots: [first, second] })

const sources = (prefix: string, count: number, start = 1) =>
  Array.from({ length: count }, (_, index) => slot(`${prefix} ${index + start}`))

const pairSources = (idPrefix: string, first: Top40BracketSlot[], second: Top40BracketSlot[]) =>
  first.map((entry, index) => match(`${idPrefix}${index + 1}`, entry, second[index]))

const playInMatches = Array.from({ length: 8 }, (_, index) =>
  match(
    `PI${index + 1}`,
    slot(`Seed ${25 + index}`, true),
    slot(`Seed ${40 - index}`, true),
  ),
)

const roundOf32Matches = Array.from({ length: 16 }, (_, index) => {
  const opponent = index < 8
    ? slot(`Winner Play-In ${index + 1}`)
    : slot(`Seed ${index + 9}`, true)
  return match(`W32-${index + 1}`, slot(`Seed ${index + 1}`, true), opponent)
})

const winnersRound = (id: string, title: string, count: number, sourceRound: string): Top40BracketRound => ({
  id,
  title,
  matches: Array.from({ length: count }, (_, index) => match(
    `${id}-${index + 1}`,
    slot(`Winner ${sourceRound} ${index * 2 + 1}`),
    slot(`Winner ${sourceRound} ${index * 2 + 2}`),
  )),
})

const losersRounds: Top40BracketRound[] = [
  {
    id: 'l1',
    title: 'Losers Round 1',
    matches: pairSources('L1-', sources('Loser Play-In', 8), sources('Loser Winners Round of 32 Match', 8)),
  },
  {
    id: 'l2',
    title: 'Losers Round 2',
    matches: pairSources('L2-', sources('Winner Losers Round 1 Match', 8), sources('Loser Winners Round of 32 Match', 8, 9)),
  },
  {
    id: 'l3',
    title: 'Losers Round 3',
    matches: pairSources('L3-', sources('Winner Losers Round 2 Match', 8), sources('Loser Winners Round of 16 Match', 8)),
  },
  {
    id: 'l4',
    title: 'Losers Round 4',
    matches: Array.from({ length: 4 }, (_, index) => match(`L4-${index + 1}`, slot(`Winner Losers Round 3 Match ${index * 2 + 1}`), slot(`Winner Losers Round 3 Match ${index * 2 + 2}`))),
  },
  {
    id: 'l5',
    title: 'Losers Round 5',
    matches: pairSources('L5-', sources('Winner Losers Round 4 Match', 4), sources('Loser Winners Quarterfinal', 4)),
  },
  {
    id: 'l6',
    title: 'Losers Round 6',
    matches: Array.from({ length: 2 }, (_, index) => match(`L6-${index + 1}`, slot(`Winner Losers Round 5 Match ${index * 2 + 1}`), slot(`Winner Losers Round 5 Match ${index * 2 + 2}`))),
  },
  {
    id: 'l7',
    title: 'Losers Round 7',
    matches: pairSources('L7-', sources('Winner Losers Round 6 Match', 2), sources('Loser Winners Semifinal', 2)),
  },
  {
    id: 'l8',
    title: 'Losers Semifinal',
    matches: [match('L8-1', slot('Winner Losers Round 7 Match 1'), slot('Winner Losers Round 7 Match 2'))],
  },
  {
    id: 'l9',
    title: 'Losers Final',
    matches: [match('L9-1', slot('Winner Losers Semifinal'), slot('Loser Winners Final'))],
  },
]

/**
 * Temporary display-only bracket. Replace this value with the hourly snapshot
 * projection when live entrants are published; the page renderer is data-driven.
 */
export const TOP_40_PLACEHOLDER_BRACKET: Top40BracketSection[] = [
  {
    id: 'winners',
    title: 'Winners Bracket',
    rounds: [
      { id: 'play-in', title: 'Opening Play-In', matches: playInMatches },
      { id: 'round-of-32', title: 'Round of 32', matches: roundOf32Matches },
      winnersRound('w16', 'Round of 16', 8, 'Winners Round of 32 Match'),
      winnersRound('wqf', 'Quarterfinals', 4, 'Winners Round of 16 Match'),
      winnersRound('wsf', 'Semifinals', 2, 'Winners Quarterfinal'),
      winnersRound('wf', 'Winners Final', 1, 'Winners Semifinal'),
    ],
  },
  { id: 'losers', title: 'Losers Bracket', rounds: losersRounds },
  {
    id: 'grand-final',
    title: 'Grand Final',
    rounds: [{
      id: 'grand-final',
      title: 'Grand Final',
      matches: [match('GF-1', slot('Winner Winners Final'), slot('Winner Losers Final'))],
    }],
  },
]
