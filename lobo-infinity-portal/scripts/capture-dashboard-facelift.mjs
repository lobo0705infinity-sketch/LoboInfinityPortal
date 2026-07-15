import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:5173/'

const standings = [
  ['Chainsaw', 1, 6, 5, 0, 1, 18, 94, 512, 'Vanilla PanOceania'],
  ['Cobraprime', 2, 6, 4, 1, 1, 15, 81, 476, 'Combined Army'],
  ['JoshPosh', 3, 6, 4, 2, 0, 14, 78, 441, 'Nomads'],
  ['FlashPulse', 4, 6, 3, 2, 1, 12, 74, 408, 'CA Task Force'],
  ['Nazeen', 5, 6, 3, 2, 1, 12, 65, 398, 'Haqqislam'],
  ['Capt Jackus', 6, 6, 3, 3, 0, 9, 63, 376, 'Ariadna'],
  ['Misderecktion', 7, 6, 2, 3, 1, 7, 58, 344, 'O-12'],
  ['TiechoN', 8, 6, 2, 4, 0, 6, 52, 321, 'Yu Jing'],
  ['Kittenmarines', 9, 6, 1, 4, 1, 4, 44, 297, 'JSA'],
  ['Lobo', 10, 6, 0, 5, 1, 1, 27, 251, 'Morats'],
].map(([player, rank, games, wins, losses, draws, tp, op, vp, faction]) => ({
  displayName: String(player),
  draws: Number(draws),
  faction: String(faction),
  games: Number(games),
  losses: Number(losses),
  op: Number(op),
  player: String(player),
  rank: Number(rank),
  tp: Number(tp),
  vp: Number(vp),
  wins: Number(wins),
}))

const recentGames = [
  ['JoshPosh', 'Arg', 'Critical Intervention', '8-4', 101],
  ['Chainsaw', 'Nazeen', 'Hardlock', '9-3', 102],
  ['Misderecktion', 'TiechoN', 'Supplies', '10-2', 103],
  ['FlashPulse', 'Capt Jackus', 'Unmasking', '7-5', 104],
].map(([winner, loser, mission, op, id], index) => ({
  date: index === 3 ? 'Yesterday 21:38' : `2026-07-${12 - index}`,
  division: 'Main Man',
  id,
  loser,
  loserDisplayName: loser,
  loserFaction: 'Nomads',
  mission,
  op,
  tp: index === 0 ? '4-1' : '5-0',
  vp: '142-96',
  winner,
  winnerDisplayName: winner,
  winnerFaction: 'Vanilla PanOceania',
}))

const news = [
  {
    body: 'Week 7 mission rotation is now live. Check League Operations for details.',
    date: '08:15',
    id: 1,
    link: '/league-operations',
    title: 'Mission rotation updated',
  },
  {
    body: 'CA Task Force list submitted and queued for commissioner review.',
    date: '08:32',
    id: 2,
    link: '/army-lists',
    title: 'Army list submitted',
  },
]

const dashboard = {
  activePlayers: 10,
  gamesPlayed: 24,
  leader: standings[0],
  leagueOverview: {
    divisions: [
      { activePlayers: 10, division: 'main', divisionLabel: 'Main Man', gamesPlayed: 24, players: 10 },
      { activePlayers: 9, division: 'pga', divisionLabel: 'PGA', gamesPlayed: 18, players: 9 },
      { activePlayers: 8, division: 'pgb', divisionLabel: 'PGB', gamesPlayed: 14, players: 8 },
    ],
    totalActivePlayers: 27,
    totalLeagueGames: 56,
  },
  mainManStandings: standings,
  success: true,
  topFaction: 'Vanilla PanOceania',
}

const intelligence = {
  biggestVictories: [],
  closestGames: [],
  factionMomentum: [],
  highestVPGames: [],
  losingStreaks: [],
  missionTrends: [
    {
      averageOP: 7,
      averageTP: 4,
      averageVP: 142,
      firstTurnWinRate: 58,
      games: 6,
      mission: 'Critical Intervention',
      story: 'Critical Intervention is setting the week pace.',
    },
    {
      averageOP: 6,
      averageTP: 3,
      averageVP: 118,
      firstTurnWinRate: 51,
      games: 4,
      mission: 'Hardlock',
      story: 'Hardlock remains the secondary active theater.',
    },
  ],
  promotionBattle: [],
  recentUpsets: [],
  records: {},
  relegationBattle: [],
  winStreaks: [
    { displayName: 'Chainsaw', games: 5, player: 'Chainsaw', story: 'Chainsaw is on a five game streak.' },
  ],
}

function payloadFor(urlText) {
  const url = new URL(urlText)
  const action = url.searchParams.get('action')

  if (action === 'dashboard') return dashboard
  if (action === 'recentGames') return { recentGames, success: true }
  if (action === 'news') return { news, success: true }
  if (action === 'intelligence') return intelligence
  if (action === 'records') return { success: true }
  if (action === 'hallOfFame') return { success: true }
  if (action === 'streams') return { streams: [], success: true }
  if (action === 'armyLists') return { armyLists: [], community: {}, success: true }
  return null
}

const server = spawn('npm.cmd', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
  cwd: process.cwd(),
  shell: true,
  stdio: 'ignore',
})

try {
  await new Promise((resolve) => setTimeout(resolve, 4000))
  const browser = await chromium.launch()
  const sizes = [
    ['desktop', 1440, 1000],
    ['tablet', 820, 1100],
    ['mobile', 390, 900],
  ]

  for (const [name, width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.route('**/*', async (route) => {
      const payload = payloadFor(route.request().url())
      if (!payload) {
        await route.continue()
        return
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(payload),
      })
    })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.locator('.dashboard-command-hero').waitFor({ timeout: 10000 })
    await page.screenshot({
      fullPage: true,
      path: `screenshots/dashboard-after-${name}.png`,
    })
    await page.close()
  }

  await browser.close()
} finally {
  server.kill()
}
