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
  GAME_TYPE: "Game Type",
  GAME_RESULT: "Game Result",
  WINNER_ARMY_LIST_ID: "Winner Army List ID",
  LOSER_ARMY_LIST_ID: "Loser Army List ID",
  WINNER_ARMY_CODE: "Winner Army Code",
  LOSER_ARMY_CODE: "Loser Army Code"
};

function getRecentGames(e) {

  if (typeof getAllRecentGameObjects === "function")
  {
    const playerName =
      e &&
      e.parameter &&
      e.parameter.playerName;

    const eventId =
      e &&
      e.parameter &&
      e.parameter.eventId;

    const requestedGameType =
      e &&
      e.parameter &&
      e.parameter.gameType;

    const eventScope =
      !eventId &&
      (
        playerName ||
        resolveLeagueGameTypeScope(requestedGameType) === "all"
      )
        ? "all"
        : eventId;

    const sourceGames =
      playerName
        ? getPlayerRecentGameObjectsFromGameEngine(
            playerName
          )
        : resolveLeagueGameTypeScope(requestedGameType) === "all"
        ? getAllRecentGameObjectsFromCanonicalResponses()
        : getAllRecentGameObjects();

    const filteredGames =
      filterRecentGamesByGameId(
        filterRecentGamesByEvent(
          filterRecentGamesByPlayer(
            sourceGames,
            playerName
          ),
          eventScope,
          requestedGameType
        ),
        e &&
        e.parameter &&
        e.parameter.gameId
      ).slice(0, RECENT_GAMES_LIMIT);

    if (
      filteredGames.length === 0 &&
      e &&
      e.parameter &&
      e.parameter.gameId
    ) {
      const formResponseGame =
        buildRecentGameFromFormResponseId(
          e.parameter.gameId
        );

      if (formResponseGame)
        filteredGames.push(formResponseGame);
    }

    if (
      filteredGames.length === 0 &&
      e &&
      e.parameter &&
      e.parameter.gameId
    ) {
      const linkedNewsGame =
        buildRecentGameFromLinkedNews(
          e.parameter.gameId
        );

      if (linkedNewsGame)
        filteredGames.push(linkedNewsGame);
    }

    return jsonOutput({
      success: true,
      games: filteredGames
    });
  }

  const sheet =
    lifGetTargetSpreadsheet_()
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

function getAllRecentGameObjectsFromCanonicalResponses() {

  const rows =
    getFormResponses();

  const games = [];

  const columns =
    getRecentGameColumns(
      getGameAnalyticsHeaders()[0]
    );

  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index];

    if (!row || !validateGame(row))
      continue;

    const winner =
      determineWinner(row);

    const game =
      buildRecentGame(
        buildAnalyticsRow(
          row,
          winner
        ),
        index + 1,
        columns
      );

    if (game)
      games.push(game);
  }

  return games.sort(function(a, b) {
    const dateOrder =
      b.sortDate.getTime() -
      a.sortDate.getTime();

    if (dateOrder !== 0)
      return dateOrder;

    return b.sourceIndex - a.sourceIndex;
  });

}

function getPlayerRecentGameObjectsFromGameEngine(playerName) {

  const communityPlayer =
    typeof findCommunityPlayerProfileRecord === "function"
      ? findCommunityPlayerProfileRecord(playerName)
      : null;

  const target =
    getCommunityPlayerKey(
      communityPlayer
        ? communityPlayer.player
        : playerName
    );

  if (target === "")
    return [];

  const rows =
    getLeagueDataForEvent(
      "all",
      "all"
    );

  return rows
    .map(function(row, index) {

      if (
        getCommunityPlayerKey(
          row[CONFIG.ENGINE.PLAYER]
        ) !== target
      )
        return null;

      const firstRowIndex =
        index % 2 === 0
          ? index
          : index - 1;

      return buildRecentGameFromGameEngineRows(
        rows[firstRowIndex],
        rows[firstRowIndex + 1],
        firstRowIndex
      );

    })
    .filter(function(game) {
      return Boolean(game);
    })
    .sort(function(a, b) {

      const dateOrder =
        b.sortDate.getTime() -
        a.sortDate.getTime();

      if (dateOrder !== 0)
        return dateOrder;

      return b.sourceIndex - a.sourceIndex;

    });

}

