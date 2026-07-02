/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * Main.gs
 *
 * Master Controller
 *
 *******************************************************/


/**
 * Master Rebuild
 */
function rebuildEverything() {

  const start = new Date();

  Logger.log("====================================");
  Logger.log("LOBO INFINITY LEAGUE REBUILD");
  Logger.log("Started: " + start);

  try {

    /***************************************************
     * Clear Cached Data
     ***************************************************/
    clearLeagueData();

    /***************************************************
     * Build Game Engine
     ***************************************************/
    rebuildGameEngine();

    /***************************************************
     * Reload Fresh Game Engine
     ***************************************************/
    clearLeagueData();
    loadLeagueData();

    /***************************************************
     * Build Standings
     ***************************************************/
    rebuildStandings();

    /***************************************************
     * Build Player Analytics
     ***************************************************/
    rebuildPlayerAnalytics();

    /***************************************************
     * Build Faction Analytics
     ***************************************************/
    rebuildFactionAnalytics();

    /***************************************************
     * Build Mission Analytics
     ***************************************************/
    rebuildMissionAnalytics();

    /***************************************************
     * Future Modules
     ***************************************************/
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


/**
 * Trigger
 *
 * Automatically runs whenever a new Google Form
 * response is submitted.
 */
function onFormSubmit(e) {

  rebuildEverything();

}


/**
 * Manual Run
 */
function runLeague() {

  rebuildEverything();

}


/**
 * Rebuild Standings Only
 */
function runStandings() {

  clearLeagueData();

  loadLeagueData();

  rebuildStandings();

}


/**
 * Rebuild Game Engine Only
 */
function runGameEngine() {

  rebuildGameEngine();

}


/**
 * Rebuild Player Analytics Only
 */
function runPlayerAnalytics() {

  clearLeagueData();

  loadLeagueData();

  rebuildPlayerAnalytics();

}


/**
 * Rebuild Faction Analytics Only
 */
function runFactionAnalytics() {

  clearLeagueData();

  loadLeagueData();

  rebuildFactionAnalytics();

}


/**
 * Rebuild Mission Analytics Only
 */
function runMissionAnalytics() {

  clearLeagueData();

  loadLeagueData();

  rebuildMissionAnalytics();

}