/*******************************************************
 * ResultSubmissionApi.gs
 *
 * Portal-native player result submission.
 * Reuses Form Responses and the existing Game Engine rebuild.
 *******************************************************/

const RESULT_SUBMISSION_ARMY_CODE_HEADERS = {
  PLAYER1_ARMY_CODE: "Player 1 Army Code",
  PLAYER2_ARMY_CODE: "Player 2 Army Code"
};

const RESULT_SUBMISSION_CANONICAL_HEADERS = {
  SOURCE_TYPE: "Source Type",
  SOURCE_RESULT_ID: "Source Result ID"
};

function submitLeagueResult(e) {

  return requireApiPermission(e, "canSubmitLeagueGames", function(auth) {
    const params =
      getApiParameters(e);

    const commissionerContext =
      getResultSubmissionCommissionerContext(auth, params);

    if (commissionerContext.error)
      return resultSubmissionFailure(commissionerContext.error);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

    const event =
      getEventByIdSnapshot(eventId) ||
      getCurrentLeagueEventSnapshot();

    if (!event)
      return resultSubmissionFailure("Event was not found.");

    if (!isLeagueResultEventAcceptingResults(event))
      return resultSubmissionFailure("This event is not currently accepting results.");

    const player =
      getResultSubmissionString(params.player) ||
      (auth && auth.user ? getCanonicalPlayerFromUser(auth.user) : "");

    const opponent =
      getResultSubmissionString(params.opponent);

    if (player === "" || opponent === "")
      return resultSubmissionFailure("Player and opponent are required.");

    if (normalizeResultSubmissionValue(player) === normalizeResultSubmissionValue(opponent))
      return resultSubmissionFailure("Opponent must be a different player.");

    const registrations =
      getEventRegistrationRows(eventId);

    if (!commissionerContext.override &&
        !isResultSubmissionRegisteredPlayer(registrations, player))
      return resultSubmissionFailure("Player is not registered for this event.");

    if (!commissionerContext.override &&
        !isResultSubmissionRegisteredPlayer(registrations, opponent))
      return resultSubmissionFailure("Opponent is not registered for this event.");

    if (!commissionerContext.override &&
        hasExistingLeagueResult(eventId, player, opponent))
      return resultSubmissionFailure("This match has already been reported.");

    const playerTp =
      parseResultSubmissionScore(params.playerTournamentPoints);
    const opponentTp =
      parseResultSubmissionScore(params.opponentTournamentPoints);
    const playerOp =
      parseResultSubmissionScore(params.playerObjectivePoints);
    const opponentOp =
      parseResultSubmissionScore(params.opponentObjectivePoints);
    const playerVp =
      parseResultSubmissionScore(params.playerVictoryPoints);
    const opponentVp =
      parseResultSubmissionScore(params.opponentVictoryPoints);

    if (
      playerTp === null ||
      opponentTp === null ||
      playerOp === null ||
      opponentOp === null ||
      playerVp === null ||
      opponentVp === null
    )
      return resultSubmissionFailure("Scores must be non-negative numbers.");

    if (playerTp + opponentTp > 10)
      return resultSubmissionFailure("Tournament Points cannot total more than 10.");

    const winner =
      getResultSubmissionString(params.winner);

    const playerFaction =
      canonicalizeArmyName(params.playerFaction);

    const opponentFaction =
      canonicalizeArmyName(params.opponentFaction);

    if (playerFaction === "" || opponentFaction === "")
      return resultSubmissionFailure("Both factions are required.");

    const playerArmyList =
      validateResultSubmissionArmyListId(
        params.playerArmyListId,
        player,
        playerFaction
      );

    if (!playerArmyList.valid)
      return resultSubmissionFailure(playerArmyList.error);

    const opponentArmyList =
      validateResultSubmissionArmyListId(
        params.opponentArmyListId,
        opponent,
        opponentFaction
      );

    if (!opponentArmyList.valid)
      return resultSubmissionFailure(opponentArmyList.error);

    const expectedWinner =
      determineLeagueSubmissionWinner(
        player,
        opponent,
        playerTp,
        opponentTp,
        playerOp,
        opponentOp,
        playerVp,
        opponentVp
      );
    const submittedResult =
      winner !== "" ? winner : expectedWinner;

    const playerIsWinner =
      normalizeResultSubmissionValue(submittedResult) === normalizeResultSubmissionValue(player);
    const resultIsDraw =
      normalizeResultSubmissionValue(submittedResult) === "draw";

    const row = [];
    row[FORM.TIMESTAMP] = getResultSubmissionTimestamp();
    row[FORM.DIVISION] = getResultSubmissionString(params.division);
    row[FORM.DATE] = getResultSubmissionDate();
    row[FORM.MISSION] = getResultSubmissionString(params.mission);
    row[FORM.PLAYER1] = player;
    row[FORM.PLAYER2] = opponent;
    row[FORM.P1TP] = playerTp;
    row[FORM.P2TP] = opponentTp;
    row[FORM.P1OP] = playerOp;
    row[FORM.P2OP] = opponentOp;
    row[FORM.P1VP] = playerVp;
    row[FORM.P2VP] = opponentVp;
    row[FORM.FIRSTTURN] = getResultSubmissionString(params.firstTurn);
    row[FORM.WINNINGFACTION] =
      resultIsDraw || playerIsWinner
        ? playerFaction
        : opponentFaction;
    row[FORM.LOSINGFACTION] =
      resultIsDraw || playerIsWinner
        ? opponentFaction
        : playerFaction;
    row[FORM.MOMENT] = getResultSubmissionString(params.bestMoment);
    row[FORM.EVENT_ID] = eventId;
    row[FORM.GAME_TYPE] = "league";
    row[FORM.GAME_RESULT] =
      resultIsDraw
        ? "Draw"
        : playerIsWinner
          ? "Player 1 Victory"
          : "Player 2 Victory";
    row[FORM.WINNER_ARMY_LIST_ID] =
      resultIsDraw || playerIsWinner
        ? playerArmyList.id
        : opponentArmyList.id;
    row[FORM.LOSER_ARMY_LIST_ID] =
      resultIsDraw || playerIsWinner
        ? opponentArmyList.id
        : playerArmyList.id;

    const sheet =
      SpreadsheetApp
        .getActive()
        .getSheetByName(CONFIG.SHEETS.FORM);

    if (!sheet)
      return resultSubmissionFailure("Result datastore was not found.");

    const armyCodeColumns =
      ensureResultSubmissionArmyCodeColumns(sheet);

    ensureResultSubmissionArmyListHeaders(sheet);

    row[armyCodeColumns.player1ArmyCode] =
      getResultSubmissionString(params.player1ArmyCode);
    row[armyCodeColumns.player2ArmyCode] =
      getResultSubmissionString(params.player2ArmyCode);

    sheet.appendRow(row);

    recordResultSubmissionCommissionerAudit(
      commissionerContext,
      "league",
      {
        eventId: eventId,
        player: player,
        opponent: opponent,
        mission: row[FORM.MISSION],
        result: row[FORM.GAME_RESULT],
        winnerArmyListId: row[FORM.WINNER_ARMY_LIST_ID],
        loserArmyListId: row[FORM.LOSER_ARMY_LIST_ID]
      }
    );

    if (typeof rebuildGameEngine === "function")
      rebuildGameEngine();

    if (typeof publishLatestGameSubmittedAutomationEvent === "function")
      publishLatestGameSubmittedAutomationEvent();

    invalidateResultSubmissionCaches();

    return jsonOutput({
      success: true,
      status: "Submitted",
      eventId: eventId,
      player: player,
      opponent: opponent
    });
  });

}

