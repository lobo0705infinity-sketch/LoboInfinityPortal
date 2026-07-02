/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * API.gs
 *
 * Public API routing and JSON response formatting.
 *******************************************************/

function doGet(e) {

  const action =
    (e && e.parameter && e.parameter.action)
      ? e.parameter.action
      : "";

  switch (action) {

    case "leader":
      return getLeader();

    case "dashboard":
      return getDashboard();

    case "player":
      return getPlayer(e);

    case "recentGames":
      return getRecentGames();

    case "standings":
      return getStandings(e);

    case "factions":
      return getFactions();

    case "faction":
      return getFaction(e);

    case "missions":
      return getMissions();

    case "mission":
      return getMission(e);

    case "intelligence":
      return getIntelligence();

    case "news":
      return getCommissionerNews();

    default:
      return jsonOutput({
        success: false,
        error: "Unknown API action."
      });

  }

}

function jsonOutput(data) {

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

}
