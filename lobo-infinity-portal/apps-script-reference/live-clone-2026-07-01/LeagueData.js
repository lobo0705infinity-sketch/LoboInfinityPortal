/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * LeagueData.gs
 *
 *******************************************************/

let LeagueData = null;

function loadLeagueData() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.ENGINE);

  const values =
    sheet
      .getDataRange()
      .getValues();

  values.shift();

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
function clearLeagueData() {

  LeagueData = null;

}