function submitCasualResult(e) {

  return requireApiPermission(e, "canSubmitCasualGames", function(auth) {
    const params =
      getApiParameters(e);

    const commissionerContext =
      getResultSubmissionCommissionerContext(auth, params);

    if (commissionerContext.error)
      return resultSubmissionFailure(commissionerContext.error);

    const player =
      getResultSubmissionString(params.player) ||
      (auth && auth.user
        ? getCanonicalPlayerFromUser(auth.user) ||
          auth.user.playerDisplayName ||
          auth.user.displayName ||
          auth.user.email
        : "");

    const opponent =
      getResultSubmissionString(params.opponent);

    if (player === "" || opponent === "")
      return resultSubmissionFailure("Players are required.");

    if (normalizeResultSubmissionValue(player) === normalizeResultSubmissionValue(opponent))
      return resultSubmissionFailure("Opponent must be a different player.");

    const playerFaction =
      canonicalizeArmyName(params.playerFaction);

    const opponentFaction =
      canonicalizeArmyName(params.opponentFaction);

    if (playerFaction === "")
      return resultSubmissionFailure("Player faction is required.");

    if (opponentFaction === "")
      return resultSubmissionFailure("Opponent faction is required.");

    const playerArmyList =
      validateResultSubmissionArmyListId(
        params.playerArmyListId,
        player,
        playerFaction
      );

    if (!playerArmyList.valid)
      return resultSubmissionFailure(playerArmyList.error);

    const opponentArmyList =
      validateResultSubmissionArmyListId(
        params.opponentArmyListId,
        opponent,
        opponentFaction
      );

    if (!opponentArmyList.valid)
      return resultSubmissionFailure(opponentArmyList.error);

    if (getResultSubmissionString(params.mission) === "")
      return resultSubmissionFailure("Mission is required.");

    if (getResultSubmissionString(params.firstTurn) === "")
      return resultSubmissionFailure("First Turn is required.");

    if (getResultSubmissionString(params.bestMoment) === "")
      return resultSubmissionFailure("Best Moment is required.");

    const playerTp =
      parseResultSubmissionScore(params.playerTournamentPoints);
    const opponentTp =
      parseResultSubmissionScore(params.opponentTournamentPoints);
    const playerOp =
      parseResultSubmissionScore(params.playerObjectivePoints);
    const opponentOp =
      parseResultSubmissionScore(params.opponentObjectivePoints);
    const playerVp =
      parseResultSubmissionScore(params.playerVictoryPoints);
    const opponentVp =
      parseResultSubmissionScore(params.opponentVictoryPoints);

    if (
      playerTp === null ||
      opponentTp === null ||
      playerOp === null ||
      opponentOp === null ||
      playerVp === null ||
      opponentVp === null
    )
      return resultSubmissionFailure("Scores must be non-negative numbers.");

    if (playerTp + opponentTp > 10)
      return resultSubmissionFailure("Tournament Points cannot total more than 10.");

    const winner =
      getResultSubmissionString(params.winner);

    const expectedWinner =
      determineLeagueSubmissionWinner(
        player,
        opponent,
        playerTp,
        opponentTp,
        playerOp,
        opponentOp,
        playerVp,
        opponentVp
      );
    const submittedResult =
      winner !== "" ? winner : expectedWinner;

    const playerIsWinner =
      normalizeResultSubmissionValue(submittedResult) === normalizeResultSubmissionValue(player);
    const resultIsDraw =
      normalizeResultSubmissionValue(submittedResult) === "draw";

    const row = [];
    row[FORM.TIMESTAMP] = getResultSubmissionTimestamp();
    row[FORM.DIVISION] = "Casual";
    row[FORM.DATE] = getResultSubmissionDate();
    row[FORM.MISSION] = getResultSubmissionString(params.mission);
    row[FORM.PLAYER1] = player;
    row[FORM.PLAYER2] = opponent;
    row[FORM.P1TP] = playerTp;
    row[FORM.P2TP] = opponentTp;
    row[FORM.P1OP] = playerOp;
    row[FORM.P2OP] = opponentOp;
    row[FORM.P1VP] = playerVp;
    row[FORM.P2VP] = opponentVp;
    row[FORM.FIRSTTURN] = getResultSubmissionString(params.firstTurn);
    row[FORM.WINNINGFACTION] =
      resultIsDraw || playerIsWinner
        ? playerFaction
        : opponentFaction;
    row[FORM.LOSINGFACTION] =
      resultIsDraw || playerIsWinner
        ? opponentFaction
        : playerFaction;
    row[FORM.MOMENT] = getResultSubmissionString(params.bestMoment);
    row[FORM.EVENT_ID] = "";
    row[FORM.GAME_TYPE] = "casual";
    row[FORM.GAME_RESULT] =
      resultIsDraw
        ? "Draw"
        : playerIsWinner
          ? "Player 1 Victory"
          : "Player 2 Victory";
    row[FORM.WINNER_ARMY_LIST_ID] =
      resultIsDraw || playerIsWinner
        ? playerArmyList.id
        : opponentArmyList.id;
    row[FORM.LOSER_ARMY_LIST_ID] =
      resultIsDraw || playerIsWinner
        ? opponentArmyList.id
        : playerArmyList.id;

    const sheet =
      SpreadsheetApp
        .getActive()
        .getSheetByName(CONFIG.SHEETS.FORM);

    if (!sheet)
      return resultSubmissionFailure("Result datastore was not found.");

    const armyCodeColumns =
      ensureResultSubmissionArmyCodeColumns(sheet);

    ensureResultSubmissionArmyListHeaders(sheet);

    row[armyCodeColumns.player1ArmyCode] =
      getResultSubmissionString(params.player1ArmyCode);
    row[armyCodeColumns.player2ArmyCode] =
      getResultSubmissionString(params.player2ArmyCode);

    sheet.appendRow(row);

    recordResultSubmissionCommissionerAudit(
      commissionerContext,
      "casual",
      {
        eventId: "",
        player: player,
        opponent: opponent,
        mission: row[FORM.MISSION],
        result: row[FORM.GAME_RESULT],
        winnerArmyListId: row[FORM.WINNER_ARMY_LIST_ID],
        loserArmyListId: row[FORM.LOSER_ARMY_LIST_ID]
      }
    );

    if (typeof rebuildGameEngine === "function")
      rebuildGameEngine();

    if (typeof publishLatestGameSubmittedAutomationEvent === "function")
      publishLatestGameSubmittedAutomationEvent();

    invalidateResultSubmissionCaches();

    return jsonOutput({
      success: true,
      status: "Submitted",
      eventId: "",
      gameType: "casual",
      player: player,
      opponent: opponent
    });
  });

}

