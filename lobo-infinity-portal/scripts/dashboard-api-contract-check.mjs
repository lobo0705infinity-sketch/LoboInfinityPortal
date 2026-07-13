const requiredStandingFields = [
  'rank',
  'player',
  'games',
  'wins',
  'losses',
  'tp',
  'op',
  'vp',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertStandingContract(standing, path) {
  assert(standing && typeof standing === 'object', `${path} must be an object`)

  for (const field of requiredStandingFields) {
    assert(
      Object.prototype.hasOwnProperty.call(standing, field),
      `${path} is missing ${field}`,
    )
    assert(
      standing[field] !== null && standing[field] !== undefined,
      `${path}.${field} must not be null or undefined`,
    )
  }
}

const validDashboardPayload = {
  success: true,
  leader: {
    rank: 1,
    player: 'Lobo',
    games: 2,
    wins: 2,
    losses: 0,
    draws: 0,
    tp: 10,
    op: 15,
    vp: 301,
  },
  mainManStandings: [
    {
      rank: 1,
      player: 'Lobo',
      games: 2,
      wins: 2,
      losses: 0,
      draws: 0,
      tp: 10,
      op: 15,
      vp: 301,
    },
  ],
}

const invalidDashboardPayload = {
  success: true,
  leader: {
    rank: 1,
    player: 'Lobo',
    games: 2,
    wins: 2,
    losses: 0,
    tp: 10,
    op: 15,
  },
  mainManStandings: [
    {
      rank: 1,
      player: 'Lobo',
      games: 2,
      wins: 2,
      losses: 0,
      tp: 10,
      op: 15,
    },
  ],
}

function assertDashboardContract(payload) {
  assert(payload && typeof payload === 'object', 'Dashboard payload must be an object')
  assertStandingContract(payload.leader, 'leader')
  assert(
    Array.isArray(payload.mainManStandings),
    'mainManStandings must be an array',
  )
  payload.mainManStandings.forEach((standing, index) => {
    assertStandingContract(standing, `mainManStandings[${index}]`)
  })
}

assertDashboardContract(validDashboardPayload)

let failedAsExpected = false
try {
  assertDashboardContract(invalidDashboardPayload)
} catch (error) {
  failedAsExpected = /missing vp/.test(String(error.message))
}

assert(
  failedAsExpected,
  'Dashboard contract check must fail when VP is missing',
)

console.log('dashboard API contract checks passed')
