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

    // rebuildDashboard();

    SpreadsheetApp.flush();

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

}

function runLeague() {

  rebuildEverything();

}

function runStandings() {

  clearLeagueData();

  loadLeagueData();

  rebuildStandings();

}

function runGameEngine() {

  rebuildGameEngine();

}

function runPlayerAnalytics() {

  clearLeagueData();

  loadLeagueData();

  rebuildPlayerAnalytics();

}

function runFactionAnalytics() {

  clearLeagueData();

  loadLeagueData();

  rebuildFactionAnalytics();

}

function runMissionAnalytics() {

  clearLeagueData();

  loadLeagueData();

  rebuildMissionAnalytics();

}
