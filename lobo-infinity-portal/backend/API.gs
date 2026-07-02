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
      return getNotifications(e);

    case "timeline":
      return getCachedApiResponse(e, action, function() {
        return getTimeline();
      });

    case "settings":
      return getCachedApiResponse(e, action, function() {
        return getSettings();
      });

    case "session":
      return getAuthSession(e);

    case "myProfile":
      return getMyProfile(e);

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

    case "operations":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsDashboard();
      });

    case "operationsAudit":
      return requireApiPermission(e, "runLeagueAudit", function() {
        return getOperationsAudit();
      });

    case "operationsSeason":
      return requireApiPermission(e, "runSeasonControl", function() {
        return getOperationsSeason();
      });

    case "operationsStatus":
      return requireApiPermission(e, "viewOperations", function(auth) {
        return getOperationsStatus(auth);
      });

    case "voteArmyList":
      return requireApiPermission(e, "vote", function() {
        return voteArmyList(e);
      });

    case "submitArmyList":
      return requireApiPermission(e, "submitLists", function() {
        return submitArmyList(e);
      });

    case "updateProfile":
      return updateMyProfile(e);

    case "notificationState":
      return updateNotificationState(e);

    case "updateSettings":
      return requireApiPermission(e, "manageSettings", function() {
        return updateOperationsSettings(e);
      });

    case "approveArmyList":
      return requireApiPermission(e, "approveLists", function() {
        return approveArmyList(e);
      });

    case "rejectArmyList":
      return requireApiPermission(e, "approveLists", function() {
        return rejectArmyList(e);
      });

    case "updateArmyList":
      return requireApiPermission(e, "approveLists", function() {
        return updateArmyList(e);
      });

    case "saveStream":
      return requireApiPermission(e, "manageStreams", function() {
        return saveOperationsStream(e);
      });

    case "deleteStream":
      return requireApiPermission(e, "manageStreams", function() {
        return deleteOperationsStream(e);
      });

    case "saveNews":
      return requireApiPermission(e, "manageNews", function() {
        return saveOperationsNews(e);
      });

    case "deleteNews":
      return requireApiPermission(e, "manageNews", function() {
        return deleteOperationsNews(e);
      });

    case "clearCache":
      return requireApiPermission(e, "manageCache", function() {
        return clearOperationsCache();
      });

    case "refreshCache":
      return requireApiPermission(e, "manageCache", function() {
        return refreshOperationsCache(e);
      });

    case "rebuildStatistics":
      return requireApiPermission(e, "manageCache", function() {
        return rebuildOperationsStatistics();
      });

    case "seasonOperation":
      return requireApiPermission(e, "runSeasonControl", function() {
        return executeSeasonOperation(e);
      });

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
      return requireApiPermission(e, "submitLists", function() {
        return submitArmyList(e);
      });

    case "voteArmyList":
      return requireApiPermission(e, "vote", function() {
        return voteArmyList(e);
      });

    case "updateProfile":
      return updateMyProfile(e);

    case "notificationState":
      return updateNotificationState(e);

    case "updateSettings":
      return requireApiPermission(e, "manageSettings", function() {
        return updateOperationsSettings(e);
      });

    case "approveArmyList":
      return requireApiPermission(e, "approveLists", function() {
        return approveArmyList(e);
      });

    case "rejectArmyList":
      return requireApiPermission(e, "approveLists", function() {
        return rejectArmyList(e);
      });

    case "updateArmyList":
      return requireApiPermission(e, "approveLists", function() {
        return updateArmyList(e);
      });

    case "saveStream":
      return requireApiPermission(e, "manageStreams", function() {
        return saveOperationsStream(e);
      });

    case "deleteStream":
      return requireApiPermission(e, "manageStreams", function() {
        return deleteOperationsStream(e);
      });

    case "saveNews":
      return requireApiPermission(e, "manageNews", function() {
        return saveOperationsNews(e);
      });

    case "deleteNews":
      return requireApiPermission(e, "manageNews", function() {
        return deleteOperationsNews(e);
      });

    case "clearCache":
      return requireApiPermission(e, "manageCache", function() {
        return clearOperationsCache();
      });

    case "refreshCache":
      return requireApiPermission(e, "manageCache", function() {
        return refreshOperationsCache(e);
      });

    case "rebuildStatistics":
      return requireApiPermission(e, "manageCache", function() {
        return rebuildOperationsStatistics();
      });

    case "seasonOperation":
      return requireApiPermission(e, "runSeasonControl", function() {
        return executeSeasonOperation(e);
      });

    default:
      return doGet(e);

  }

}

function jsonOutput(data) {

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

}