function buildRecentGameFromGameEngineRows(
  firstRow,
  secondRow,
  firstRowIndex
) {

  if (!firstRow || !secondRow)
    return null;

  const firstResult =
    getRecentGameString(
      firstRow[CONFIG.ENGINE.RESULT]
    ).toUpperCase();

  const draw =
    firstResult === "D" ||
    getRecentGameString(
      firstRow[CONFIG.ENGINE.GAME_RESULT]
    ).toLowerCase() === "draw";

  const winnerRow =
    firstResult === "L"
      ? secondRow
      : firstRow;

  const loserRow =
    winnerRow === firstRow
      ? secondRow
      : firstRow;

  const rawDate =
    firstRow[CONFIG.ENGINE.DATE];

  const sortDate =
    getRecentGameDate(rawDate);

  const gameType =
    getGameEngineRowGameType(firstRow) ||
    "league";

  const firstTurnRow =
    getRecentGameString(
      firstRow[CONFIG.ENGINE.FIRST_TURN]
    ).toLowerCase() === "yes"
      ? firstRow
      : getRecentGameString(
          secondRow[CONFIG.ENGINE.FIRST_TURN]
        ).toLowerCase() === "yes"
        ? secondRow
        : null;

  return {
    id: (firstRowIndex / 2) + 1,
    sourceIndex: firstRowIndex + 1,
    sortDate: sortDate,
    date:
      formatRecentGameDate(
        rawDate,
        sortDate
      ),
    division:
      getRecentGameString(
        firstRow[CONFIG.ENGINE.DIVISION]
      ),
    winner:
      getRecentGameString(
        winnerRow[CONFIG.ENGINE.PLAYER]
      ),
    loser:
      getRecentGameString(
        loserRow[CONFIG.ENGINE.PLAYER]
      ),
    winnerFaction:
      canonicalizeArmyName(
        winnerRow[CONFIG.ENGINE.FACTION]
      ),
    loserFaction:
      canonicalizeArmyName(
        loserRow[CONFIG.ENGINE.FACTION]
      ),
    mission:
      getRecentGameString(
        firstRow[CONFIG.ENGINE.MISSION]
      ),
    tp:
      getRecentGameScore(
        winnerRow[CONFIG.ENGINE.TP],
        loserRow[CONFIG.ENGINE.TP]
      ),
    op:
      getRecentGameScore(
        winnerRow[CONFIG.ENGINE.OP],
        loserRow[CONFIG.ENGINE.OP]
      ),
    vp:
      getRecentGameScore(
        winnerRow[CONFIG.ENGINE.VP],
        loserRow[CONFIG.ENGINE.VP]
      ),
    bestMoment: "",
    firstTurn:
      firstTurnRow
        ? getRecentGameString(
            firstTurnRow[CONFIG.ENGINE.PLAYER]
          )
        : "",
    gameResult:
      draw
        ? "Draw"
        : getRecentGameString(
            firstRow[CONFIG.ENGINE.GAME_RESULT]
          ),
    gameType: gameType,
    eventId:
      gameType === "casual"
        ? ""
        : getRecentGameString(
            firstRow[CONFIG.ENGINE.EVENT_ID]
          ) || EVENT_ENGINE_DEFAULT_EVENT_ID,
    winnerArmyListId:
      getRecentGameString(
        winnerRow[CONFIG.ENGINE.ARMY_LIST_ID]
      ),
    loserArmyListId:
      getRecentGameString(
        loserRow[CONFIG.ENGINE.ARMY_LIST_ID]
      ),
    winnerArmyCode: "",
    loserArmyCode: ""
  };

}

function getGameCenter(e) {

  const games =
    getGameCenterCanonicalGames();

  const context =
    buildGameCenterContext(games);

  return jsonOutput({
    success: true,
    generatedAt: new Date().toISOString(),
    games:
      games.map(function(game) {
        return buildGameCenterGameResponse(
          game,
          context
        );
      })
  });

}

function getGameCenterCanonicalGames() {

  if (typeof getAllRecentGameObjects === "function")
    return dedupeGameCenterCanonicalGames(
      getAllRecentGameObjects()
        .slice()
    )
      .sort(sortGameCenterCanonicalGames);

  const sheet =
    lifGetTargetSpreadsheet_()
      .getSheetByName(CONFIG.SHEETS.GAME_ANALYTICS);

  if (!sheet)
    return [];

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  const headers =
    values.shift();

  const columns =
    getRecentGameColumns(headers);

  return dedupeGameCenterCanonicalGames(
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
    })
  )
    .sort(sortGameCenterCanonicalGames);

}

function dedupeGameCenterCanonicalGames(games) {

  const seen = {};

  return games.filter(function(game) {
    const id =
      getGameCenterCanonicalGameId(game);

    if (id === "")
      return true;

    if (seen[id])
      return false;

    seen[id] = true;
    return true;
  });

}

