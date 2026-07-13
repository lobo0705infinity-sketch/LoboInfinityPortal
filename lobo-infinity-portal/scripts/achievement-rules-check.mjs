import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/AchievementApi.gs', 'utf8')

const context = {
  CONFIG: {
    DIVISIONS: {
      MAIN_MAN: 'Main Man',
      PROVING_GROUNDS_A: 'Proving Grounds A',
    },
  },
  Logger: {
    log() {},
  },
}

vm.createContext(context)
vm.runInContext(`${source}\nthis.__definitions = getAchievementDefinitions();`, context)

const definitions = context.__definitions
const byId = new Map(definitions.map((definition) => [definition.id, definition]))

function baseMetrics(overrides = {}) {
  return {
    armyLists: 0,
    currentWinStreak: 0,
    division: '',
    games: 0,
    hallOfFame: false,
    highestListScore: 0,
    highestOP: 0,
    highestTP: 0,
    highestVP: 0,
    knownFactions: 0,
    knownMissions: 0,
    longestWinStreak: 0,
    losses: 0,
    mostFactionGames: 0,
    mostFactionWins: 0,
    mostMissionGames: 0,
    mostMissionWins: 0,
    perfectControlGames: 0,
    rank: 0,
    uniqueFactions: 0,
    uniqueMissionWins: 0,
    wins: 0,
    ...overrides,
  }
}

function evaluate(id, metrics) {
  const definition = byId.get(id)
  if (!definition) {
    throw new Error(`Missing achievement definition: ${id}`)
  }

  return Boolean(definition.evaluator(metrics).unlocked)
}

function metricsFromPlayerOp(playerObjectivePoints) {
  const metrics = baseMetrics()
  context.updateAchievementScoreMetrics(
    metrics,
    {
      op: `${playerObjectivePoints}-0`,
      tp: '0-0',
      vp: '0-0',
    },
    true,
  )
  return metrics
}

const checks = [
  ['participation-first-game', 'First Win / First Game', 'games >= 1', 'games >= 1', baseMetrics({ games: 1 })],
  ['participation-five-games', 'Five Games', 'games >= 5', 'games >= 5', baseMetrics({ games: 5 })],
  ['participation-ten-games', 'Ten Games', 'games >= 10', 'games >= 10', baseMetrics({ games: 10 })],
  ['participation-twenty-five-games', 'Twenty-Five Games', 'games >= 25', 'games >= 25', baseMetrics({ games: 25 })],
  ['participation-fifty-games', 'Fifty Games', 'games >= 50', 'games >= 50', baseMetrics({ games: 50 })],
  ['participation-one-hundred-games', 'One Hundred Games', 'games >= 100', 'games >= 100', baseMetrics({ games: 100 })],
  ['performance-first-victory', 'First Win', 'wins >= 1', 'wins >= 1', baseMetrics({ wins: 1 })],
  ['performance-five-wins', 'Five Wins', 'wins >= 5', 'wins >= 5', baseMetrics({ wins: 5 })],
  ['performance-ten-wins', 'Ten Wins', 'wins >= 10', 'wins >= 10', baseMetrics({ wins: 10 })],
  ['performance-twenty-wins', 'Twenty Wins', 'wins >= 20', 'wins >= 20', baseMetrics({ wins: 20 })],
  [
    'performance-perfect-season',
    'Perfect Season',
    'games >= 5 and losses == 0',
    'games >= 5 and losses == 0',
    baseMetrics({ games: 5, losses: 0 }),
  ],
  [
    'performance-five-game-win-streak',
    'Win Streak',
    'longestWinStreak >= 5',
    'longestWinStreak >= 5',
    baseMetrics({ longestWinStreak: 5 }),
  ],
  [
    'performance-ten-game-win-streak',
    'Win Streak',
    'longestWinStreak >= 10',
    'longestWinStreak >= 10',
    baseMetrics({ longestWinStreak: 10 }),
  ],
  ['performance-highest-op', 'Highest OP', 'highestOP >= 6', 'highestOP >= 6', baseMetrics({ highestOP: 6 })],
  [
    'performance-highest-tp',
    'Perfect Tournament Points',
    'highestTP >= 5',
    'highestTP >= 5',
    baseMetrics({ highestTP: 5 }),
  ],
  ['performance-highest-vp', 'Highest VP', 'highestVP >= 150', 'highestVP >= 150', baseMetrics({ highestVP: 150 })],
  ['faction-specialist', 'Army achievements', 'mostFactionGames >= 5', 'mostFactionGames >= 5', baseMetrics({ mostFactionGames: 5 })],
  ['faction-master', 'Army achievements', 'mostFactionGames >= 10', 'mostFactionGames >= 10', baseMetrics({ mostFactionGames: 10 })],
  [
    'faction-played-every-faction',
    'Army achievements',
    'uniqueFactions >= knownFactions',
    'uniqueFactions >= knownFactions',
    baseMetrics({ knownFactions: 3, uniqueFactions: 3 }),
  ],
  [
    'faction-ten-wins-same-faction',
    'Army achievements',
    'mostFactionWins >= 10',
    'mostFactionWins >= 10',
    baseMetrics({ mostFactionWins: 10 }),
  ],
  ['mission-master', 'Mission achievements', 'mostMissionGames >= 5', 'mostMissionGames >= 5', baseMetrics({ mostMissionGames: 5 })],
  [
    'mission-win-every-mission',
    'Mission achievements',
    'uniqueMissionWins >= knownMissions',
    'uniqueMissionWins >= knownMissions',
    baseMetrics({ knownMissions: 3, uniqueMissionWins: 3 }),
  ],
  [
    'mission-five-wins-same-mission',
    'Mission achievements',
    'mostMissionWins >= 5',
    'mostMissionWins >= 5',
    baseMetrics({ mostMissionWins: 5 }),
  ],
  ['army-building-first-list', 'Army list achievements', 'armyLists >= 1', 'armyLists >= 1', baseMetrics({ armyLists: 1 })],
  ['army-building-list-engineer', 'Army list achievements', 'armyLists >= 5', 'armyLists >= 5', baseMetrics({ armyLists: 5 })],
  [
    'army-building-highest-rated',
    'Army list achievements',
    'highestListScore >= 1',
    'highestListScore >= 1',
    baseMetrics({ highestListScore: 1 }),
  ],
  [
    'promotion-promoted',
    'Promoted',
    'rank <= 2 and not Main Man',
    'rank <= 2 and not Main Man',
    baseMetrics({ division: 'Proving Grounds A', rank: 2 }),
  ],
  ['promotion-main-man', 'Main Man', 'division == Main Man', 'division == Main Man', baseMetrics({ division: 'Main Man' })],
  ['promotion-division-champion', 'Division Champion', 'rank == 1', 'rank == 1', baseMetrics({ rank: 1 })],
  [
    'promotion-season-champion',
    'Season Champion',
    'rank == 1 and division == Main Man',
    'rank == 1 and division == Main Man',
    baseMetrics({ division: 'Main Man', rank: 1 }),
  ],
  ['legendary-hall-of-fame', 'Hall of Fame', 'hallOfFame == true', 'hallOfFame == true', baseMetrics({ hallOfFame: true })],
  ['legendary-veteran', 'Veteran', 'games >= 50', 'games >= 50', baseMetrics({ games: 50 })],
  ['legendary-century-club', 'Century Club', 'games >= 100', 'games >= 100', baseMetrics({ games: 100 })],
  [
    'hidden-perfect-control',
    'Perfect Control',
    'perfectControlGames > 0',
    'player objective points == 10 in one game',
    metricsFromPlayerOp(10),
  ],
]

