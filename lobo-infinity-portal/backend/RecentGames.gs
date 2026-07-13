/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * RecentGames.gs
 *
 * Recent games API endpoint.
 *******************************************************/

const RECENT_GAMES_LIMIT = 10;

const RECENT_GAME_ANALYTICS_COLUMNS = {
  DATE_PLAYED: "Date Played",
  DIVISION: "Division",
  MISSION: "Mission",
  WINNER: "Winner",
  LOSER: "Loser",
  WINNING_FACTION: "Winning Faction",
  LOSING_FACTION: "Losing Faction",
  WINNER_TP: "Winner TP",
  LOSER_TP: "Loser TP",
  WINNER_OP: "Winner OP",
  LOSER_OP: "Loser OP",
  WINNER_VP: "Winner VP",
  LOSER_VP: "Loser VP",
  BEST_MOMENT: "Best Moment",
  FIRST_TURN: "First Turn",
  FIRST_TURN_WINNER: "First Turn Winner",
  EVENT_ID: "Event ID",
  GAME_TYPE: "Game Type"
};

function getRecentGames(e) {

  const requestedGameId =
    e &&
    e.parameter &&
    Number(e.parameter.gameId);

  if (
    Number.isInteger(requestedGameId) &&
    typeof getAllRecentGameObjects === "function"
  )
    return jsonOutput({
      success: true,
      games:
        getAllRecentGameObjects()
          .filter(function(game) {
            return game.id === requestedGameId;
          })
    });

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.GAME_ANALYTICS);

  if (!sheet)
    return jsonOutput({
      success: true,
      games: []
    });

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return jsonOutput({
      success: true,
      games: []
    });

  const headers =
    values.shift();

  const columns =
    getRecentGameColumns(headers);

  const games =
    filterRecentGamesByGameId(
      filterRecentGamesByEvent(
      filterRecentGamesByPlayer(
      values
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

      }),
      e &&
      e.parameter &&
      e.parameter.playerName
      ),
      e &&
      e.parameter &&
      e.parameter.eventId,
      e &&
      e.parameter &&
      e.parameter.gameType
      ),
      e &&
      e.parameter &&
      e.parameter.gameId
    )
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
      .slice(0, RECENT_GAMES_LIMIT)
      .map(function(game) {

        return buildRecentGameResponse(game);

      });

  return jsonOutput({
    success: true,
    games: games
  });

}

function filterRecentGamesByGameId(games, gameId) {

  const target =
    Number(gameId);

  if (!Number.isInteger(target))
    return games;

  return games.filter(function(game) {
    return game.id === target;
  });

}

function filterRecentGamesByPlayer(games, playerName) {

  const target =
    getRecentGameString(playerName)
      .toLowerCase();

  if (target === "")
    return games;

  return games.filter(function(game) {
    return (
      getRecentGameString(game.winner).toLowerCase() === target ||
      getRecentGameString(game.loser).toLowerCase() === target ||
      getRecentGameString(getPlayerDisplayName(game.winner)).toLowerCase() === target ||
      getRecentGameString(getPlayerDisplayName(game.loser)).toLowerCase() === target
    );
  });

}

function buildRecentGameResponse(game) {

  return {
    id: game.id,
    eventId:
      game.gameType === "casual"
        ? ""
        : game.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID,
    gameType: game.gameType,
    date: game.date,
    division: game.division,
    winner: game.winner,
    winnerDisplayName:
      getPlayerDisplayName(game.winner),
    loser: game.loser,
    loserDisplayName:
      getPlayerDisplayName(game.loser),
    winnerFaction: game.winnerFaction,
    loserFaction: game.loserFaction,
    mission: game.mission,
    tp: game.tp,
    op: game.op,
    vp: game.vp,
    bestMoment: game.bestMoment,
    firstTurn: game.firstTurn
  };

}

function getRecentGameColumns(headers) {

  return {
    date:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.DATE_PLAYED
      ),
    division:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.DIVISION
      ),
    mission:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.MISSION
      ),
    winner:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.WINNER
      ),
    loser:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.LOSER
      ),
    winnerFaction:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.WINNING_FACTION
      ),
    loserFaction:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.LOSING_FACTION
      ),
    winnerTp:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.WINNER_TP
      ),
    loserTp:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.LOSER_TP
      ),
    winnerOp:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.WINNER_OP
      ),
    loserOp:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.LOSER_OP
      ),
    winnerVp:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.WINNER_VP
      ),
    loserVp:
      getRecentGameColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.LOSER_VP
      ),
    bestMoment:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.BEST_MOMENT
      ),
    firstTurn:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.FIRST_TURN
      ),
    firstTurnWinner:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.FIRST_TURN_WINNER
      ),
    eventId:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.EVENT_ID
      ),
    gameType:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.GAME_TYPE
      )
  };

}