function linkHistoricalArmyLists(e) {

  return requireApiPermission(e, "viewOperations", function(auth) {
    const params =
      getApiParameters(e);

    const gameId =
      Number(params.gameId) || 0;

    if (gameId <= 0)
      return resultSubmissionFailure("Game ID is required.");

    const games =
      typeof getAllRecentGameObjectsForEvent === "function"
        ? getAllRecentGameObjectsForEvent("all", "all")
        : [];

    const game =
      games.filter(function(candidate) {
        return Number(candidate.id) === gameId;
      })[0] || null;

    if (!game)
      return resultSubmissionFailure("Game was not found.");

    const winnerArmyList =
      validateResultSubmissionArmyListId(
        params.winnerArmyListId,
        game.winner,
        game.winnerFaction
      );

    if (!winnerArmyList.valid)
      return resultSubmissionFailure(winnerArmyList.error);

    const loserArmyList =
      validateResultSubmissionArmyListId(
        params.loserArmyListId,
        game.loser,
        game.loserFaction
      );

    if (!loserArmyList.valid)
      return resultSubmissionFailure(loserArmyList.error);

    const sheet =
      SpreadsheetApp
        .getActive()
        .getSheetByName(CONFIG.SHEETS.FORM);

    if (!sheet)
      return resultSubmissionFailure("Result datastore was not found.");

    ensureResultSubmissionArmyListHeaders(sheet);

    const rowNumber =
      getResultSubmissionFormRowNumberForGameId(gameId);

    if (rowNumber <= 1)
      return resultSubmissionFailure("Source game row was not found.");

    const previousWinnerArmyListId =
      getResultSubmissionString(
        sheet
          .getRange(rowNumber, FORM.WINNER_ARMY_LIST_ID + 1)
          .getValue()
      );

    const previousLoserArmyListId =
      getResultSubmissionString(
        sheet
          .getRange(rowNumber, FORM.LOSER_ARMY_LIST_ID + 1)
          .getValue()
      );

    sheet
      .getRange(rowNumber, FORM.WINNER_ARMY_LIST_ID + 1)
      .setValue(winnerArmyList.id);

    sheet
      .getRange(rowNumber, FORM.LOSER_ARMY_LIST_ID + 1)
      .setValue(loserArmyList.id);

    recordArmyListLinkAudit({
      commissioner:
        auth.user.playerDisplayName ||
        getCanonicalPlayerFromUser(auth.user) ||
        auth.user.displayName ||
        auth.user.email ||
        "Commissioner",
      eventId: game.eventId || "",
      gameId: gameId,
      loser: game.loser,
      loserArmyListId: loserArmyList.id,
      previousLoserArmyListId: previousLoserArmyListId,
      previousWinnerArmyListId: previousWinnerArmyListId,
      reason: getResultSubmissionString(params.reason),
      winner: game.winner,
      winnerArmyListId: winnerArmyList.id
    });

    if (typeof rebuildGameEngine === "function")
      rebuildGameEngine();

    invalidateResultSubmissionCaches();

    return jsonOutput({
      success: true,
      status: "Linked",
      gameId: gameId,
      winnerArmyListId: winnerArmyList.id,
      loserArmyListId: loserArmyList.id
    });
  });

}

