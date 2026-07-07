/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * Dashboard.gs
 *
 * Dashboard and leader API response builders.
 *******************************************************/

function getDashboard() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const standings =
    ss.getSheetByName(CONFIG.SHEETS.MAIN_MAN);

  const factions =
    ss.getSheetByName(CONFIG.SHEETS.FACTION_ANALYTICS);

  if (!standings) {

    return jsonOutput({
      success: false,
      error: "Main Man Standings not found."
    });

  }

  const leader =
    standings
      .getRange(2, 1, 1, 8)
      .getValues()[0];

  const values =
    standings
      .getRange(2, 1, standings.getLastRow() - 1, 8)
      .getValues();

  let gamesPlayed = 0;
  let activePlayers = 0;
  const mainManStandings = [];

  values.forEach(function(r) {

    gamesPlayed +=
      Number(r[CONFIG.STANDINGS.GAMES]);

    if (Number(r[CONFIG.STANDINGS.GAMES]) > 0)
      activePlayers++;

    mainManStandings.push({
      rank: r[CONFIG.STANDINGS.RANK],
      player: r[CONFIG.STANDINGS.PLAYER],
      displayName:
        getPlayerDisplayName(
          r[CONFIG.STANDINGS.PLAYER]
        ),
      games: r[CONFIG.STANDINGS.GAMES],
      wins: r[CONFIG.STANDINGS.WINS],
      losses: r[CONFIG.STANDINGS.LOSSES],
      tp: r[CONFIG.STANDINGS.TP],
      op: r[CONFIG.STANDINGS.OP],
      vp: r[CONFIG.STANDINGS.VP]
    });

  });

  gamesPlayed =
    Math.floor(gamesPlayed / 2);

  let topFaction = "";

  if (factions && factions.getLastRow() > 1) {

    const f =
      factions
        .getRange(
          2,
          1,
          factions.getLastRow() - 1,
          factions.getLastColumn()
        )
        .getValues();

    if (f.length)
      topFaction = f[0][0];

  }

  return jsonOutput({
    success: true,
    leader: {
      rank: leader[CONFIG.STANDINGS.RANK],
      player: leader[CONFIG.STANDINGS.PLAYER],
      displayName:
        getPlayerDisplayName(
          leader[CONFIG.STANDINGS.PLAYER]
        ),
      games: leader[CONFIG.STANDINGS.GAMES],
      wins: leader[CONFIG.STANDINGS.WINS],
      losses: leader[CONFIG.STANDINGS.LOSSES],
      tp: leader[CONFIG.STANDINGS.TP],
      op: leader[CONFIG.STANDINGS.OP],
      vp: leader[CONFIG.STANDINGS.VP]
    },
    topFaction: topFaction,
    gamesPlayed: gamesPlayed,
    activePlayers: activePlayers,
    mainManStandings: mainManStandings,
    leagueOverview: buildLeagueOverview()
  });

}

function buildLeagueOverview() {

  const main =
    buildStandingsResponse({
      key: "main",
      label: CONFIG.DIVISIONS.MAIN_MAN
    });

  const pga =
    buildStandingsResponse({
      key: "pga",
      label: CONFIG.DIVISIONS.PGA
    });

  const pgb =
    buildStandingsResponse({
      key: "pgb",
      label: CONFIG.DIVISIONS.PGB
    });

  const divisions = [
    main,
    pga,
    pgb
  ];

  let totalLeagueGames = 0;
  let totalActivePlayers = 0;

  divisions.forEach(function(division) {

    totalLeagueGames +=
      division.summary.gamesPlayed;

    totalActivePlayers +=
      division.summary.players;

  });

  return {
    divisions: divisions.map(function(division) {

      return {
        division: division.division,
        divisionLabel: division.divisionLabel,
        players: division.summary.players,
        gamesPlayed: division.summary.gamesPlayed,
        activePlayers: division.summary.activePlayers
      };

    }),
    totalLeagueGames: totalLeagueGames,
    totalActivePlayers: totalActivePlayers
  };

}

function getLeader() {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(CONFIG.SHEETS.MAIN_MAN);

  if (!sheet)
    return jsonOutput({
      success: false,
      error: "Standings sheet not found."
    });

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length < 2)
    return jsonOutput({
      success: false,
      error: "No standings."
    });

  const l = values[1];

  return jsonOutput({
    success: true,
    rank: l[CONFIG.STANDINGS.RANK],
    player: l[CONFIG.STANDINGS.PLAYER],
    displayName:
      getPlayerDisplayName(
        l[CONFIG.STANDINGS.PLAYER]
      ),
    games: l[CONFIG.STANDINGS.GAMES],
    wins: l[CONFIG.STANDINGS.WINS],
    losses: l[CONFIG.STANDINGS.LOSSES],
    tp: l[CONFIG.STANDINGS.TP],
    op: l[CONFIG.STANDINGS.OP],
    vp: l[CONFIG.STANDINGS.VP]
  });

}