function buildRecentGame(
  row,
  sourceIndex,
  columns
) {

  const winner =
    getRecentGameString(
      row[columns.winner]
    );

  const loser =
    getRecentGameString(
      row[columns.loser]
    );

  const rawDate =
    row[columns.date];

  const sortDate =
    getRecentGameDate(rawDate);

  const firstTurn =
    getRecentGameFirstTurn(
      row,
      columns,
      winner,
      loser
    );

  return {
    id: sourceIndex,
    sourceIndex: sourceIndex,
    sortDate: sortDate,
    date:
      formatRecentGameDate(
        rawDate,
        sortDate
      ),
    division:
      getRecentGameString(
        row[columns.division]
      ),
    winner: winner,
    loser: loser,
    winnerFaction:
      canonicalizeArmyName(
        row[columns.winnerFaction]
      ),
    loserFaction:
      canonicalizeArmyName(
        row[columns.loserFaction]
      ),
    mission:
      getRecentGameString(
        row[columns.mission]
      ),
    tp:
      getRecentGameScore(
        row[columns.winnerTp],
        row[columns.loserTp]
      ),
    op:
      getRecentGameScore(
        row[columns.winnerOp],
        row[columns.loserOp]
      ),
    vp:
      getRecentGameScore(
        row[columns.winnerVp],
        row[columns.loserVp]
      ),
    bestMoment:
      columns.bestMoment === -1
        ? ""
        : getRecentGameString(
            row[columns.bestMoment]
          ),
    firstTurn: firstTurn,
    gameType:
      getRecentGameGameType(
        row,
        columns
      ),
    eventId:
      getRecentGameEventId(
        row,
        columns
      )
  };

}

function getRecentGameGameType(row, columns) {

  if (columns.gameType !== -1) {
    const value =
      getRecentGameString(
        row[columns.gameType]
      );

    if (value !== "")
      return normalizeGameType(value);
  }

  return "league";

}

function getRecentGameEventId(row, columns) {

  if (getRecentGameGameType(row, columns) === "casual")
    return "";

  return columns.eventId === -1
    ? EVENT_ENGINE_DEFAULT_EVENT_ID
    : getRecentGameString(
        row[columns.eventId]
      ) || EVENT_ENGINE_DEFAULT_EVENT_ID;

}

function getRecentGameColumn(
  headers,
  label
) {

  return headers.indexOf(label);

}

function getRecentGameOptionalColumn(
  headers,
  label
) {

  return headers.indexOf(label);

}

function getRecentGameString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}

function getRecentGameScore(
  winnerValue,
  loserValue
) {

  return (
    getRecentGameNumber(winnerValue) +
    "-" +
    getRecentGameNumber(loserValue)
  );

}

function getRecentGameNumber(value) {

  return Number(value) || 0;

}

function getRecentGameDate(value) {

  if (
    Object.prototype.toString.call(value) ===
    "[object Date]"
  )
    return value;

  const parsed =
    new Date(value);

  if (!isNaN(parsed.getTime()))
    return parsed;

  return new Date(0);

}

function formatRecentGameDate(
  rawDate,
  sortDate
) {

  if (
    Object.prototype.toString.call(rawDate) ===
    "[object Date]"
  )
    return Utilities.formatDate(
      sortDate,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  const text =
    getRecentGameString(rawDate);

  if (text !== "")
    return text;

  return "";

}

function getRecentGameFirstTurn(
  row,
  columns,
  winner,
  loser
) {

  if (columns.firstTurn !== -1)
    return getRecentGameString(
      row[columns.firstTurn]
    );

  if (columns.firstTurnWinner === -1)
    return "";

  const firstTurnWinner =
    getRecentGameString(
      row[columns.firstTurnWinner]
    );

  if (firstTurnWinner === "Yes")
    return winner;

  if (firstTurnWinner === "No")
    return loser;

  return firstTurnWinner;

}

function filterRecentGamesByEvent(games, eventId, gameType) {

  const scope =
    resolveLeagueEventScope(eventId);

  const typeScope =
    resolveLeagueGameTypeScope(gameType);

  if (
    scope === "all" ||
    scope === "lifetime"
  )
    return games.filter(function(game) {
      return typeScope === "all" ||
        getRecentGameString(game.gameType || "league") === typeScope;
    });

  return measureEventHomeOperationIfAvailable(
    "eventHome.recentGames.filterByEvent",
    function() {
      return games.filter(function(game) {
        return measureEventHomeLoopIterationIfAvailable(
          "eventHome.loop.recentGames.filterByEvent",
          function() {
            if (
              typeScope !== "all" &&
              getRecentGameString(game.gameType || "league") !== typeScope
            )
              return false;

            return (
              getRecentGameString(game.eventId) ||
              EVENT_ENGINE_DEFAULT_EVENT_ID
            ) === scope;
          }
        );
      });
    },
    {
      inputGames: games.length,
      eventId: eventId,
      scope: scope,
      gameType: typeScope
    }
  );

}

function getAllRecentGameObjectsForEvent(eventId, gameType) {

  if (typeof getAllRecentGameObjects !== "function")
    return [];

  return measureEventHomeOperationIfAvailable(
    "eventHome.recentGames.getAllAndFilter",
    function() {
      return filterRecentGamesByEvent(
        getAllRecentGameObjects(),
        eventId,
        gameType
      );
    },
    {
      eventId: eventId,
      gameType: gameType || "league"
    }
  );

}
