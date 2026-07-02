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
      return getCachedApiResponse(e, action, function() {
        return getLeader();
      });

    case "dashboard":
      return getCachedApiResponse(e, action, function() {
        return getDashboard();
      });

    case "home":
      return getCachedApiResponse(e, action, function() {
        return getHome();
      });

    case "players":
      return getCachedApiResponse(e, action, function() {
        return getPlayers();
      });

    case "player":
      return getCachedApiResponse(e, action, function() {
        return getPlayer(e);
      });

    case "recentGames":
      return getCachedApiResponse(e, action, function() {
        return getRecentGames();
      });

    case "standings":
      return getCachedApiResponse(e, action, function() {
        return getStandings(e);
      });

    case "factions":
      return getCachedApiResponse(e, action, function() {
        return getFactions();
      });

    case "faction":
      return getCachedApiResponse(e, action, function() {
        return getFaction(e);
      });

    case "missions":
      return getCachedApiResponse(e, action, function() {
        return getMissions();
      });

    case "mission":
      return getCachedApiResponse(e, action, function() {
        return getMission(e);
      });

    case "intelligence":
      return getCachedApiResponse(e, action, function() {
        return getIntelligence();
      });

    case "news":
      return getCachedApiResponse(e, action, function() {
        return getCommissionerNews();
      });

    case "records":
      return getCachedApiResponse(e, action, function() {
        return getRecords();
      });

    case "hallOfFame":
      return getCachedApiResponse(e, action, function() {
        return getHallOfFame();
      });

    case "comparison":
      return getCachedApiResponse(e, action, function() {
        return getPlayerComparison(e);
      });

    case "notifications":
      return getCachedApiResponse(e, action, function() {
        return getNotifications();
      });

    case "timeline":
      return getCachedApiResponse(e, action, function() {
        return getTimeline();
      });

    case "settings":
      return getCachedApiResponse(e, action, function() {
        return getSettings();
      });

    case "streams":
      return getCachedApiResponse(e, action, function() {
        return getStreams();
      });

    case "searchData":
      return getCachedApiResponse(e, action, function() {
        return getSearchData();
      });

    case "armyLists":
      return getCachedApiResponse(e, action, function() {
        return getArmyLists();
      });

    case "voteArmyList":
      return voteArmyList(e);

    case "submitArmyList":
      return submitArmyList(e);

    default:
      return jsonOutput({
        success: false,
        error: "Unknown API action."
      });

  }

}

function doPost(e) {

  const action =
    (e && e.parameter && e.parameter.action)
      ? e.parameter.action
      : "";

  switch (action) {

    case "submitArmyList":
      return submitArmyList(e);

    case "voteArmyList":
      return voteArmyList(e);

    default:
      return doGet(e);

  }

}

function jsonOutput(data) {

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

}