function getArmyListLinkCandidates(e) {

  return requireApiPermission(e, "viewOperations", function() {
    return jsonOutput({
      success: true,
      games:
        typeof getAllRecentGameObjectsForEvent === "function"
          ? getAllRecentGameObjectsForEvent("all", "all")
          : [],
      armyLists:
        typeof getArmyListObjects === "function"
          ? getArmyListObjects()
            .filter(function(list) {
              return list.approved;
            })
          : []
    });
  });

}

function resultSubmissionFailure(message) {

  return jsonOutput({
    success: false,
    error: message
  });

}

function ensureResultSubmissionArmyCodeColumns(sheet) {

  const requiredHeaders = [
    RESULT_SUBMISSION_ARMY_CODE_HEADERS.PLAYER1_ARMY_CODE,
    RESULT_SUBMISSION_ARMY_CODE_HEADERS.PLAYER2_ARMY_CODE
  ];

  const lastColumn =
    Math.max(sheet.getLastColumn(), FORM.GAME_RESULT + 1);

  const headerRange =
    sheet.getRange(1, 1, 1, lastColumn);

  let headers =
    headerRange
      .getValues()[0]
      .map(getResultSubmissionString);

  const occupiedHeaderCount =
    headers.filter(function(header) {
      return header !== "";
    }).length;

  if (occupiedHeaderCount === 0) {
    sheet
      .getRange(1, 1, 1, requiredHeaders.length)
      .setValues([requiredHeaders]);

    headers = requiredHeaders.slice();
  } else {
    const missingHeaders =
      requiredHeaders.filter(function(header) {
        return headers.indexOf(header) === -1;
      });

    if (missingHeaders.length > 0) {
      sheet
        .getRange(1, occupiedHeaderCount + 1, 1, missingHeaders.length)
        .setValues([missingHeaders]);

      headers =
        sheet
          .getRange(1, 1, 1, occupiedHeaderCount + missingHeaders.length)
          .getValues()[0]
          .map(getResultSubmissionString);
    }
  }

  return {
    player1ArmyCode:
      headers.indexOf(RESULT_SUBMISSION_ARMY_CODE_HEADERS.PLAYER1_ARMY_CODE),
    player2ArmyCode:
      headers.indexOf(RESULT_SUBMISSION_ARMY_CODE_HEADERS.PLAYER2_ARMY_CODE)
  };

}

