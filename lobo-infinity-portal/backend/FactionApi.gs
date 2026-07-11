/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * FactionApi.gs
 *
 * Faction list and faction profile API endpoints.
 *******************************************************/

const FACTION_PROFILE_RECENT_GAMES_LIMIT = 5;
const FACTION_PROFILE_BEST_MOMENTS_LIMIT = 5;

function getFactions(e) {

  const context =
    buildEventAnalyticsContext(e);

  return jsonOutput({
    success: true,
    eventId: context.eventId,
    event: context.event,
    factions: getEventAnalyticsFactions(context)
  });

}

function getFaction(e) {

  const context =
    buildEventAnalyticsContext(e);

  const requestedName =
    getFactionRequestName(e);

  if (!requestedName)
    return jsonOutput({
      success: false,
      error: "Missing faction name."
    });

  const eventProfile =
    getEventAnalyticsFactionProfile(
      context,
      requestedName
    );

  if (eventProfile)
    return eventProfile;

  const summaries =
    buildFactionApiSummaries();

  const faction =
    findFactionSummary(
      summaries,
      requestedName
    );

  if (!faction)
    return jsonOutput({
      success: false,
      error: "Faction not found."
    });

  const factionGames =
    getFactionEngineGames(
      faction.name
    );

  const recentGames =
    getFactionRecentGames(
      faction.name
    );

  const armyLists =
    getFactionArmyLists(
      faction.name
    );

  const matchups =
    getFactionMatchups(
      faction.name
    );

  return jsonOutput({
    success: true,
    faction: {
      name: faction.name,
      games: faction.games,
      wins: faction.wins,
      losses: faction.losses,
      winRate: faction.winRate,
      averageTP: faction.averageTP,
      averageOP: faction.averageOP,
      averageVP: faction.averageVP,
      topPlayer: faction.topPlayer,
      topPlayerDisplayName:
        getPlayerDisplayName(faction.topPlayer),
      lastPlayed: faction.lastPlayed,
      mostPlayedMission:
        getFactionMostPlayedMission(
          factionGames
        ),
      divisionBreakdown:
        getFactionDivisionBreakdownCounts(
          factionGames
        ),
      recentGames: recentGames,
      bestMoments:
        getFactionBestMoments(
          recentGames
        ),
      matchups:
        matchups.rows,
      matchupSummary:
        matchups.overall,
      armyLists:
        armyLists
    }
  });

}

function buildFactionApiSummaries() {

  const registry =
    buildFactionRegistry();

  updateFactionRegistry(
    registry
  );

  const factions =
    Object.values(registry);

  sortFactions(
    factions
  );

  return factions.map(function(faction) {

    const games =
      getFactionEngineGames(
        faction.faction
      );

    return buildFactionApiSummary(
      faction,
      games
    );

  });

}

function buildFactionApiSummary(
  faction,
  games
) {

  return {
    name: faction.faction,
    games: faction.games,
    wins: faction.wins,
    losses: faction.losses,
    winRate:
      getFactionWinRate(
        faction
      ),
    averageTP:
      getFactionAverage(
        faction.tp,
        faction.games
      ),
    averageOP:
      getFactionAverage(
        faction.op,
        faction.games
      ),
    averageVP:
      getFactionAverage(
        faction.vp,
        faction.games
      ),
    topPlayer:
      getFactionTopPlayer(
        games
      ),
    topPlayerDisplayName:
      getPlayerDisplayName(
        getFactionTopPlayer(
          games
        )
      ),
    lastPlayed:
      getFactionLastPlayed(
        games
      ),
    divisionBreakdown:
      getFactionDivisionBreakdown(
        games
      )
  };

}

function getFactionRequestName(e) {

  if (
    !e ||
    !e.parameter ||
    !e.parameter.name
  )
    return "";

  return String(e.parameter.name)
    .trim();

}

function findFactionSummary(
  factions,
  requestedName
) {

  const normalizedName =
    requestedName.toLowerCase();

  for (
    let index = 0;
    index < factions.length;
    index++
  ) {

    if (
      factions[index].name.toLowerCase() ===
      normalizedName
    )
      return factions[index];

  }

  return null;

}

function getFactionEngineGames(factionName) {

  return getLeagueData()
    .filter(function(game) {

      return (
        String(
          game[CONFIG.ENGINE.FACTION]
        ).trim() === factionName
      );

    });

}

function getFactionWinRate(faction) {

  if (faction.games === 0)
    return 0;

  return roundFaction(
    (faction.wins / faction.games) * 100
  );

}

function getFactionAverage(total, games) {

  if (games === 0)
    return 0;

  return roundFaction(
    total / games
  );

}