function getGameCenterCanonicalGameId(game) {

  const id =
    Number(
      game &&
      game.id
    );

  if (
    Number.isInteger(id) &&
    id > 0
  )
    return String(id);

  const sourceIndex =
    Number(
      game &&
      game.sourceIndex
    );

  if (
    Number.isInteger(sourceIndex) &&
    sourceIndex > 0
  )
    return String(sourceIndex);

  return "";

}

function sortGameCenterCanonicalGames(a, b) {

  const leftDate =
    getGameCenterSortDate(a);

  const rightDate =
    getGameCenterSortDate(b);

  const dateOrder =
    rightDate.getTime() -
    leftDate.getTime();

  if (dateOrder !== 0)
    return dateOrder;

  return (
    getGameCenterSortIndex(b) -
    getGameCenterSortIndex(a)
  );

}

function getGameCenterSortDate(game) {

  if (
    game &&
    game.sortDate &&
    typeof game.sortDate.getTime === "function" &&
    !isNaN(game.sortDate.getTime())
  )
    return game.sortDate;

  const parsed =
    new Date(
      game &&
      game.date
    );

  if (!isNaN(parsed.getTime()))
    return parsed;

  return new Date(0);

}

function getGameCenterSortIndex(game) {

  const sourceIndex =
    Number(
      game &&
      game.sourceIndex
    );

  if (Number.isFinite(sourceIndex))
    return sourceIndex;

  const id =
    Number(
      game &&
      game.id
    );

  if (Number.isFinite(id))
    return id;

  return 0;

}

function buildGameCenterContext(games) {

  const events =
    buildGameCenterEventLookup();

  return {
    events: events,
    teams:
      buildGameCenterTeamLookup(
        games,
        events
      )
  };

}

function buildGameCenterEventLookup() {

  const lookup = {};

  try {
    const engine =
      typeof getEventEngineSnapshot === "function"
        ? getEventEngineSnapshot()
        : null;

    if (
      engine &&
      Array.isArray(engine.events)
    )
      engine.events.forEach(function(event) {
        if (event && event.id)
          lookup[event.id] = event;
      });
  }
  catch (err) {
    Logger.log(
      "Game Center event lookup failed: " +
      String(err)
    );
  }

  return lookup;

}

function buildGameCenterTeamLookup(games, events) {

  const lookup = {};
  const eventIds = {};

  games.forEach(function(game) {
    const eventId =
      getRecentGameString(game.eventId);

    if (
      eventId !== "" &&
      isGameCenterTeamTournamentGame(
        game,
        events[eventId]
      )
    )
      eventIds[eventId] = true;
  });

  Object.keys(eventIds)
    .forEach(function(eventId) {
      try {
        const teams =
          typeof getTeamTournamentTeams === "function"
            ? getTeamTournamentTeams(eventId)
            : [];

        teams.forEach(function(team) {
          const teamName =
            getRecentGameString(team.teamName);

          if (teamName === "")
            return;

          [
            team.captain
          ].concat(
            parseGameCenterTeamRoster(team.players)
          ).forEach(function(player) {
            const key =
              getGameCenterTeamKey(
                eventId,
                player
              );

            if (key !== "")
              lookup[key] = teamName;
          });
        });
      }
      catch (err) {
        Logger.log(
          "Game Center team lookup failed for " +
          eventId +
          ": " +
          String(err)
        );
      }
    });

  return lookup;

}

function parseGameCenterTeamRoster(players) {

  return getRecentGameString(players)
    .split(/[,;\n]/)
    .map(function(player) {
      return getRecentGameString(player);
    })
    .filter(function(player) {
      return player !== "";
    });

}

function getGameCenterTeamKey(eventId, player) {

  const normalized =
    getRecentGameString(player)
      .toLowerCase();

  if (normalized === "")
    return "";

  return (
    eventId +
    "::" +
    normalized
  );

}

