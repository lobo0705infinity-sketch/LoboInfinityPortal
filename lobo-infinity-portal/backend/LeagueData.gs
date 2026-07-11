/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * LeagueData.gs
 *
 *******************************************************/

let LeagueData = null;
let LeagueDataHeaders = null;

function loadLeagueData() {

  let timer =
    startDashboardEndpointSubStage(
      "dashboard.leagueData.spreadsheet.getActiveAndSheetLookup"
    );

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.ENGINE);

  endDashboardEndpointSubStage(
    "dashboard.leagueData.spreadsheet.getActiveAndSheetLookup",
    timer,
    {
      sheet: CONFIG.SHEETS.ENGINE
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.leagueData.getDataRange.getValues"
    );

  const values =
    sheet
      .getDataRange()
      .getValues();

  endDashboardEndpointSubStage(
    "dashboard.leagueData.getDataRange.getValues",
    timer,
    {
      sheet: CONFIG.SHEETS.ENGINE,
      rows: values.length
    }
  );

  LeagueDataHeaders =
    values.shift() || [];

  LeagueData = values;

  Logger.log(
    LeagueData.length +
    " player records loaded."
  );

}
function getLeagueData() {

  if (LeagueData === null) {

    loadLeagueData();

  }

  return LeagueData;

}
function getLeagueDataForEvent(eventId) {

  let timer =
    startDashboardEndpointSubStage(
      "dashboard.leagueData.resolveEventScope"
    );

  const scope =
    resolveLeagueEventScope(eventId);

  endDashboardEndpointSubStage(
    "dashboard.leagueData.resolveEventScope",
    timer,
    {
      eventId: eventId || "",
      scope: scope
    }
  );

  if (
    scope === "all" ||
    scope === "lifetime"
  )
    return getLeagueData();

  timer =
    startDashboardEndpointSubStage(
      "dashboard.leagueData.eventColumn"
    );

  const eventColumn =
    getLeagueDataEventColumn();

  endDashboardEndpointSubStage(
    "dashboard.leagueData.eventColumn",
    timer,
    {
      eventColumn: eventColumn
    }
  );

  const games =
    getLeagueData();

  timer =
    startDashboardEndpointSubStage(
      "dashboard.leagueData.filterByEvent"
    );

  const filtered =
    games
    .filter(function(row) {
      const rowEventId =
        getLeagueDataString(
          eventColumn === -1
            ? ""
            : row[eventColumn]
        ) || EVENT_ENGINE_DEFAULT_EVENT_ID;

      return rowEventId === scope;
    });

  endDashboardEndpointSubStage(
    "dashboard.leagueData.filterByEvent",
    timer,
    {
      inputRows: games.length,
      outputRows: filtered.length,
      scope: scope
    }
  );

  return filtered;

}
function clearLeagueData() {

  LeagueData = null;
  LeagueDataHeaders = null;

}

function getLeagueDataEventColumn() {

  if (LeagueDataHeaders === null)
    getLeagueData();

  return getLeagueDataHeaderIndex("Event ID");

}

function getLeagueDataHeaderIndex(label) {

  if (!LeagueDataHeaders)
    return -1;

  return LeagueDataHeaders
    .map(getLeagueDataString)
    .indexOf(label);

}

function resolveLeagueEventScope(eventId) {

  const value =
    getLeagueDataString(eventId);

  if (
    value.toLowerCase() === "all" ||
    value.toLowerCase() === "lifetime"
  )
    return value.toLowerCase();

  if (value !== "")
    return value;

  if (typeof resolveEventId === "function")
    return resolveEventId("");

  return "event-current-league";

}

function getLeagueDataString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