const manualIds = [
  'sportsmanship-community-favorite',
  'sportsmanship-best-painted',
  'sportsmanship-best-opponent',
  'sportsmanship-great-sportsman',
  'commissioner-award',
]

const rows = []
const failures = []

for (const [id, achievement, trigger, expected, metrics] of checks) {
  const pass = evaluate(id, metrics)
  rows.push({ achievement, trigger, currentLogic: trigger, expected, result: pass ? 'PASS' : 'FAIL' })
  if (!pass) failures.push(`${id} did not unlock for expected metrics`)
}

for (const id of manualIds) {
  const definition = byId.get(id)
  const locked = definition && !definition.evaluator(baseMetrics()).unlocked
  rows.push({
    achievement: definition?.name || id,
    trigger: 'manual commissioner award',
    currentLogic: 'manual only',
    expected: 'does not auto-unlock',
    result: locked ? 'PASS' : 'FAIL',
  })
  if (!locked) failures.push(`${id} auto-unlocked unexpectedly`)
}

const perfectControl = byId.get('hidden-perfect-control')
const perfectCases = [
  [5, false],
  [9, false],
  [10, true],
]

for (const [op, expected] of perfectCases) {
  const actual = Boolean(perfectControl.evaluator(metricsFromPlayerOp(op)).unlocked)
  if (actual !== expected) {
    failures.push(`Perfect Control OP ${op}: expected ${expected}, received ${actual}`)
  }
}

if (perfectControl.evaluator(baseMetrics({ highestOP: 10, perfectControlGames: 0 })).unlocked) {
  failures.push('Perfect Control must not unlock from highestOP alone')
}

console.log('| Achievement | Trigger | Current Logic | Expected Logic | Result |')
console.log('| --- | --- | --- | --- | --- |')
for (const row of rows) {
  console.log(
    `| ${row.achievement} | ${row.trigger} | ${row.currentLogic} | ${row.expected} | ${row.result} |`,
  )
}

if (failures.length > 0) {
  console.error(`\nAchievement rule check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`)
  process.exit(1)
}

console.log('\nAchievement rule check passed.')
