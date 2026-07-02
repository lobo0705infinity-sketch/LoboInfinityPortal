/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * Standings.gs
 *
 * PART 1
 *
 *******************************************************/


/*******************************************************
 * Constants
 *******************************************************/

const STANDINGS_HEADER = [
  [
    "Rank",
    "Player",
    "Games",
    "Wins",
    "Losses",
    "TP",
    "OP",
    "VP"
  ]
];

const PLAYER_COL = {
  NAME: 0,
  DIVISION: 1,
  ACTIVE: 2
};


/*******************************************************
 * Create Empty Player
 *******************************************************/

function createPlayer(name, division) {

  return {

    player: name,

    division: division,

    games: 0,

    wins: 0,

    losses: 0,

    draws: 0,

    tp: 0,

    op: 0,

    vp: 0

  };

}


/*******************************************************
 * Build Registry
 *******************************************************/

function buildPlayerRegistry() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.PLAYERS);

  if (!sheet)
    throw new Error("Players sheet not found.");

  const values =
    sheet
      .getDataRange()
      .getValues();

  values.shift();

  const registry = {};

  values.forEach(function (row) {

    if (row[PLAYER_COL.ACTIVE] !== true)
      return;

    const player =
      row[PLAYER_COL.NAME];

    const division =
      row[PLAYER_COL.DIVISION];

    registry[player] =
      createPlayer(
        player,
        division
      );

  });

  return registry;

}


/*******************************************************
 * Update Registry From Game Engine
 *******************************************************/

function updateRegistryStatistics(registry) {

  const games =
    getLeagueData();

  games.forEach(function (game) {

    const player =
      registry[game[CONFIG.ENGINE.PLAYER]];

    if (!player)
      return;

    player.games++;

    switch (game[CONFIG.ENGINE.RESULT]) {

      case "W":

        player.wins++;
        break;

      case "L":

        player.losses++;
        break;

      default:

        player.draws++;
        break;

    }

    player.tp +=
      Number(
        game[CONFIG.ENGINE.TP]
      ) || 0;

    player.op +=
      Number(
        game[CONFIG.ENGINE.OP]
      ) || 0;

    player.vp +=
      Number(
        game[CONFIG.ENGINE.VP]
      ) || 0;

  });

}


/*******************************************************
 * Get Players For One Division
 *******************************************************/

function getDivisionPlayers(
  registry,
  division
) {

  return Object
    .values(registry)
    .filter(function (player) {

      return (
        player.division === division
      );

    });

}


/*******************************************************
 * Sort Standings
 *******************************************************/

function sortStandings(players) {

  players.sort(function (a, b) {

    if (b.tp !== a.tp)
      return b.tp - a.tp;

    if (b.op !== a.op)
      return b.op - a.op;

    if (b.vp !== a.vp)
      return b.vp - a.vp;

    return a.player.localeCompare(
      b.player
    );

  });

}

/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * Standings.gs
 *
 * PART 2
 * Output Engine
 *
 *******************************************************/


/*******************************************************
 * Convert Players To Spreadsheet Rows
 *******************************************************/
function standingsToRows(players) {

  const rows = [...STANDINGS_HEADER];

  players.forEach(function(player, index) {

    rows.push([
      index + 1,
      player.player,
      player.games,
      player.wins,
      player.losses,
      player.tp,
      player.op,
      player.vp
    ]);

  });

  return rows;

}


/*******************************************************
 * Build One Division Table
 *******************************************************/
function buildDivisionTable(registry, division) {

  const players =
    getDivisionPlayers(
      registry,
      division
    );

  sortStandings(players);

  return standingsToRows(players);

}


/*******************************************************
 * Write One Standings Sheet
 *******************************************************/
function writeStandingsSheet(sheetName, rows) {

  const ss =
    SpreadsheetApp.getActive();

  const sheet =
    ss.getSheetByName(sheetName);

  if (!sheet)
    throw new Error(
      "Sheet not found: " + sheetName
    );

  sheet.clearContents();

  sheet
    .getRange(
      1,
      1,
      rows.length,
      rows[0].length
    )
    .setValues(rows);

}


/*******************************************************
 * Rebuild Standings
 *******************************************************/
function rebuildStandings() {

  Logger.log("Building Standings...");

  const registry =
    buildPlayerRegistry();

  updateRegistryStatistics(registry);

  writeStandingsSheet(

    CONFIG.SHEETS.MAIN_MAN,

    buildDivisionTable(
      registry,
      CONFIG.DIVISIONS.MAIN_MAN
    )

  );

  writeStandingsSheet(

    CONFIG.SHEETS.PGA,

    buildDivisionTable(
      registry,
      CONFIG.DIVISIONS.PGA
    )

  );

  writeStandingsSheet(

    CONFIG.SHEETS.PGB,

    buildDivisionTable(
      registry,
      CONFIG.DIVISIONS.PGB
    )

  );

  Logger.log("Standings Complete.");

}


/*******************************************************
 * Test Standings
 *******************************************************/
function testStandings() {

  clearLeagueData();

  loadLeagueData();

  rebuildStandings();

}