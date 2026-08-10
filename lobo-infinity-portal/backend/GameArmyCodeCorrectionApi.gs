/*******************************************************
 * GameArmyCodeCorrectionApi.gs
 *
 * Commissioner-only corrections for Army Codes attached
 * to existing game result records.
 *******************************************************/

const GAME_ARMY_CODE_CORRECTION_AUDIT_HEADERS = [
  "Timestamp",
  "Game ID",
  "Player Role",
  "Player",
  "Previous Army Code Hash",
  "New Army Code Hash",
  "Commissioner",
  "Reason"
];

function correctGameArmyCode(e, auth) {

  const params =
    getApiParameters(e);

  const gameId =
    Number(getApiParameter(params, "gameId")) || 0;

  const playerRole =
    getApiParameter(params, "playerRole")
      .toLowerCase();

  const correctedArmyCode =
    normalizeGameArmyCodeCorrectionCode(
      getApiParameter(params, "correctedArmyCode")
    );

  const reason =
    getApiParameter(params, "reason");

  if (!gameId)
    return gameArmyCodeCorrectionFailure("A valid gameId is required.");

  if (
    playerRole !== "winner" &&
    playerRole !== "loser"
  )
    return gameArmyCodeCorrectionFailure("playerRole must be winner or loser.");

  if (!correctedArmyCode)
    return gameArmyCodeCorrectionFailure("correctedArmyCode is required.");

  if (!reason)
    return gameArmyCodeCorrectionFailure("A correction reason is required.");

  const validation =
    validateSubmittedArmyCode(
      correctedArmyCode,
      ""
    );

  if (
    validation.blocking ||
    validation.severity === "Error" ||
    !validation.valid
  )
    return jsonOutput({
      success: false,
      error: "Corrected Army Code failed validation.",
      validation: validation
    });

  const decoded =
    decodeArmyCode(correctedArmyCode);

  const target =
    getGameArmyCodeCorrectionTarget(
      gameId,
      playerRole
    );

  if (!target.found)
    return gameArmyCodeCorrectionFailure(target.error);

  const previousArmyCode =
    target.previousArmyCode;

  const previousHash =
    getArmyIntelligenceHash(previousArmyCode);

  const newHash =
    getArmyIntelligenceHash(correctedArmyCode);

  if (previousHash === newHash)
    return gameArmyCodeCorrectionFailure("Corrected Army Code matches the stored Army Code.");

  target.sheet
    .getRange(
      target.rowNumber,
      target.armyCodeColumn + 1
    )
    .setValue(correctedArmyCode);

  if (typeof rebuildGameEngine === "function")
    rebuildGameEngine();

  const snapshot =
    regenerateCorrectedGameArmyIntelligenceSnapshot(
      gameId,
      playerRole,
      target.sourceType,
      correctedArmyCode,
      decoded
    );

  recordGameArmyCodeCorrectionAudit({
    commissioner:
      getGameArmyCodeCorrectionCommissioner(auth),
    gameId: gameId,
    newHash: newHash,
    player: target.player,
    playerRole: playerRole,
    previousHash: previousHash,
    reason: reason
  });

  if (typeof invalidatePortalCacheActions === "function")
    invalidatePortalCacheActions([
      "armyLists",
      "armyIntelligence"
    ]);

  return jsonOutput({
    success: true,
    auditWritten: true,
    cacheInvalidated: [
      "armyLists",
      "armyIntelligence"
    ],
    gameId: gameId,
    player: target.player,
    playerRole: playerRole,
    previousArmyCodeHash: previousHash,
    newArmyCodeHash: newHash,
    validation: validation,
    before: {
      points: target.previousDecode.points,
      unitCount: target.previousDecode.unitCount
    },
    after: {
      points: validation.derived.points,
      unitCount: validation.derived.unitCount
    },
    snapshot: snapshot
  });

}

