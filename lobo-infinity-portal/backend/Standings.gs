/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * Standings.gs
 *
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

function updateRegistryStatistics(registry, eventId) {

  const games =
    typeof getLeagueDataForEvent === "function"
      ? getLeagueDataForEvent(eventId)
      : getLeagueData();

  games.forEach(function(game) {

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

function getDivisionPlayers(
  registry,
  division
) {

  return Object
    .values(registry)
    .filter(function(player) {

      return (
        player.division === division
      );

    });

}

function sortStandings(players) {

  players.sort(function(a, b) {

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

function buildDivisionTable(registry, division) {

  const players =
    getDivisionPlayers(
      registry,
      division
    );

  sortStandings(players);

  return standingsToRows(players);

}

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

function testStandings() {

  clearLeagueData();

  loadLeagueData();

  rebuildStandings();

}
