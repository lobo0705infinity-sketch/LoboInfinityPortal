import type { PublicEvent } from './snapshotTypes'

export function buildTop40BracketSections(event: PublicEvent) {
  return ['Winners', 'Losers', 'Grand Final'].map((name) => {
    const matches = (event.bracket ?? []).filter((match) => match.bracket === name)
    const rounds = [...new Set(matches.map((match) => Number(match.bracketRound)))].sort((a, b) => a - b)
    return { id: name.toLowerCase().replaceAll(' ', '-'), title: name === 'Grand Final' ? name : `${name} Bracket`, rounds: rounds.map((number) => ({
      id: `${name}-${number}`, title: name === 'Grand Final' ? number === 2 ? 'Reset · if required' : 'Grand Final' : `Round ${number}`,
      matches: matches.filter((match) => Number(match.bracketRound) === number).sort((a, b) => Number(a.position) - Number(b.position)),
    })) }
  }).filter((section) => section.rounds.length)
}

export function top40BracketSlot(match: Record<string, unknown>, slot: 'A' | 'B') {
  const player = String(match[`player${slot}`] || '')
  const seed = Number(match[`seed${slot}`])
  return player ? `${seed ? `#${seed} · ` : ''}${player}` : String(match[`player${slot}Source`] || 'Awaiting opponent')
}
