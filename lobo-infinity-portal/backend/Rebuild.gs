/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * Rebuild.gs
 *
 * Master rebuild controller, triggers, and manual runners.
 *
 *******************************************************/

function rebuildEverything() {

  const start = new Date();
  clearPortalCache();

  Logger.log("====================================");
  Logger.log("LOBO INFINITY LEAGUE REBUILD");
  Logger.log("Started: " + start);

  try {

    clearLeagueData();

    rebuildGameEngine();

    clearLeagueData();
    loadLeagueData();

    rebuildStandings();

    rebuildPlayerAnalytics();

    rebuildFactionAnalytics();

    rebuildMissionAnalytics();

    if (typeof evaluateAchievementsForAllPlayers === "function")
      evaluateAchievementsForAllPlayers();

    // rebuildDashboard();

    SpreadsheetApp.flush();
    clearPortalCache();

    const end = new Date();

    Logger.log("Completed Successfully");
    Logger.log("Finished: " + end);
    Logger.log(
      "Elapsed: " +
      ((end - start) / 1000).toFixed(2) +
      " seconds"
    );

  }
  catch (err) {

    Logger.log("====================================");
    Logger.log("ERROR");
    Logger.log(err);
    Logger.log("====================================");

    throw err;

  }

  Logger.log("====================================");

}

function onFormSubmit(e) {

  rebuildEverything();

  if (typeof publishLatestGameSubmittedAutomationEvent === "function")
    publishLatestGameSubmittedAutomationEvent();

}

function runLeague() {

  rebuildEverything();

}

function runStandings() {

  clearPortalCache();

  clearLeagueData();

  loadLeagueData();

  rebuildStandings();

}

function runGameEngine() {

  clearPortalCache();

  rebuildGameEngine();

}

function runPlayerAnalytics() {

  clearPortalCache();

  clearLeagueData();

  loadLeagueData();

  rebuildPlayerAnalytics();

}

function runFactionAnalytics() {

  clearPortalCache();

  clearLeagueData();

  loadLeagueData();

  rebuildFactionAnalytics();

}

function runMissionAnalytics() {

  clearPortalCache();

  clearLeagueData();

  loadLeagueData();

  rebuildMissionAnalytics();

}

function onEdit(e) {

  const sheetName =
    e &&
    e.range &&
    e.range.getSheet
      ? e.range.getSheet().getName()
      : "";

  if (
    sheetName === CONFIG.SHEETS.SETTINGS ||
    sheetName === CONFIG.SHEETS.STREAMS
  )
    clearPortalCache();

  if (isCanonicalGamesEdit_(e))
    markCanonicalRebuildRequired_({
      reason: "manual-authoritative-games-edit",
      targetRow: Math.max(2, e.range.getRow()),
      workflow: "manual-edit"
    });

}

function isCanonicalGamesEdit_(e) {

  if (
    !e ||
    !e.range ||
    !e.range.getSheet ||
    e.range.getSheet().getName() !== CONFIG.SHEETS.FORM
  )
    return false;

  const firstDataRow = 2;
  const firstCanonicalColumn = 1;
  const lastCanonicalColumn = FORM.LOSER_ARMY_LIST_ID + 1;
  const firstEditedRow = Number(e.range.getRow()) || 0;
  const lastEditedRow = firstEditedRow + Math.max(1, Number(e.range.getNumRows()) || 1) - 1;
  const firstEditedColumn = Number(e.range.getColumn()) || 0;
  const lastEditedColumn = firstEditedColumn + Math.max(1, Number(e.range.getNumColumns()) || 1) - 1;

  return (
    lastEditedRow >= firstDataRow &&
    lastEditedColumn >= firstCanonicalColumn &&
    firstEditedColumn <= lastCanonicalColumn
  );

}