function validateResultSubmissionArmyListId(value, player, faction) {

  const id =
    Number(value) || 0;

  if (id <= 0)
    return {
      valid: true,
      id: "",
      list: null
    };

  const list =
    getResultSubmissionApprovedArmyListById(id);

  if (!list)
    return {
      valid: false,
      id: "",
      list: null,
      error: "Selected Army List must be an approved submitted list."
    };

  if (
    normalizeResultSubmissionValue(list.player) !==
    normalizeResultSubmissionValue(player)
  )
    return {
      valid: false,
      id: "",
      list: null,
      error: "Selected Army List does not belong to the submitted player."
    };

  if (!resultSubmissionArmyListMatchesFaction(list, faction))
    return {
      valid: false,
      id: "",
      list: null,
      error: "Selected Army List does not match the submitted faction or sectorial."
    };

  return {
    valid: true,
    id: String(id),
    list: list
  };

}

function getResultSubmissionFormRowNumberForGameId(gameId) {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.FORM);

  if (!sheet)
    return 0;

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return 0;

  values.shift();

  let validGameId =
    0;

  for (let index = 0; index < values.length; index += 1) {
    if (!validateGame(values[index]))
      continue;

    validGameId += 1;

    if (validGameId === Number(gameId))
      return index + 2;
  }

  return 0;

}

