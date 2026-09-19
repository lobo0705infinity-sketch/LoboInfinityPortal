/*******************************************************
 * Privacy-safe portal page-view counting.
 * Persistent schema: Timestamp | Page Key
 *******************************************************/

const PAGE_ANALYTICS_HEADERS = ["Timestamp", "Page Key"];
const PAGE_ANALYTICS_PAGES = {
  "dashboard": "Dashboard",
  "players": "Players",
  "player-profile": "Player Profile",
  "compare": "Compare Players",
  "rivalries": "Rivalries",
  "game-details": "Game Details",
  "factions": "Factions",
  "faction-profile": "Faction Profile",
  "missions": "Missions",
  "mission-profile": "Mission Profile",
  "army-intelligence": "Army Intelligence",
  "hall-of-fame": "Hall of Fame",
  "streams": "Streams",
  "army-lists": "Army Lists",
  "army-list-submit": "Submit Army List",
  "standings": "Standings",
  "statistics": "Statistics",
  "league-operations": "Mission & Map",
  "events": "Past Events",
  "event-overview": "Event Overview",
  "event-registration": "Event Registration",
  "submit-game": "Submit Game",
  "schedule": "League Schedule",
  "rules": "Rules",
  "mobile-menu": "More",
  "team-tournament-overview": "Team Tournament Overview",
  "team-tournament-registration": "Team Tournament Registration",
  "team-tournament-standings": "Team Tournament Standings",
  "team-tournament-pairings": "Team Tournament Pairings",
  "team-tournament-teams": "Team Tournament Teams",
  "team-tournament-results": "Team Tournament Results"
};

function recordPageView(e) {
  const pageKey = String(e && e.parameter && e.parameter.pageKey || "");

  if (!Object.prototype.hasOwnProperty.call(PAGE_ANALYTICS_PAGES, pageKey)) {
    return jsonOutput({
      success: false,
      code: "INVALID_PAGE_KEY",
      error: "Page Key is not recognized."
    });
  }

  ensurePageAnalyticsSheet_().appendRow([new Date(), pageKey]);
  return jsonOutput({ success: true });
}

function getPageAnalytics() {
  const sheet = ensurePageAnalyticsSheet_();
  const values = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
    : [];
  const now = new Date().getTime();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const counts = {};

  Object.keys(PAGE_ANALYTICS_PAGES).forEach(function(pageKey) {
    counts[pageKey] = { allTime: 0, last30Days: 0, last7Days: 0 };
  });

  values.forEach(function(row) {
    const timestamp = row[0] instanceof Date
      ? row[0].getTime()
      : new Date(row[0]).getTime();
    const pageKey = String(row[1] || "");

    if (!counts[pageKey] || !Number.isFinite(timestamp)) return;

    counts[pageKey].allTime += 1;
    if (timestamp >= thirtyDaysAgo) counts[pageKey].last30Days += 1;
    if (timestamp >= sevenDaysAgo) counts[pageKey].last7Days += 1;
  });

  const pages = Object.keys(PAGE_ANALYTICS_PAGES).map(function(pageKey) {
    return {
      pageKey: pageKey,
      displayName: PAGE_ANALYTICS_PAGES[pageKey],
      last7Days: counts[pageKey].last7Days,
      last30Days: counts[pageKey].last30Days,
      allTime: counts[pageKey].allTime
    };
  });

  pages.sort(function(a, b) {
    return b.allTime - a.allTime || a.displayName.localeCompare(b.displayName);
  });

  return jsonOutput({ pages: pages, success: true });
}

function ensurePageAnalyticsSheet_() {
  const spreadsheet = lifGetTargetSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.PAGE_ANALYTICS);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEETS.PAGE_ANALYTICS);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, PAGE_ANALYTICS_HEADERS.length)
      .setValues([PAGE_ANALYTICS_HEADERS]);
  }

  return sheet;
}
