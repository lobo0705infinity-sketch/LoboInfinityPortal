import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const eventEngine = readFileSync(new URL('../backend/EventEngineApi.gs', import.meta.url), 'utf8')
const tournament = readFileSync(new URL('../backend/TeamTournamentApi.gs', import.meta.url), 'utf8')
const tournamentPage = readFileSync(new URL('../src/pages/TeamTournament.tsx', import.meta.url), 'utf8')
const pairingEditor = readFileSync(new URL('../src/components/TeamPairingEditor.tsx', import.meta.url), 'utf8')
const submitResult = readFileSync(new URL('../src/pages/SubmitResult.tsx', import.meta.url), 'utf8')

const missionHeader = eventEngine.indexOf('"Mission"', eventEngine.indexOf('const EVENT_ENGINE_ROUND_HEADERS'))
const updatedAtHeader = eventEngine.indexOf('"Updated At"', eventEngine.indexOf('const EVENT_ENGINE_ROUND_HEADERS'))
assert.ok(missionHeader > updatedAtHeader, 'Mission must be appended after existing Event Round columns')
assert.match(eventEngine, /mission:\s*row\["Mission"\]/, 'round objects expose Mission')

assert.match(tournament, /activeRounds\.length === 1 \? activeRounds : rounds/, 'current round prefers one unambiguous Active round')
assert.match(tournament, /getTeamTournamentNormalizedRoundNumber_\(right\)[\s\S]{0,100}getTeamTournamentNormalizedRoundNumber_\(left\)/, 'current round fallback uses highest normalized round number')
assert.match(tournament, /lock\.waitLock\(10000\)/, 'round creation uses the existing bounded script lock')
assert.match(tournament, /Object\.keys\(resultIds\)\.length < 5/, 'round completion requires five distinct canonical results per matchup')
assert.match(tournament, /getCanonicalMissionName\(params\.mission\)/, 'Mission is validated through the canonical registry')
assert.match(tournament, /updateTeamTournamentRoundStatus_\(currentRound\.id, "Completed"\)/, 'current canonical round is completed')
assert.match(tournament, /"Active"[\s\S]*mission[\s\S]*missionGeistId/, 'next canonical round is Active and stores Mission identity')
assert.doesNotMatch(tournament.match(/function advanceTeamTournamentRound[\s\S]*?\n}\n/)?.[0] ?? '', /saveTeamTournamentPairing/, 'advancement does not generate pairings')

assert.match(tournament, /A team cannot play itself/, 'backend rejects same-team matchups')
assert.match(tournament, /A team may appear only once in a round/, 'backend rejects repeated teams in a round')
assert.match(tournament, /Both teams must belong to this Team Tournament/, 'backend validates event teams')
assert.match(tournament, /expectedOpponentTeam/, 'backend resolves the opposing team')
assert.match(tournament, /membership\[getTeamTournamentString\(selectedOpponent\)\.toLowerCase\(\)\]/, 'backend validates the selected opponent roster membership')
assert.match(tournament, /getTeamTournamentNormalizedRoundNumber_\(round\) === roundNumber/, 'backend prevents duplicate normalized round numbers')
assert.match(tournament, /getTeamTournamentNormalizedRoundNumber_\(\{ round: pairing\.round \}\) === roundNumber/, 'backend checks mixed historical pairing labels for duplicate rounds')
assert.match(tournament, /throw new Error\(roundName \+ " already exists\."\)/, 'backend rejects publishing a duplicate round')

assert.match(pairingEditor, /Round Management/, 'Commissioner editor exposes round management')
assert.match(pairingEditor, /Publish Round and Pairings/, 'Commissioner atomically publishes a complete round')
assert.match(pairingEditor, /Team A Player|Team B Player/, 'Commissioner assigns individual player opponents')
assert.match(pairingEditor, /Complete Preview/, 'Commissioner reviews the complete round before publishing')
assert.match(pairingEditor, /getNextTeamTournamentRoundNumber\(\[\.\.\.rounds, \.\.\.pairingHistory\], current\)/, 'Commissioner next round uses normalized round records, pairing history, and current event round')
assert.match(tournamentPage, /Create Next Round/, 'Pairings page exposes canonical next-round creation')
assert.match(tournamentPage, /getPublicMissionGeistCatalog/, 'round form uses the snapshot-native Mission Geist catalog')
assert.match(tournamentPage, /<strong>Mission:<\/strong>/, 'public pairings display the current round Mission')

assert.match(submitResult, /buildOpposingTeamRosterOptions/, 'team-only submissions offer the opposing roster')
assert.match(submitResult, /data\?\.tournamentResults\.some/, 'already-submitted state comes from canonical results')
assert.match(submitResult, /commissionerMode[\s\S]{0,200}buildTournamentOpponentPickerOptions[\s\S]{0,200}: buildOpposingTeamRosterOptions/, 'only Commissioner mode can use the broad opponent picker')

console.log('PASS: canonical Team Tournament round-management contract')
