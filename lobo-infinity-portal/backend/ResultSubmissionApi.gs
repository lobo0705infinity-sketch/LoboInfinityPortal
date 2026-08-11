/*******************************************************
 * ResultSubmissionApi.gs
 *
 * Portal-native player result submission.
 * Reuses Form Responses and the existing Game Engine rebuild.
 *******************************************************/

function submitLeagueResult(e) {

  return requireApiPermission(e, "canSubmitLeagueGames", function(auth) {
    const params =
      getApiParameters(e);

    const commissionerContext =
      getResultSubmissionCommissionerContext(auth, params);

    if (commissionerContext.error)
      return resultSubmissionFailure(commissionerContext.error);

    const validation =
      validateCanonicalGame({
        source: "portal",
        workflow: "league",
        params: params,
        auth: auth,
        commissionerContext: commissionerContext
      });

    if (!validation.valid)
      return resultSubmissionFailure(validation.error);

    const validated = validation.value;
    const eventId = validated.eventId;
    const player = validated.player;
    const opponent = validated.opponent;
    const playerTp = validated.playerTp;
    const opponentTp = validated.opponentTp;
    const playerOp = validated.playerOp;
    const opponentOp = validated.opponentOp;
    const playerVp = validated.playerVp;
    const opponentVp = validated.opponentVp;
    const playerFaction = validated.playerFaction;
    const opponentFaction = validated.opponentFaction;
    const playerArmyList = validated.playerArmyList;
    const opponentArmyList = validated.opponentArmyList;
    const playerIsWinner = validated.playerIsWinner;
    const resultIsDraw = validated.resultIsDraw;

    const submissionTimestamp =
      getResultSubmissionTimestamp();

    const submissionDate =
      getResultSubmissionDate();

    const playerArmyCode =
      getResultSubmissionArmyCode(
        params.playerArmyCode ||
        (playerArmyList.list && playerArmyList.list.armyCode)
      );
    const opponentArmyCode =
      getResultSubmissionArmyCode(
        params.opponentArmyCode ||
        (opponentArmyList.list && opponentArmyList.list.armyCode)
      );

    const row =
      buildCanonicalGameRow({
        timestamp: submissionTimestamp,
        date: submissionDate,
        division: getResultSubmissionString(params.division),
        mission: getResultSubmissionString(params.mission),
        player: player,
        opponent: opponent,
        playerTp: playerTp,
        opponentTp: opponentTp,
        playerOp: playerOp,
        opponentOp: opponentOp,
        playerVp: playerVp,
        opponentVp: opponentVp,
        firstTurn: getResultSubmissionString(params.firstTurn),
        playerFaction: playerFaction,
        opponentFaction: opponentFaction,
        bestMoment: getResultSubmissionString(params.bestMoment),
        eventId: eventId,
        gameType: "league",
        outcome: resultIsDraw
          ? "draw"
          : playerIsWinner
            ? "player"
            : "opponent",
        playerArmyCode: playerArmyCode,
        opponentArmyCode: opponentArmyCode,
        playerArmyListId: getResultSubmissionArmyListId(playerArmyList, playerArmyCode),
        opponentArmyListId: getResultSubmissionArmyListId(opponentArmyList, opponentArmyCode)
      });

    const sheet =
      lifGetTargetSpreadsheet_()
        .getSheetByName(CONFIG.SHEETS.FORM);

    if (!sheet)
      return resultSubmissionFailure("Result datastore was not found.");

    ensureResultSubmissionArmyListHeaders(sheet);

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

    if (typeof rebuildEverything === "function")
      rebuildEverything();
    else if (typeof rebuildGameEngine === "function")
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

    const validation =
      validateCanonicalGame({
        source: "portal",
        workflow: "casual",
        params: params,
        auth: auth,
        commissionerContext: commissionerContext
      });

    if (!validation.valid)
      return resultSubmissionFailure(validation.error);

    const validated = validation.value;
    const player = validated.player;
    const opponent = validated.opponent;
    const playerTp = validated.playerTp;
    const opponentTp = validated.opponentTp;
    const playerOp = validated.playerOp;
    const opponentOp = validated.opponentOp;
    const playerVp = validated.playerVp;
    const opponentVp = validated.opponentVp;
    const playerFaction = validated.playerFaction;
    const opponentFaction = validated.opponentFaction;
    const playerArmyList = validated.playerArmyList;
    const opponentArmyList = validated.opponentArmyList;
    const playerIsWinner = validated.playerIsWinner;
    const resultIsDraw = validated.resultIsDraw;

    const submissionTimestamp =
      getResultSubmissionTimestamp();

    const submissionDate =
      getResultSubmissionDate();

    const playerArmyCode =
      getResultSubmissionArmyCode(
        params.playerArmyCode ||
        (playerArmyList.list && playerArmyList.list.armyCode)
      );
    const opponentArmyCode =
      getResultSubmissionArmyCode(
        params.opponentArmyCode ||
        (opponentArmyList.list && opponentArmyList.list.armyCode)
      );

    const row =
      buildCanonicalGameRow({
        timestamp: submissionTimestamp,
        date: submissionDate,
        division: "Casual",
        mission: getResultSubmissionString(params.mission),
        player: player,
        opponent: opponent,
        playerTp: playerTp,
        opponentTp: opponentTp,
        playerOp: playerOp,
        opponentOp: opponentOp,
        playerVp: playerVp,
        opponentVp: opponentVp,
        firstTurn: getResultSubmissionString(params.firstTurn),
        playerFaction: playerFaction,
        opponentFaction: opponentFaction,
        bestMoment: getResultSubmissionString(params.bestMoment),
        eventId: "",
        gameType: "casual",
        outcome: resultIsDraw
          ? "draw"
          : playerIsWinner
            ? "player"
            : "opponent",
        playerArmyCode: playerArmyCode,
        opponentArmyCode: opponentArmyCode,
        playerArmyListId: getResultSubmissionArmyListId(playerArmyList, playerArmyCode),
        opponentArmyListId: getResultSubmissionArmyListId(opponentArmyList, opponentArmyCode)
      });

    const sheet =
      lifGetTargetSpreadsheet_()
        .getSheetByName(CONFIG.SHEETS.FORM);

    if (!sheet)
      return resultSubmissionFailure("Result datastore was not found.");

    ensureResultSubmissionArmyListHeaders(sheet);

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

    if (typeof rebuildEverything === "function")
      rebuildEverything();
    else if (typeof rebuildGameEngine === "function")
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
      lifGetTargetSpreadsheet_()
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

function validateResultSubmissionArmyListId(value, player, faction, armyCode) {

  const normalizedArmyCode =
    normalizeResultSubmissionArmyCode(armyCode);

  if (normalizedArmyCode)
    return {
      valid: true,
      id:
        typeof buildCanonicalArmyCodeArmyListId === "function"
          ? String(buildCanonicalArmyCodeArmyListId(normalizedArmyCode))
          : "",
      list: null
    };

  const id =
    Number(value) || 0;

  if (id <= 0)
    return validateResultSubmissionMissingArmyListId(
      player,
      faction
    );

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
    faction &&
    !resultSubmissionArmyListMatchesFaction(list, faction)
  )
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

function validateResultSubmissionMissingArmyListId(player, faction) {

  return {
    valid: false,
    id: "",
    list: null,
    error: "Army Code or Army List selection is required."
  };

}

function getResultSubmissionArmyListId(armyList, armyCode) {

  const normalizedArmyCode =
    normalizeResultSubmissionArmyCode(armyCode);

  if (normalizedArmyCode && typeof buildCanonicalArmyCodeArmyListId === "function")
    return String(buildCanonicalArmyCodeArmyListId(normalizedArmyCode));

  return armyList && armyList.id
    ? armyList.id
    : "";

}

function getResultSubmissionArmyCode(value) {

  return normalizeResultSubmissionArmyCode(value);

}

function normalizeResultSubmissionArmyCode(value) {

  if (typeof normalizeCanonicalArmyListCode === "function")
    return normalizeCanonicalArmyListCode(value);

  return getResultSubmissionString(value)
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "");

}

function getResultSubmissionFormRowNumberForGameId(gameId) {

  const sheet =
    lifGetTargetSpreadsheet_()
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
      column: FORM.PLAYER1_ARMY_CODE,
      header: "Player 1 Army Code"
    },
    {
      column: FORM.PLAYER2_ARMY_CODE,
      header: "Player 2 Army Code"
    },
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