function buildGameCenterGameResponse(game, context) {

  const recent =
    isGameCenterRecentGameResponse(game)
      ? game
      : buildRecentGameResponse(game);

  const playerFields =
    buildGameCenterPlayerFields(recent);

  const event =
    context.events[recent.eventId];

  const team =
    getGameCenterTeamLabel(
      recent.eventId,
      playerFields.player1,
      playerFields.player2,
      context.teams
    );

  return {
    id: recent.id,
    date: recent.date,
    sortDate:
      game.sortDate &&
      typeof game.sortDate.getTime === "function" &&
      !isNaN(game.sortDate.getTime())
        ? game.sortDate.toISOString()
        : getGameCenterSortDate(recent).toISOString(),
    eventId: recent.eventId,
    event:
      recent.gameType === "casual"
        ? "Casual"
        : event && event.name
          ? event.name
          : recent.eventId || "Current League",
    gameType:
      isGameCenterTeamTournamentGame(
        recent,
        event
      )
        ? "tournament"
        : recent.gameType || "league",
    gameTypeLabel:
      getGameCenterGameTypeLabel(
        recent,
        event
      ),
    mission: recent.mission,
    player1: playerFields.player1,
    player1DisplayName: playerFields.player1DisplayName,
    player2: playerFields.player2,
    player2DisplayName: playerFields.player2DisplayName,
    winner: playerFields.winner,
    winnerDisplayName: playerFields.winnerDisplayName,
    result: playerFields.result,
    player1Faction: playerFields.player1Faction,
    player2Faction: playerFields.player2Faction,
    player1ArmyCode: playerFields.player1ArmyCode,
    player2ArmyCode: playerFields.player2ArmyCode,
    team: team,
    tp: playerFields.tp,
    op: playerFields.op,
    vp: playerFields.vp
  };

}

function isGameCenterRecentGameResponse(game) {

  return (
    game &&
    game.id !== undefined &&
    game.date !== undefined &&
    game.winnerDisplayName !== undefined &&
    game.loserDisplayName !== undefined
  );

}

function buildGameCenterPlayerFields(recent) {

  const result =
    getRecentGameString(recent.gameResult);

  const normalizedResult =
    result.toLowerCase();

  const player2Victory =
    normalizedResult === "player 2 victory";

  const draw =
    normalizedResult === "draw";

  if (player2Victory)
    return {
      player1: recent.loser,
      player1DisplayName: recent.loserDisplayName,
      player2: recent.winner,
      player2DisplayName: recent.winnerDisplayName,
      winner: recent.winner,
      winnerDisplayName: recent.winnerDisplayName,
      result: recent.winnerDisplayName,
      player1Faction: recent.loserFaction,
      player2Faction: recent.winnerFaction,
      player1ArmyCode: recent.loserArmyCode,
      player2ArmyCode: recent.winnerArmyCode,
      tp: invertGameCenterScore(recent.tp),
      op: invertGameCenterScore(recent.op),
      vp: invertGameCenterScore(recent.vp)
    };

  return {
    player1: recent.winner,
    player1DisplayName: recent.winnerDisplayName,
    player2: recent.loser,
    player2DisplayName: recent.loserDisplayName,
    winner:
      draw
        ? ""
        : recent.winner,
    winnerDisplayName:
      draw
        ? ""
        : recent.winnerDisplayName,
    result:
      draw
        ? "Draw"
        : recent.winnerDisplayName,
    player1Faction: recent.winnerFaction,
    player2Faction: recent.loserFaction,
    player1ArmyCode: recent.winnerArmyCode,
    player2ArmyCode: recent.loserArmyCode,
    tp: recent.tp,
    op: recent.op,
    vp: recent.vp
  };

}

function invertGameCenterScore(score) {

  const parts =
    getRecentGameString(score)
      .split("-");

  if (parts.length !== 2)
    return getRecentGameString(score);

  return (
    getRecentGameString(parts[1]) +
    "-" +
    getRecentGameString(parts[0])
  );

}

function getGameCenterGameTypeLabel(game, event) {

  if (isGameCenterTeamTournamentGame(game, event))
    return "Team Tournament";

  if (game.gameType === "casual")
    return "Casual";

  return "League";

}

function isGameCenterTeamTournamentGame(game, event) {

  if (getRecentGameString(game.gameType) === "tournament")
    return true;

  if (
    event &&
    getRecentGameString(event.type).toLowerCase() === "team tournament"
  )
    return true;

  return getRecentGameString(game.eventId) ===
    EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID;

}

