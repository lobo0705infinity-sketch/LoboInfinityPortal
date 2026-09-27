// Set this to a published report ID to hold that report in the homepage spotlight.
// Leave it null to feature the newest report with a substantive submitted moment.
export const PINNED_FEATURED_REPORT_ID = null

export function selectFeaturedReport(games, pinnedId = PINNED_FEATURED_REPORT_ID) {
  if (!Array.isArray(games)) return null

  if (Number.isSafeInteger(pinnedId) && pinnedId > 0) {
    const pinned = games.find(game => game.id === pinnedId && hasReportDetails(game))
    if (pinned) return pinned
  }

  // Snapshot IDs follow submission order, including games played on older dates.
  return games.filter(game => hasReportDetails(game) && hasSubstantiveMoment(game.bestMoment))
    .sort((left, right) => right.id - left.id)[0] ?? null
}

export function featuredReportHighlight(moment) {
  const clean = String(moment ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'Read the result and game review.'
  const excerpt = clean.length > 160 ? `${clean.slice(0, 156).replace(/\s+\S*$/, '')}…` : clean
  return `Submitted highlight: “${excerpt}”`
}

function hasReportDetails(game) {
  return game && Number.isSafeInteger(game.id) && game.id > 0
    && typeof game.mission === 'string' && game.mission.trim()
    && typeof game.player1Faction === 'string' && game.player1Faction.trim()
    && typeof game.player2Faction === 'string' && game.player2Faction.trim()
}

function hasSubstantiveMoment(moment) {
  if (typeof moment !== 'string') return false
  const clean = moment.replace(/\s+/g, ' ').trim()
  return clean.length >= 35 && (clean.match(/[a-z]{2,}/gi) ?? []).length >= 7
    && !/^(?:n\/?a|none|nothing|no (?:highlight|moment)|good game|great game)[.!\s]*$/i.test(clean)
}
