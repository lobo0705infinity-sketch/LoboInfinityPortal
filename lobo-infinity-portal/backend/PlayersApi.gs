/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * PlayersApi.gs
 *
 * Player profile API endpoint.
 *******************************************************/

function getPlayers() {

  return jsonOutput({
    success: true,
    divisions: [
      buildStandingsResponse(
        getStandingsDivisionConfig("main")
      ),
      buildStandingsResponse(
        getStandingsDivisionConfig("pga")
      ),
      buildStandingsResponse(
        getStandingsDivisionConfig("pgb")
      )
    ]
  });

}

function getPlayer(e) {

  const requestedName =
    getPlayerRequestName(e);

  if (!requestedName)
    return jsonOutput({
      success: false,
      error: "Missing player name."
    });

  const registry =
    buildPlayerRegistry();

  const registeredPlayer =
    findRegisteredPlayer(
      registry,
      requestedName
    );

  if (!registeredPlayer)
    return jsonOutput({
      success: false,
      error: "Player not found."
    });

  updateRegistryStatistics(registry);

  const standing =
    getPlayerStanding(
      registry,
      registeredPlayer
    );

  const firstTurnGames =
    FIRSTTURNGAMES(
      registeredPlayer.player
    );

  const secondTurnGames =
    SECONDTURNGAMES(
      registeredPlayer.player
    );

  return jsonOutput({

    success: true,

    player: {

      name: registeredPlayer.player,

      division: registeredPlayer.division,

      rank: standing.rank,

      games: standing.games,

      wins: standing.wins,

      losses: standing.losses,

      tp: standing.tp,

      op: standing.op,

      vp: standing.vp,

      favoriteFaction:
        FAVORITEFACTION(
          registeredPlayer.player
        ),

      favoriteMission:
        FAVORITEMISSION(
          registeredPlayer.player
        ),

      firstTurnGames:
        firstTurnGames.length,

      secondTurnGames:
        secondTurnGames.length,

      firstTurnWinRate:
        getPlayerWinRate(
          firstTurnGames
        ),

      secondTurnWinRate:
        getPlayerWinRate(
          secondTurnGames
        ),

      bestFaction:
        BESTFACTION(
          registeredPlayer.player
        ),

      rival:
        RIVAL(
          registeredPlayer.player
        ),

      nemesis:
        NEMESIS(
          registeredPlayer.player
        )

    }

  });

}

function getPlayerRequestName(e) {

  if (
    !e ||
    !e.parameter ||
    !e.parameter.name
  )
    return "";

  return String(e.parameter.name)
    .trim();

}

function findRegisteredPlayer(
  registry,
  requestedName
) {

  if (registry[requestedName])
    return registry[requestedName];

  const normalizedName =
    requestedName.toLowerCase();

  for (const playerName in registry) {

    if (
      playerName.toLowerCase() ===
      normalizedName
    )
      return registry[playerName];

  }

  return null;

}

function getPlayerStanding(
  registry,
  player
) {

  const rows =
    buildDivisionTable(
      registry,
      player.division
    );

  for (
    let rowIndex = 1;
    rowIndex < rows.length;
    rowIndex++
  ) {

    const row =
      rows[rowIndex];

    if (
      row[CONFIG.STANDINGS.PLAYER] !==
      player.player
    )
      continue;

    return {
      rank:
        getPlayerNumber(
          row[CONFIG.STANDINGS.RANK]
        ),
      games:
        getPlayerNumber(
          row[CONFIG.STANDINGS.GAMES]
        ),
      wins:
        getPlayerNumber(
          row[CONFIG.STANDINGS.WINS]
        ),
      losses:
        getPlayerNumber(
          row[CONFIG.STANDINGS.LOSSES]
        ),
      tp:
        getPlayerNumber(
          row[CONFIG.STANDINGS.TP]
        ),
      op:
        getPlayerNumber(
          row[CONFIG.STANDINGS.OP]
        ),
      vp:
        getPlayerNumber(
          row[CONFIG.STANDINGS.VP]
        )
    };

  }

  return {
    rank: 0,
    games: player.games,
    wins: player.wins,
    losses: player.losses,
    tp: player.tp,
    op: player.op,
    vp: player.vp
  };

}

function getPlayerWinRate(games) {

  if (games.length === 0)
    return 0;

  return Math.round(
    RECORD(games).pct * 100
  );

}

function getPlayerNumber(value) {

  return Number(value) || 0;

}