function getGameArmyCodeCorrectionTarget(gameId, playerRole) {

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
      FORM.PLAYER2_ARMY_CODE + 1
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

  const winner =
    determineWinner(row);

  const playerNumber =
    getGameArmyCodeCorrectionPlayerNumber(
      winner,
      playerRole
    );

  const columns =
    ensureResultSubmissionArmyCodeColumns(sheet);

  const armyCodeColumn =
    playerNumber === 1
      ? columns.player1ArmyCode
      : columns.player2ArmyCode;

  const player =
    getResultSubmissionString(
      playerNumber === 1
        ? row[FORM.PLAYER1]
        : row[FORM.PLAYER2]
    );

  const previousArmyCode =
    getGameEngineFormValue(
      row,
      playerNumber === 1
        ? GAME_ENGINE_FORM_HEADERS.PLAYER1_ARMY_CODE
        : GAME_ENGINE_FORM_HEADERS.PLAYER2_ARMY_CODE,
      playerNumber === 1
        ? FORM.PLAYER1_ARMY_CODE
        : FORM.PLAYER2_ARMY_CODE
    );

  return {
    armyCodeColumn: armyCodeColumn,
    found: true,
    player: player,
    previousArmyCode: previousArmyCode,
    previousDecode:
      decodeArmyCode(previousArmyCode),
    row: row,
    rowNumber: rowNumber,
    sheet: sheet,
    sourceType:
      getGameEngineGameType(row) === "casual"
        ? "casual"
        : "league"
  };

}

function getGameArmyCodeCorrectionPlayerNumber(winner, playerRole) {

  if (winner === 0)
    return playerRole === "winner"
      ? 1
      : 2;

  return playerRole === "winner"
    ? winner
    : winner === 1 ? 2 : 1;

}

function regenerateCorrectedGameArmyIntelligenceSnapshot(gameId, playerRole, sourceType, armyCode, decoded) {

  const sources =
    buildArmyIntelligenceSources()
      .filter(function(source) {
        return (
          source.sourceType === sourceType &&
          String(source.sourceId) === String(gameId) &&
          source.sourcePlayer === playerRole
        );
      });

  if (sources.length !== 1)
    throw new Error("Expected exactly one Army Intelligence source for corrected game Army Code.");

  const source =
    sources[0];

  if (source.armyCode !== armyCode)
    throw new Error("Corrected Army Intelligence source does not match the stored Army Code.");

  removeArmyIntelligenceSnapshotsForSource(
    source.sourceType,
    source.sourceId,
    source.sourcePlayer
  );

  const snapshotJson =
    buildGameArmyCodeCorrectionDecodedSnapshot(
      armyCode,
      decoded
    );

  upsertArmyIntelligenceRows([
    buildArmyIntelligenceSnapshotRow(
      source,
      {
        decoded: snapshotJson,
        decodedAt: getResultSubmissionTimestamp(),
        error: "",
        snapshotKey: source.snapshotKey,
        status: "decoded"
      }
    )
  ]);

  const unitCount =
    snapshotJson.combatGroups.reduce(function(total, group) {
      return total + group.entries.length;
    }, 0);

  if (
    snapshotJson.totals.points !== decoded.points ||
    unitCount !== decoded.unitCount
  )
    throw new Error("Regenerated Army Intelligence snapshot does not match decoded Army Code.");

  return {
    regenerated: true,
    snapshotKey: source.snapshotKey,
    points: snapshotJson.totals.points,
    swc: snapshotJson.totals.swc,
    unitCount: unitCount
  };

}