function getResultSubmissionApprovedArmyListById(id) {

  if (typeof getArmyListObjects !== "function")
    return null;

  return getArmyListObjects()
    .filter(function(list) {
      return list.approved && Number(list.id) === Number(id);
    })[0] || null;

}

function resultSubmissionArmyListMatchesFaction(list, faction) {

  const selected =
    canonicalizeArmyName(faction);

  if (!selected)
    return false;

  const listFaction =
    canonicalizeArmyName(list.faction);

  const listSectorial =
    canonicalizeArmyName(list.sectorial);

  return (
    selected === listFaction ||
    selected === listSectorial ||
    canonicalizeArmyParentFaction(selected) === listFaction
  );

}

function ensureResultSubmissionArmyListHeaders(sheet) {

  const required = [
    {
      column: FORM.WINNER_ARMY_LIST_ID,
      header: "Winner Army List ID"
    },
    {
      column: FORM.LOSER_ARMY_LIST_ID,
      header: "Loser Army List ID"
    }
  ];

  required.forEach(function(item) {
    const cell =
      sheet.getRange(1, item.column + 1);

    if (getResultSubmissionString(cell.getValue()) === "")
      cell.setValue(item.header);
  });

}

function appendCanonicalGameSubmissionRecord(record) {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.FORM);

  if (!sheet)
    throw new Error("Result datastore was not found.");

  const armyCodeColumns =
    ensureResultSubmissionArmyCodeColumns(sheet);

  ensureResultSubmissionArmyListHeaders(sheet);

  const sourceColumns =
    ensureResultSubmissionCanonicalColumns(sheet);

  const sourceType =
    getResultSubmissionString(record.sourceType);

  const sourceResultId =
    getResultSubmissionString(record.sourceResultId);

  if (
    sourceType !== "" &&
    sourceResultId !== "" &&
    hasCanonicalGameSubmissionRecord(
      sheet,
      sourceColumns,
      sourceType,
      sourceResultId
    )
  )
    return {
      appended: false,
      sourceResultId: sourceResultId,
      sourceType: sourceType
    };

  const row = [];

  row[FORM.TIMESTAMP] =
    getResultSubmissionString(record.timestamp) ||
    getResultSubmissionTimestamp();
  row[FORM.DIVISION] =
    getResultSubmissionString(record.division);
  row[FORM.DATE] =
    getResultSubmissionString(record.date) ||
    getResultSubmissionDate();
  row[FORM.MISSION] =
    getResultSubmissionString(record.mission);
  row[FORM.PLAYER1] =
    getResultSubmissionString(record.player1);
  row[FORM.PLAYER2] =
    getResultSubmissionString(record.player2);
  row[FORM.P1TP] =
    Number(record.player1Tp) || 0;
  row[FORM.P2TP] =
    Number(record.player2Tp) || 0;
  row[FORM.P1OP] =
    Number(record.player1Op) || 0;
  row[FORM.P2OP] =
    Number(record.player2Op) || 0;
  row[FORM.P1VP] =
    Number(record.player1Vp) || 0;
  row[FORM.P2VP] =
    Number(record.player2Vp) || 0;
  row[FORM.FIRSTTURN] =
    getResultSubmissionString(record.firstTurn);
  row[FORM.WINNINGFACTION] =
    canonicalizeArmyName(record.winningFaction);
  row[FORM.LOSINGFACTION] =
    canonicalizeArmyName(record.losingFaction);
  row[FORM.MOMENT] =
    getResultSubmissionString(record.bestMoment);
  row[FORM.EVENT_ID] =
    getResultSubmissionString(record.eventId);
  row[FORM.GAME_TYPE] =
    normalizeGameType(record.gameType);
  row[FORM.GAME_RESULT] =
    getResultSubmissionString(record.gameResult);
  row[armyCodeColumns.player1ArmyCode] =
    getResultSubmissionString(record.player1ArmyCode);
  row[armyCodeColumns.player2ArmyCode] =
    getResultSubmissionString(record.player2ArmyCode);
  row[FORM.WINNER_ARMY_LIST_ID] =
    getResultSubmissionString(record.winnerArmyListId);
  row[FORM.LOSER_ARMY_LIST_ID] =
    getResultSubmissionString(record.loserArmyListId);
  row[sourceColumns.sourceType] =
    sourceType;
  row[sourceColumns.sourceResultId] =
    sourceResultId;

  sheet.appendRow(row);

  return {
    appended: true,
    sourceResultId: sourceResultId,
    sourceType: sourceType
  };

}