function getGameCenterTeamLabel(eventId, player1, player2, teams) {

  const player1Team =
    teams[
      getGameCenterTeamKey(
        eventId,
        player1
      )
    ] || "";

  const player2Team =
    teams[
      getGameCenterTeamKey(
        eventId,
        player2
      )
    ] || "";

  if (
    player1Team !== "" &&
    player2Team !== "" &&
    player1Team !== player2Team
  )
    return player1Team + " / " + player2Team;

  return player1Team || player2Team;

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

function buildRecentGameFromFormResponseId(gameId) {

  const target =
    Number(gameId);

  if (!Number.isInteger(target))
    return null;

  const rows =
    getFormResponses();

  const row =
    rows[target - 1];

  if (
    !row ||
    !validateGame(row)
  )
    return null;

  const winner =
    determineWinner(row);

  const analyticsRow =
    buildAnalyticsRow(
      row,
      winner
    );

  const rawGame =
    buildRecentGame(
      analyticsRow,
      target,
      getRecentGameColumns(
        getGameAnalyticsHeaders()[0]
      )
    );

  return buildRecentGameResponse(rawGame);

}

function buildRecentGameFromLinkedNews(gameId) {

  const target =
    Number(gameId);

  if (
    !Number.isInteger(target) ||
    typeof getManualCommissionerNews !== "function"
  )
    return null;

  const link =
    "/games/" + target;

  const item =
    getManualCommissionerNews()
      .filter(function(newsItem) {
        return getRecentGameString(newsItem.link) === link;
      })[0];

  if (!item)
    return null;

  const parsed =
    parseLinkedNewsGame(item.body);

  if (!parsed)
    return null;

  return {
    id: target,
    eventId: EVENT_ENGINE_DEFAULT_EVENT_ID,
    gameType: "league",
    date: item.date || "",
    division: "",
    winner: parsed.winner,
    winnerDisplayName: parsed.winner,
    loser: parsed.loser,
    loserDisplayName: parsed.loser,
    winnerFaction: "",
    loserFaction: "",
    mission: parsed.mission,
    tp: "",
    op: parsed.op,
    vp: "",
    bestMoment: item.body || "",
    firstTurn: ""
  };

}

function parseLinkedNewsGame(body) {

  const text =
    getRecentGameString(body);

  const match =
    text.match(/^(.+?) defeated (.+?) on (.+?) with a (.+?) scoreline\.$/);

  if (!match)
    return null;

  return {
    winner: match[1],
    loser: match[2],
    mission: match[3],
    op: match[4]
  };

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
    winnerArmyListId: game.winnerArmyListId || "",
    loserArmyListId: game.loserArmyListId || "",
    winnerArmyCode: game.winnerArmyCode || "",
    loserArmyCode: game.loserArmyCode || "",
    gameResult:
      getRecentGameResult(game),
    mission: game.mission,
    tp: game.tp,
    op: game.op,
    vp: game.vp,
    bestMoment: game.bestMoment,
    firstTurn: game.firstTurn
  };

}

function getRecentGameResult(game) {

  const explicitResult =
    getRecentGameString(game.gameResult);

  if (explicitResult !== "")
    return explicitResult;

  const tp =
    getRecentGameScoreParts(game.tp);

  const op =
    getRecentGameScoreParts(game.op);

  const vp =
    getRecentGameScoreParts(game.vp);

  if (
    tp &&
    op &&
    vp &&
    tp[0] === tp[1] &&
    op[0] === op[1] &&
    vp[0] === vp[1]
  )
    return "Draw";

  return "Player 1 Victory";

}

function getRecentGameScoreParts(score) {

  const parts =
    getRecentGameString(score)
      .split("-");

  if (parts.length !== 2)
    return null;

  const left =
    Number(parts[0]);

  const right =
    Number(parts[1]);

  if (!Number.isFinite(left) || !Number.isFinite(right))
    return null;

  return [left, right];

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
      ),
    gameResult:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.GAME_RESULT
      ),
    winnerArmyListId:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.WINNER_ARMY_LIST_ID
      ),
    loserArmyListId:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.LOSER_ARMY_LIST_ID
      ),
    winnerArmyCode:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.WINNER_ARMY_CODE
      ),
    loserArmyCode:
      getRecentGameOptionalColumn(
        headers,
        RECENT_GAME_ANALYTICS_COLUMNS.LOSER_ARMY_CODE
      )
  };

}

function buildRecentGame(
  row,
  sourceIndex,
  columns
) {

  // `row` is a Game Analytics row; `columns` must come from getRecentGameColumns().
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
    gameResult:
      columns.gameResult === -1
        ? ""
        : getRecentGameString(
            row[columns.gameResult]
          ),
    gameType:
      getRecentGameGameType(
        row,
        columns
      ),
    eventId:
      getRecentGameEventId(
        row,
        columns
      ),
    winnerArmyListId:
      getRecentGameArmyListId(
        row,
        columns.winnerArmyListId
      ),
    loserArmyListId:
      getRecentGameArmyListId(
        row,
        columns.loserArmyListId
      ),
    winnerArmyCode:
      columns.winnerArmyCode === -1
        ? ""
        : getRecentGameString(
            row[columns.winnerArmyCode]
          ),
    loserArmyCode:
      columns.loserArmyCode === -1
        ? ""
        : getRecentGameString(
            row[columns.loserArmyCode]
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

function getRecentGameArmyListId(row, column) {

  if (column === -1)
    return "";

  const id =
    Number(row[column]) || 0;

  return id > 0
    ? String(id)
    : "";

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