function buildGameArmyCodeCorrectionDecodedSnapshot(armyCode, decoded) {

  const groups = {};

  decoded.roster.forEach(function(profile) {
    const combatGroup =
      Number(profile.combatGroup) || 1;

    if (!groups[combatGroup])
      groups[combatGroup] = [];

    groups[combatGroup].push(profile);
  });

  const combatGroups =
    Object.keys(groups)
      .sort(function(left, right) {
        return Number(left) - Number(right);
      })
      .map(function(group) {
        return {
          combatGroup: Number(group),
          entries: groups[group]
        };
      });

  return {
    armyCode: armyCode,
    combatGroups: combatGroups,
    decoderVersion: decoded.decoderVersion,
    faction: decoded.faction,
    incomplete: false,
    listName: decoded.armyName,
    orderCounts: getGameArmyCodeCorrectionOrderCounts(decoded.roster),
    sectorial: decoded.sectorial,
    sectorialId: "",
    source: {
      decoder: "shared production decoder",
      resolver: ARMY_CODE_VALIDATION_DEFAULTS.resolverUrl
    },
    totals: {
      combatGroups: decoded.combatGroups,
      points: decoded.points,
      swc: decoded.swc
    },
    warnings: decoded.parserWarnings || []
  };

}

function getGameArmyCodeCorrectionOrderCounts(roster) {

  return roster.reduce(function(counts, profile) {
    const orderTypes =
      profile.orderTypes || [];

    if (orderTypes.indexOf("regular") !== -1)
      counts.regular++;

    if (orderTypes.indexOf("irregular") !== -1)
      counts.irregular++;

    if (orderTypes.indexOf("lieutenant") !== -1)
      counts.lieutenant++;

    if (orderTypes.indexOf("impetuous") !== -1)
      counts.impetuous++;

    return counts;
  }, {
    impetuous: 0,
    irregular: 0,
    lieutenant: 0,
    regular: 0
  });

}

function removeArmyIntelligenceSnapshotsForSource(sourceType, sourceId, sourcePlayer) {

  const sheet =
    ensureArmyIntelligenceSheet();

  if (sheet.getLastRow() < 2)
    return;

  const values =
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, ARMY_INTELLIGENCE_HEADERS.length)
      .getValues();

  for (let index = values.length - 1; index >= 0; index--) {
    const row =
      values[index];

    if (
      getArmyIntelligenceString(row[ARMY_INTELLIGENCE_COLUMNS.SOURCE_TYPE]) === sourceType &&
      getArmyIntelligenceString(row[ARMY_INTELLIGENCE_COLUMNS.SOURCE_ID]) === String(sourceId) &&
      getArmyIntelligenceString(row[ARMY_INTELLIGENCE_COLUMNS.SOURCE_PLAYER]) === sourcePlayer
    )
      sheet.deleteRow(index + 2);
  }

}

function recordGameArmyCodeCorrectionAudit(record) {

  const sheet =
    getGameArmyCodeCorrectionAuditSheet();

  sheet.appendRow([
    getResultSubmissionTimestamp(),
    record.gameId,
    record.playerRole,
    record.player,
    record.previousHash,
    record.newHash,
    record.commissioner,
    record.reason
  ]);

}

function getGameArmyCodeCorrectionAuditSheet() {

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.GAME_ARMY_CODE_CORRECTION_AUDIT);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.GAME_ARMY_CODE_CORRECTION_AUDIT);

  const range =
    sheet.getRange(1, 1, 1, GAME_ARMY_CODE_CORRECTION_AUDIT_HEADERS.length);

  const headers =
    range.getValues()[0];

  const matches =
    GAME_ARMY_CODE_CORRECTION_AUDIT_HEADERS.every(function(header, index) {
      return headers[index] === header;
    });

  if (!matches)
    range.setValues([GAME_ARMY_CODE_CORRECTION_AUDIT_HEADERS]);

  return sheet;

}

function normalizeGameArmyCodeCorrectionCode(value) {

  const raw =
    getResultSubmissionString(value);

  if (raw.indexOf("%") === -1)
    return raw;

  try {
    return decodeURIComponent(raw).trim();
  }
  catch (err) {
    return raw;
  }

}

function getGameArmyCodeCorrectionCommissioner(auth) {

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

function gameArmyCodeCorrectionFailure(message) {

  return jsonOutput({
    success: false,
    error: message
  });

}