function ensureResultSubmissionCanonicalColumns(sheet) {

  const requiredHeaders = [
    RESULT_SUBMISSION_CANONICAL_HEADERS.SOURCE_TYPE,
    RESULT_SUBMISSION_CANONICAL_HEADERS.SOURCE_RESULT_ID
  ];

  const headerRange =
    sheet.getRange(
      1,
      1,
      1,
      Math.max(
        sheet.getLastColumn(),
        FORM.LOSER_ARMY_LIST_ID + 1
      )
    );

  const headers =
    headerRange
      .getValues()[0]
      .map(getResultSubmissionString);

  requiredHeaders.forEach(function(header) {
    if (headers.indexOf(header) === -1) {
      headers.push(header);
      sheet
        .getRange(
          1,
          headers.length
        )
        .setValue(header);
    }
  });

  return {
    sourceType:
      headers.indexOf(
        RESULT_SUBMISSION_CANONICAL_HEADERS.SOURCE_TYPE
      ),
    sourceResultId:
      headers.indexOf(
        RESULT_SUBMISSION_CANONICAL_HEADERS.SOURCE_RESULT_ID
      )
  };

}

function hasCanonicalGameSubmissionRecord(
  sheet,
  sourceColumns,
  sourceType,
  sourceResultId
) {

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return false;

  const typeTarget =
    normalizeResultSubmissionValue(sourceType);

  const idTarget =
    normalizeResultSubmissionValue(sourceResultId);

  return values
    .slice(1)
    .some(function(row) {
      return (
        normalizeResultSubmissionValue(row[sourceColumns.sourceType]) === typeTarget &&
        normalizeResultSubmissionValue(row[sourceColumns.sourceResultId]) === idTarget
      );
    });

}

function getCanonicalGameSubmissionSourceIds(sourceType) {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.FORM);

  if (!sheet)
    return {};

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return {};

  const headers =
    values.shift().map(getResultSubmissionString);

  const sourceTypeColumn =
    headers.indexOf(
      RESULT_SUBMISSION_CANONICAL_HEADERS.SOURCE_TYPE
    );

  const sourceResultIdColumn =
    headers.indexOf(
      RESULT_SUBMISSION_CANONICAL_HEADERS.SOURCE_RESULT_ID
    );

  if (sourceTypeColumn === -1 || sourceResultIdColumn === -1)
    return {};

  const sourceTypeTarget =
    normalizeResultSubmissionValue(sourceType);

  const ids = {};

  values.forEach(function(row) {
    if (
      normalizeResultSubmissionValue(row[sourceTypeColumn]) !==
      sourceTypeTarget
    )
      return;

    const sourceResultId =
      getResultSubmissionString(row[sourceResultIdColumn]);

    if (sourceResultId !== "")
      ids[sourceResultId] = true;
  });

  return ids;

}

function getResultSubmissionCommissionerContext(auth, params) {

  const enabled =
    getResultSubmissionBoolean(params.commissionerMode);

  const override =
    enabled && getResultSubmissionBoolean(params.commissionerOverride);

  if (!enabled)
    return {
      enabled: false,
      override: false,
      reason: "",
      commissioner: ""
    };

  const allowed =
    auth &&
    auth.user &&
    typeof userHasPermission === "function" &&
    userHasPermission(auth.user.role, "runSeasonControl");

  if (!allowed)
    return {
      enabled: false,
      override: false,
      reason: "",
      commissioner: "",
      error: "Commissioner mode is only available to commissioners."
    };

  return {
    enabled: true,
    override: override,
    reason: getResultSubmissionString(params.commissionerReason),
    commissioner:
      auth.user.playerDisplayName ||
      getCanonicalPlayerFromUser(auth.user) ||
      auth.user.displayName ||
      auth.user.email ||
      "Commissioner"
  };

}

function getResultSubmissionBoolean(value) {

  const normalized =
    normalizeResultSubmissionValue(value);

  return (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "1"
  );

}