function getFactionTopPlayer(games) {

  const players = {};

  games.forEach(function(game) {

    const player =
      String(
        game[CONFIG.ENGINE.PLAYER]
      ).trim();

    if (!player)
      return;

    if (!players[player])
      players[player] = [];

    players[player].push(
      game
    );

  });

  let topPlayer = "";
  let topWins = -1;
  let topTP = -1;
  let topOP = -1;
  let topVP = -1;

  for (const player in players) {

    const record =
      RECORD(
        players[player]
      );

    const totalTP =
      getFactionTotal(
        players[player],
        CONFIG.ENGINE.TP
      );

    const totalOP =
      getFactionTotal(
        players[player],
        CONFIG.ENGINE.OP
      );

    const totalVP =
      getFactionTotal(
        players[player],
        CONFIG.ENGINE.VP
      );

    if (
      record.wins > topWins ||
      (
        record.wins === topWins &&
        totalTP > topTP
      ) ||
      (
        record.wins === topWins &&
        totalTP === topTP &&
        totalOP > topOP
      ) ||
      (
        record.wins === topWins &&
        totalTP === topTP &&
        totalOP === topOP &&
        totalVP > topVP
      )
    ) {

      topPlayer = player;
      topWins = record.wins;
      topTP = totalTP;
      topOP = totalOP;
      topVP = totalVP;

    }

  }

  return topPlayer;

}

function getFactionTotal(
  games,
  column
) {

  return games.reduce(function(total, game) {

    return total + (
      Number(
        game[column]
      ) || 0
    );

  }, 0);

}

function getFactionLastPlayed(games) {

  let latestDate = null;

  games.forEach(function(game) {

    const date =
      getRecentGameDate(
        game[CONFIG.ENGINE.DATE]
      );

    if (
      latestDate === null ||
      date.getTime() > latestDate.getTime()
    )
      latestDate = date;

  });

  if (latestDate === null)
    return "";

  return Utilities.formatDate(
    latestDate,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

}

function getFactionDivisionBreakdown(games) {

  const divisions = {};

  games.forEach(function(game) {

    const division =
      String(
        game[CONFIG.ENGINE.DIVISION]
      ).trim();

    if (!division)
      return;

    if (!divisions[division])
      divisions[division] = 0;

    divisions[division]++;

  });

  return Object.keys(divisions)
    .sort()
    .map(function(division) {

      return {
        division: division,
        games: divisions[division]
      };

    });

}

function getFactionDivisionBreakdownCounts(games) {

  const breakdown = {
    mainMan: 0,
    provingGroundsA: 0,
    provingGroundsB: 0
  };

  games.forEach(function(game) {

    const division =
      String(
        game[CONFIG.ENGINE.DIVISION]
      ).trim();

    switch (division) {

      case CONFIG.DIVISIONS.MAIN_MAN:
        breakdown.mainMan++;
        break;

      case CONFIG.DIVISIONS.PGA:
        breakdown.provingGroundsA++;
        break;

      case CONFIG.DIVISIONS.PGB:
        breakdown.provingGroundsB++;
        break;

    }

  });

  return breakdown;

}

function getFactionMostPlayedMission(games) {

  const mission =
    MOSTCOMMON(
    games.map(function(game) {

      return game[CONFIG.ENGINE.MISSION];

    })
  );

  if (!mission)
    return "";

  if (
    typeof mission === "object" &&
    mission.value
  )
    return mission.value;

  return String(mission);

}

function getFactionRecentGames(factionName) {

  const games =
    getAllRecentGameObjects()
      .filter(function(game) {

        return (
          game.winnerFaction === factionName ||
          game.loserFaction === factionName
        );

      })
      .slice(
        0,
        FACTION_PROFILE_RECENT_GAMES_LIMIT
      );

  return games;

}

function getFactionBestMoments(games) {

  return games
    .filter(function(game) {

      return game.bestMoment !== "";

    })
    .slice(
      0,
      FACTION_PROFILE_BEST_MOMENTS_LIMIT
    )
    .map(function(game) {

      return {
        gameId: game.id,
        date: game.date,
        mission: game.mission,
        moment: game.bestMoment
      };

    });

}

function getAllRecentGameObjects() {

  const sheet =
    measureEventHomeOperationIfAvailable(
      "eventHome.sheetLookup.gameAnalytics",
      function() {
        return SpreadsheetApp
          .getActive()
          .getSheetByName(CONFIG.SHEETS.GAME_ANALYTICS);
      },
      {
        sheet: CONFIG.SHEETS.GAME_ANALYTICS
      }
    );

  if (!sheet)
    return [];

  const values =
    measureEventHomeOperationIfAvailable(
      "eventHome.sheetRead.gameAnalytics.getDataRange.getValues",
      function() {
        return sheet
          .getDataRange()
          .getValues();
      },
      {
        sheet: CONFIG.SHEETS.GAME_ANALYTICS
      }
    );

  if (values.length <= 1)
    return [];

  const headers =
    values.shift();

  const columns =
    getRecentGameColumns(
      headers
    );

  return measureEventHomeOperationIfAvailable(
    "eventHome.recentGames.transformAll",
    function() {
      return values
        .map(function(row, index) {

          return buildRecentGame(
            row,
            index + 1,
            columns
          );

        })
        .filter(function(game) {

          return (
            game.date !== "" &&
            game.winner !== "" &&
            game.loser !== ""
          );

        })
        .sort(function(a, b) {

          const dateOrder =
            b.sortDate.getTime() -
            a.sortDate.getTime();

          if (dateOrder !== 0)
            return dateOrder;

          return (
            b.sourceIndex -
            a.sourceIndex
          );

        })
        .map(function(game, index) {

          return buildRecentGameResponse(game, index + 1);

        });
    },
    {
      rows: values.length
    }
  );

}
