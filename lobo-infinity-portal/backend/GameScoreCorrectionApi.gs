/*******************************************************
 * GameScoreCorrectionApi.gs
 *
 * Commissioner-only score corrections for existing
 * game result records.
 *******************************************************/

const GAME_SCORE_CORRECTION_AUDIT_HEADERS = [
  "Timestamp",
  "Game ID",
  "Event ID",
  "Player 1",
  "Player 2",
  "Previous TP",
  "Previous OP",
  "Previous VP",
  "New TP",
  "New OP",
  "New VP",
  "Corrected Fields",
  "Commissioner",
  "Reason"
];

function correctGameScore(e, auth) {

  const params =
    getApiParameters(e);

  const gameId =
    Number(getApiParameter(params, "gameId")) || 0;

  const reason =
    getApiParameter(params, "reason");

  if (!gameId)
    return gameScoreCorrectionFailure("A valid gameId is required.");

  if (!reason)
    return gameScoreCorrectionFailure("A correction reason is required.");

  const target =
    getGameScoreCorrectionTarget(gameId);

  if (!target.found)
    return gameScoreCorrectionFailure(target.error);

  const expectation =
    validateGameScoreCorrectionExpectations(
      params,
      target
    );

  if (!expectation.valid)
    return gameScoreCorrectionFailure(expectation.error);

  let updates;

  try {
    updates =
      getGameScoreCorrectionUpdates(params);
  }
  catch (err) {
    return gameScoreCorrectionFailure(
      String(err && err.message ? err.message : err)
    );
  }

  if (updates.length === 0)
    return gameScoreCorrectionFailure("At least one complete score pair is required.");

  const before =
    buildGameScoreCorrectionSnapshot(target.row);

  const after =
    buildGameScoreCorrectionAfterSnapshot(before, updates);

  if (
    before.tp === after.tp &&
    before.op === after.op &&
    before.vp === after.vp
  )
    return gameScoreCorrectionFailure("Corrected scores match the stored scores.");

  updates.forEach(function(update) {
    target.sheet
      .getRange(
        target.rowNumber,
        update.player1Column + 1
      )
      .setValue(update.player1);

    target.sheet
      .getRange(
        target.rowNumber,
        update.player2Column + 1
      )
      .setValue(update.player2);
  });

  if (typeof rebuildEverything === "function")
    rebuildEverything();
  else if (typeof rebuildGameEngine === "function")
    rebuildGameEngine();

  recordGameScoreCorrectionAudit({
    commissioner:
      getGameScoreCorrectionCommissioner(auth),
    correctedFields:
      updates.map(function(update) {
        return update.label;
      }).join(", "),
    eventId: target.eventId,
    gameId: gameId,
    player1: target.player1,
    player2: target.player2,
    previous: before,
    next: after,
    reason: reason
  });

  if (typeof invalidatePortalCacheGroup === "function")
    invalidatePortalCacheGroup("all");

  return jsonOutput({
    success: true,
    auditWritten: true,
    cacheInvalidated: "all",
    derivedAnalyticsRebuilt:
      typeof rebuildEverything === "function",
    gameEngineRebuilt:
      typeof rebuildEverything === "function" ||
      typeof rebuildGameEngine === "function",
    gameId: gameId,
    eventId: target.eventId,
    players: {
      player1: target.player1,
      player2: target.player2
    },
    correctedFields:
      updates.map(function(update) {
        return update.label;
      }),
    before: before,
    after: after
  });

}

function getGameScoreCorrectionTarget(gameId) {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.FORM);

  if (!sheet)
    return {
      found: false,
      error: "Result datastore was not found."
    };

  const rowNumber =
    gameId + 1;

  if (
    rowNumber < 2 ||
    rowNumber > sheet.getLastRow()
  )
    return {
      found: false,
      error: "Game ID was not found."
    };

  const width =
    Math.max(
      sheet.getLastColumn(),
      FORM.GAME_RESULT + 1
    );

  const headers =
    sheet
      .getRange(1, 1, 1, width)
      .getValues()[0];

  const row =
    sheet
      .getRange(rowNumber, 1, 1, width)
      .getValues()[0];

  row.__formHeaders =
    headers;

  if (!validateGame(row))
    return {
      found: false,
      error: "Game row is not a valid game result."
    };

  return {
    eventId:
      getGameEngineFormValue(
        row,
        "Event ID",
        FORM.EVENT_ID
      ),
    found: true,
    player1:
      getResultSubmissionString(row[FORM.PLAYER1]),
    player2:
      getResultSubmissionString(row[FORM.PLAYER2]),
    row: row,
    rowNumber: rowNumber,
    sheet: sheet
  };

}

