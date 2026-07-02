/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * RecordsApi.gs
 *
 * Hall of Fame, records, and comparison API endpoints.
 *******************************************************/

const HALL_OF_FAME_LIMIT = 10;

function getRecords() {

  const games =
    getAllRecentGameObjects();

  return jsonOutput({
    success: true,
    records:
      getLeagueRecords(
        games
      )
  });

}

function getHallOfFame() {

  const standings =
    getHallOfFameStandings();

  const games =
    getAllRecentGameObjects();

  return jsonOutput({
    success: true,
    leaders: {
      tournamentPoints:
        getHallOfFameLeaders(
          standings,
          "tp"
        ),
      objectivePoints:
        getHallOfFameLeaders(
          standings,
          "op"
        ),
      victoryPoints:
        getHallOfFameLeaders(
          standings,
          "vp"
        ),
      wins:
        getHallOfFameLeaders(
          standings,
          "wins"
        ),
      games:
        getHallOfFameLeaders(
          standings,
          "games"
        )
    },
    records:
      getLeagueRecords(
        games
      )
  });

}

function getPlayerComparison(e) {

  const leftName =
    getComparisonParameter(
      e,
      "left"
    );

  const rightName =
    getComparisonParameter(
      e,
      "right"
    );

  if (
    !leftName ||
    !rightName
  )
    return jsonOutput({
      success: false,
      error: "Missing comparison players."
    });

  const registry =
    buildPlayerRegistry();

  const leftPlayer =
    findRegisteredPlayer(
      registry,
      leftName
    );

  const rightPlayer =
    findRegisteredPlayer(
      registry,
      rightName
    );

  if (
    !leftPlayer ||
    !rightPlayer
  )
    return jsonOutput({
      success: false,
      error: "One or both players could not be found."
    });

  updateRegistryStatistics(
    registry
  );

  const leftStanding =
    getPlayerStanding(
      registry,
      leftPlayer
    );

  const rightStanding =
    getPlayerStanding(
      registry,
      rightPlayer
    );

  return jsonOutput({
    success: true,
    players: [
      buildComparisonPlayer(
        leftPlayer,
        leftStanding
      ),
      buildComparisonPlayer(
        rightPlayer,
        rightStanding
      )
    ],
    headToHead:
      getComparisonHeadToHead(
        leftPlayer.player,
        rightPlayer.player
      )
  });

}

function getHallOfFameStandings() {

  return [
    getStandingsDivisionConfig("main"),
    getStandingsDivisionConfig("pga"),
    getStandingsDivisionConfig("pgb")
  ].flatMap(function(config) {

    const response =
      buildStandingsResponse(
        config
      );

    return response.standings
      .map(function(player) {

        return {
          division: response.divisionLabel,
          player: player.player,
          rank: player.rank,
          games: player.games,
          wins: player.wins,
          losses: player.losses,
          tp: player.tp,
          op: player.op,
          vp: player.vp
        };

      });

  });

}

function getHallOfFameLeaders(
  standings,
  key
) {

  return standings
    .slice()
    .sort(function(a, b) {

      if (b[key] !== a[key])
        return b[key] - a[key];

      if (b.tp !== a.tp)
        return b.tp - a.tp;

      if (b.op !== a.op)
        return b.op - a.op;

      if (b.vp !== a.vp)
        return b.vp - a.vp;

      return a.player.localeCompare(
        b.player
      );

    })
    .slice(0, HALL_OF_FAME_LIMIT);

}

function getComparisonParameter(
  e,
  key
) {

  if (
    !e ||
    !e.parameter ||
    !e.parameter[key]
  )
    return "";

  return String(e.parameter[key])
    .trim();

}

function buildComparisonPlayer(
  player,
  standing
) {

  return {
    name: player.player,
    division: player.division,
    rank: standing.rank,
    games: standing.games,
    wins: standing.wins,
    losses: standing.losses,
    tp: standing.tp,
    op: standing.op,
    vp: standing.vp,
    favoriteFaction:
      FAVORITEFACTION(
        player.player
      ),
    favoriteMission:
      FAVORITEMISSION(
        player.player
      ),
    bestFaction:
      BESTFACTION(
        player.player
      )
  };

}

function getComparisonHeadToHead(
  leftName,
  rightName
) {

  const games =
    getLeagueData()
      .filter(function(game) {

        const player =
          String(
            game[CONFIG.ENGINE.PLAYER]
          ).trim();

        const opponent =
          String(
            game[CONFIG.ENGINE.OPPONENT]
          ).trim();

        return (
          (
            player === leftName &&
            opponent === rightName
          ) ||
          (
            player === rightName &&
            opponent === leftName
          )
        );

      });

  const leftWins =
    games.filter(function(game) {

      return (
        String(
          game[CONFIG.ENGINE.PLAYER]
        ).trim() === leftName &&
        game[CONFIG.ENGINE.RESULT] === "W"
      );

    }).length;

  const rightWins =
    games.filter(function(game) {

      return (
        String(
          game[CONFIG.ENGINE.PLAYER]
        ).trim() === rightName &&
        game[CONFIG.ENGINE.RESULT] === "W"
      );

    }).length;

  return {
    games: games.length / 2,
    leftWins: leftWins,
    rightWins: rightWins
  };

}