function recordResultSubmissionCommissionerAudit(context, gameType, details) {

  if (!context || !context.enabled)
    return;

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName("Commissioner Submission Audit");

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet("Commissioner Submission Audit");

    sheet.appendRow([
      "Timestamp",
      "Commissioner",
      "Game Type",
      "Event ID",
      "Player 1",
      "Player 2",
      "Mission",
      "Result",
      "Winner Army List ID",
      "Loser Army List ID",
      "Override Used",
      "Reason"
    ]);
  }

  sheet.appendRow([
    getResultSubmissionTimestamp(),
    context.commissioner,
    gameType,
    details.eventId || "",
    details.player || "",
    details.opponent || "",
    details.mission || "",
    details.result || "",
    details.winnerArmyListId || "",
    details.loserArmyListId || "",
    context.override ? "TRUE" : "FALSE",
    context.reason || ""
  ]);

}

function recordArmyListLinkAudit(details) {

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName("Army List Link Audit");

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet("Army List Link Audit");

    sheet.appendRow([
      "Timestamp",
      "Commissioner",
      "Game ID",
      "Event ID",
      "Winner",
      "Loser",
      "Previous Winner Army List ID",
      "Previous Loser Army List ID",
      "Winner Army List ID",
      "Loser Army List ID",
      "Reason"
    ]);
  }

  sheet.appendRow([
    getResultSubmissionTimestamp(),
    details.commissioner || "",
    details.gameId || "",
    details.eventId || "",
    details.winner || "",
    details.loser || "",
    details.previousWinnerArmyListId || "",
    details.previousLoserArmyListId || "",
    details.winnerArmyListId || "",
    details.loserArmyListId || "",
    details.reason || ""
  ]);

}

function getResultSubmissionString(value) {

  if (value === null || typeof value === "undefined")
    return "";

  return String(value).trim();

}

function normalizeResultSubmissionValue(value) {

  return getResultSubmissionString(value).toLowerCase();

}

function parseResultSubmissionScore(value) {

  const raw =
    getResultSubmissionString(value);

  if (raw === "")
    return null;

  const parsed =
    Number(raw);

  if (!isFinite(parsed) || parsed < 0)
    return null;

  return parsed;

}

function isLeagueResultEventAcceptingResults(event) {

  const status =
    (
      getResultSubmissionString(event.status) +
      " " +
      getResultSubmissionString(event.lifecycleStage)
    ).toLowerCase();

  return (
    status.indexOf("archived") === -1 &&
    status.indexOf("completed") === -1 &&
    status.indexOf("registration open") === -1
  );

}

function isResultSubmissionRegisteredPlayer(registrations, player) {

  const target =
    normalizeResultSubmissionValue(player);

  return registrations.some(function(registration) {
    return normalizeResultSubmissionValue(registration.player) === target;
  });

}

function hasExistingLeagueResult(eventId, player, opponent) {

  const targetPlayer =
    normalizeResultSubmissionValue(player);

  const targetOpponent =
    normalizeResultSubmissionValue(opponent);

  return getFormResponses().some(function(row) {
    if (getGameEngineEventId(row) !== eventId)
      return false;

    const first =
      normalizeResultSubmissionValue(row[FORM.PLAYER1]);

    const second =
      normalizeResultSubmissionValue(row[FORM.PLAYER2]);

    return (
      (first === targetPlayer && second === targetOpponent) ||
      (first === targetOpponent && second === targetPlayer)
    );
  });

}

function determineLeagueSubmissionWinner(
  player,
  opponent,
  playerTp,
  opponentTp,
  playerOp,
  opponentOp,
  playerVp,
  opponentVp
) {

  if (playerTp !== opponentTp)
    return playerTp > opponentTp ? player : opponent;

  if (playerOp !== opponentOp)
    return playerOp > opponentOp ? player : opponent;

  if (playerVp !== opponentVp)
    return playerVp > opponentVp ? player : opponent;

  return "Draw";

}

function getResultSubmissionTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getResultSubmissionDate() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

}

function invalidateResultSubmissionCaches() {

  if (typeof invalidatePortalCacheGroup === "function") {
    invalidatePortalCacheGroup("dashboard");
    invalidatePortalCacheGroup("events");
    invalidatePortalCacheGroup("standings");
    invalidatePortalCacheGroup("players");
    invalidatePortalCacheGroup("armyLists");
    invalidatePortalCacheGroup("search");
  }

}
