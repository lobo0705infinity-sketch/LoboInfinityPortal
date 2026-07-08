/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * LeagueData.gs
 *
 *******************************************************/

let LeagueData = null;
let LeagueDataHeaders = null;

function loadLeagueData() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.ENGINE);

  const values =
    sheet
      .getDataRange()
      .getValues();

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

  const scope =
    resolveLeagueEventScope(eventId);

  if (
    scope === "all" ||
    scope === "lifetime"
  )
    return getLeagueData();

  const eventColumn =
    getLeagueDataEventColumn();

  return getLeagueData()
    .filter(function(row) {
      const rowEventId =
        getLeagueDataString(
          eventColumn === -1
            ? ""
            : row[eventColumn]
        ) || EVENT_ENGINE_DEFAULT_EVENT_ID;

      return rowEventId === scope;
    });

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
