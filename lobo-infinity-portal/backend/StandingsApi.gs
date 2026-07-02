/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * StandingsApi.gs
 *
 * Live standings API endpoint.
 *******************************************************/

function getStandings(e) {

  const divisionConfig =
    getStandingsDivisionConfig(
      e &&
      e.parameter &&
      e.parameter.division
    );

  if (!divisionConfig)
    return jsonOutput({
      success: false,
      error: "Unknown division."
    });

  return jsonOutput(
    buildStandingsResponse(
      divisionConfig
    )
  );

}

function buildStandingsResponse(divisionConfig) {

  const registry =
    buildPlayerRegistry();

  updateRegistryStatistics(registry);

  const rows =
    buildDivisionTable(
      registry,
      divisionConfig.label
    );

  const standings =
    standingsRowsToObjects(rows);

  return {
    success: true,
    division: divisionConfig.key,
    divisionLabel: divisionConfig.label,
    standings: standings,
    summary:
      buildStandingsSummary(
        standings
      )
  };

}

function standingsRowsToObjects(rows) {

  return rows
    .slice(1)
    .map(function(row) {

      return {
        rank: row[CONFIG.STANDINGS.RANK],
        player: row[CONFIG.STANDINGS.PLAYER],
        games: row[CONFIG.STANDINGS.GAMES],
        wins: row[CONFIG.STANDINGS.WINS],
        losses: row[CONFIG.STANDINGS.LOSSES],
        tp: row[CONFIG.STANDINGS.TP],
        op: row[CONFIG.STANDINGS.OP],
        vp: row[CONFIG.STANDINGS.VP]
      };

    });

}

function buildStandingsSummary(standings) {

  let gamesPlayed = 0;
  let activePlayers = 0;

  standings.forEach(function(player) {

    gamesPlayed +=
      Number(player.games) || 0;

    if ((Number(player.games) || 0) > 0)
      activePlayers++;

  });

  return {
    leader:
      standings.length > 0
        ? standings[0]
        : null,
    players: standings.length,
    gamesPlayed: Math.floor(gamesPlayed / 2),
    activePlayers: activePlayers
  };

}

function getStandingsDivisionConfig(value) {

  const key =
    value
      ? String(value).toLowerCase()
      : "main";

  switch (key) {

    case "main":
      return {
        key: "main",
        label: CONFIG.DIVISIONS.MAIN_MAN
      };

    case "pga":
      return {
        key: "pga",
        label: CONFIG.DIVISIONS.PGA
      };

    case "pgb":
      return {
        key: "pgb",
        label: CONFIG.DIVISIONS.PGB
      };

    default:
      return null;

  }

}
