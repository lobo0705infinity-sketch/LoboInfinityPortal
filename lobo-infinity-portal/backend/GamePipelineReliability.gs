/** Persistent canonical identities and a row-local transactional outbox. */
const GAME_PIPELINE_COLUMNS = { ID: 25, SUBMISSION: 26, OUTBOX: 27 };
const GAME_PIPELINE_HEADERS = ["Game ID", "Submission ID", "Automation State"];

function withGamePipelineLock_(work) {
  const lock = LockService.getScriptLock();
  const acquired = !lock.hasLock();
  if (acquired) lock.waitLock(30000);
  try { return work(); } finally { if (acquired) lock.releaseLock(); }
}

function ensureCanonicalGameIdentities_(sheet) {
  if (!sheet) throw new Error("Canonical game datastore is missing.");
  return withGamePipelineLock_(function() {
    if (sheet.getMaxColumns() < 28) sheet.insertColumnsAfter(sheet.getMaxColumns(), 28 - sheet.getMaxColumns());
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const legacyMigration = headers[25] !== "Game ID";
    GAME_PIPELINE_HEADERS.forEach(function(header, index) {
      const existing = String(headers[25 + index] || "");
      if (existing && existing !== header) throw new Error("Canonical identity column conflict: " + existing);
    });
    const props = PropertiesService.getScriptProperties();
    let maximum = Number(props.getProperty("LIF_GAME_ID_HIGH_WATER")) || 0;
    const seen = {};
    values.slice(1).forEach(function(row) {
      const id = Number(row[25]);
      if (!id) return;
      if (!Number.isSafeInteger(id) || id <= 0 || seen[id]) throw new Error("Duplicate or invalid persistent Game ID.");
      seen[id] = true; maximum = Math.max(maximum, id);
    });
    // Preserve all pre-migration URLs; reserve invalid/empty row positions too.
    maximum = Math.max(maximum, values.length - 1);
    const migrated = values.slice(1).map(function(row, index) {
      let id = Number(row[25]);
      if (!id) {
        id = legacyMigration ? index + 1 : ++maximum;
        if (seen[id]) id = ++maximum;
        seen[id] = true;
      }
      return [id, String(row[26] || "legacy-game-" + id), String(row[27] || (legacyMigration || row[25] ? "Legacy" : "Pending"))];
    });
    if (migrated.some(function(row, index) {
      return row.some(function(value, column) { return value !== values[index + 1][25 + column]; });
    })) sheet.getRange(2, 26, migrated.length, 3).setValues(migrated);
    // Commit the migration marker last: an interrupted migration must still
    // reserve the original row-derived URLs for every remaining legacy game.
    if (GAME_PIPELINE_HEADERS.some(function(header, index) { return headers[25 + index] !== header; }))
      sheet.getRange(1, 26, 1, 3).setValues([GAME_PIPELINE_HEADERS]);
    if (migrated.some(function(row, index) { return Number(values[index + 1][25]) !== row[0]; }) &&
        typeof markCanonicalRebuildRequired_ === "function")
      markCanonicalRebuildRequired_("Persistent game identities assigned");
    props.setProperty("LIF_GAME_ID_HIGH_WATER", String(maximum));
    return maximum;
  });
}

function canonicalGameId_(row, legacyId) {
  const id = Number(row && row[25]);
  return Number.isSafeInteger(id) && id > 0 ? id : Number(legacyId);
}

function appendCanonicalGameDurably_(sheet, row, submissionId) {
  return withGamePipelineLock_(function() {
    const maximum = ensureCanonicalGameIdentities_(sheet);
    const key = String(submissionId || Utilities.getUuid());
    const values = sheet.getDataRange().getValues();
    for (let index = 1; index < values.length; index++) {
      if (String(values[index][26]) === key)
        return { targetRow: index + 1, gameId: canonicalGameId_(values[index], index), duplicate: true };
    }
    const gameId = maximum + 1;
    // Reserve before append: crashes may leave a gap, never a reused identity.
    PropertiesService.getScriptProperties().setProperty("LIF_GAME_ID_HIGH_WATER", String(gameId));
    const persisted = row.slice(0, 25);
    while (persisted.length < 25) persisted.push("");
    persisted.push(gameId, key, "Pending");
    sheet.appendRow(persisted);
    SpreadsheetApp.flush();
    return { targetRow: sheet.getLastRow(), gameId: gameId, duplicate: false };
  });
}

function recoverCanonicalGameOutbox_(limit) {
  return withGamePipelineLock_(function() {
    const sheet = lifGetTargetSpreadsheet_().getSheetByName(CONFIG.SHEETS.FORM);
    ensureCanonicalGameIdentities_(sheet);
    const values = sheet.getDataRange().getValues();
    const results = [];
    for (let index = 1; index < values.length && results.length < (limit || 20); index++) {
      const row = values[index];
      if (row[27] !== "Pending") continue;
      const gameId = canonicalGameId_(row, index);
      try {
        if (!validateGame(row)) throw new Error("Canonical outbox game is invalid.");
        const receipt = enqueueGameSubmittedAutomationEvent({ gameId: gameId,
          eventId: getGameEngineEventId(row), gameType: getGameEngineGameType(row) });
        if (!receipt || receipt.success !== true || receipt.skipped)
          throw new Error("Game automation remains deferred.");
        // Re-resolve after enqueue, so a retry never acknowledges the wrong row.
        const current = sheet.getDataRange().getValues();
        const currentIndex = current.findIndex(function(candidate, i) { return i > 0 && Number(candidate[25]) === gameId; });
        if (currentIndex < 1) throw new Error("Canonical outbox game was removed.");
        sheet.getRange(currentIndex + 1, 28).setValue("Queued");
        results.push({ gameId: gameId, success: true });
      } catch (error) {
        results.push({ gameId: gameId, success: false, error: String(error.message || error).slice(0, 300) });
      }
    }
    return { attempted: results.length, results: results, success: results.every(function(r) { return r.success; }) };
  });
}