function validateGameScoreCorrectionExpectations(params, target) {

  const checks = [
    {
      key: "expectedEventId",
      label: "eventId",
      actual: target.eventId
    },
    {
      key: "expectedPlayer1",
      label: "player1",
      actual: target.player1
    },
    {
      key: "expectedPlayer2",
      label: "player2",
      actual: target.player2
    },
    {
      key: "expectedTp",
      label: "TP",
      actual:
        getGameScoreCorrectionPair(
          target.row,
          FORM.P1TP,
          FORM.P2TP
        )
    },
    {
      key: "expectedOp",
      label: "OP",
      actual:
        getGameScoreCorrectionPair(
          target.row,
          FORM.P1OP,
          FORM.P2OP
        )
    },
    {
      key: "expectedVp",
      label: "VP",
      actual:
        getGameScoreCorrectionPair(
          target.row,
          FORM.P1VP,
          FORM.P2VP
        )
    }
  ];

  for (let index = 0; index < checks.length; index++) {
    const check =
      checks[index];

    const expected =
      getApiParameter(params, check.key);

    if (
      expected !== "" &&
      normalizeGameScoreCorrectionValue(expected) !==
        normalizeGameScoreCorrectionValue(check.actual)
    )
      return {
        valid: false,
        error:
          "Expected " +
          check.label +
          " " +
          expected +
          " but found " +
          check.actual +
          "."
      };
  }

  return {
    valid: true
  };

}

function getGameScoreCorrectionUpdates(params) {

  const specs = [
    {
      label: "TP",
      player1Key: "player1TournamentPoints",
      player2Key: "player2TournamentPoints",
      player1Column: FORM.P1TP,
      player2Column: FORM.P2TP
    },
    {
      label: "OP",
      player1Key: "player1ObjectivePoints",
      player2Key: "player2ObjectivePoints",
      player1Column: FORM.P1OP,
      player2Column: FORM.P2OP
    },
    {
      label: "VP",
      player1Key: "player1VictoryPoints",
      player2Key: "player2VictoryPoints",
      player1Column: FORM.P1VP,
      player2Column: FORM.P2VP
    }
  ];

  return specs
    .map(function(spec) {
      const player1Raw =
        getApiParameter(params, spec.player1Key);

      const player2Raw =
        getApiParameter(params, spec.player2Key);

      if (
        player1Raw === "" &&
        player2Raw === ""
      )
        return null;

      if (
        player1Raw === "" ||
        player2Raw === ""
      )
        throw new Error(spec.label + " corrections require both player scores.");

      const player1 =
        parseGameScoreCorrectionScore(player1Raw);

      const player2 =
        parseGameScoreCorrectionScore(player2Raw);

      if (
        player1 === null ||
        player2 === null
      )
        throw new Error(spec.label + " corrections must be non-negative numbers.");

      return {
        label: spec.label,
        player1: player1,
        player2: player2,
        player1Column: spec.player1Column,
        player2Column: spec.player2Column
      };
    })
    .filter(function(update) {
      return update !== null;
    });

}

function buildGameScoreCorrectionSnapshot(row) {

  return {
    tp:
      getGameScoreCorrectionPair(
        row,
        FORM.P1TP,
        FORM.P2TP
      ),
    op:
      getGameScoreCorrectionPair(
        row,
        FORM.P1OP,
        FORM.P2OP
      ),
    vp:
      getGameScoreCorrectionPair(
        row,
        FORM.P1VP,
        FORM.P2VP
      )
  };

}

function buildGameScoreCorrectionAfterSnapshot(before, updates) {

  const after = {
    tp: before.tp,
    op: before.op,
    vp: before.vp
  };

  updates.forEach(function(update) {
    const value =
      update.player1 + "-" + update.player2;

    if (update.label === "TP")
      after.tp = value;

    if (update.label === "OP")
      after.op = value;

    if (update.label === "VP")
      after.vp = value;
  });

  return after;

}

function getGameScoreCorrectionPair(row, player1Column, player2Column) {

  return (
    getGameScoreCorrectionScoreText(row[player1Column]) +
    "-" +
    getGameScoreCorrectionScoreText(row[player2Column])
  );

}

function parseGameScoreCorrectionScore(value) {

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

function getGameScoreCorrectionScoreText(value) {

  const numeric =
    Number(value);

  if (isFinite(numeric))
    return String(numeric);

  return getResultSubmissionString(value);

}

function normalizeGameScoreCorrectionValue(value) {

  return getResultSubmissionString(value)
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();

}

function recordGameScoreCorrectionAudit(record) {

  const sheet =
    getGameScoreCorrectionAuditSheet();

  sheet.appendRow([
    getResultSubmissionTimestamp(),
    record.gameId,
    record.eventId,
    record.player1,
    record.player2,
    record.previous.tp,
    record.previous.op,
    record.previous.vp,
    record.next.tp,
    record.next.op,
    record.next.vp,
    record.correctedFields,
    record.commissioner,
    record.reason
  ]);

}

function getGameScoreCorrectionAuditSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.GAME_SCORE_CORRECTION_AUDIT);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.GAME_SCORE_CORRECTION_AUDIT);

  const range =
    sheet.getRange(1, 1, 1, GAME_SCORE_CORRECTION_AUDIT_HEADERS.length);

  const headers =
    range.getValues()[0];

  const matches =
    GAME_SCORE_CORRECTION_AUDIT_HEADERS.every(function(header, index) {
      return headers[index] === header;
    });

  if (!matches)
    range.setValues([GAME_SCORE_CORRECTION_AUDIT_HEADERS]);

  return sheet;

}

function getGameScoreCorrectionCommissioner(auth) {

  if (!auth || !auth.user)
    return "";

  return (
    auth.user.email ||
    auth.user.playerDisplayName ||
    getCanonicalPlayerFromUser(auth.user) ||
    auth.user.displayName ||
    "Commissioner"
  );

}

function gameScoreCorrectionFailure(message) {

  return jsonOutput({
    success: false,
    error: message
  });

}
