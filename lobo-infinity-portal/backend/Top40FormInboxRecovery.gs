/** The response sheet is the durable inbox, including triggers that never acquired a lock. */
function installTop40FormInboxRecovery() {
  const handler = "recoverTop40FormInbox";
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === handler; }))
      ScriptApp.newTrigger(handler).timeBased().everyMinutes(1).create();
  } finally { lock.releaseLock(); }
  return recoverTop40FormInbox();
}

function recoverTop40FormInbox() {
  const lock = LockService.getScriptLock();
  // Do not compete with a live submission. The original row remains pending.
  if (!lock.tryLock(1000)) return { success:true, skipped:true, reason:"Submission in progress; inbox retained" };
  const result = { success:true, recovered:[], issues:[] };
  try {
    const book = SpreadsheetApp.openById(lifRequireProperty_(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID));
    const formId = lifRequireProperty_(LIF_FORMS.PROPERTIES.TOP40_FORM_ID);
    const sources = book.getSheets().filter(function(s) { return String(s.getFormUrl() || "").indexOf(formId) >= 0; });
    if (sources.length !== 1) throw new Error("Expected one linked Top 40 response sheet.");
    const source = sources[0];
    const values = source.getDataRange().getValues();
    const target = lifGetTargetSpreadsheet_();
    const log = lifEnsureImportLog_(target);
    const logs = log.getDataRange().getValues().slice(1);
    const matches = readEventBracketMatches_(TOP40_FORM_EVENT_ID);
    const now = Date.now();
    const candidates = top40FormInboxCandidates_(values, source.getSheetId(), logs, matches, now);
    // Bound work and lock duration. A bad row must not starve later responses.
    for (let i = 0; i < candidates.length && i < 1; i += 1) {
      const item = candidates[i];
      try {
        const named = lifBuildCasualNamedValuesFromResponseRow_({ range:source.getRange(item.row, 1) });
        const saved = importTop40FormSubmission_(named, values[item.row - 1][0], item.key, log, target, item.row);
        if (saved) result.recovered.push({ row:item.row, gameId:saved.gameId, matchId:saved.matchId });
      } catch (error) {
        const message = String(error.message || error).slice(0,500);
        lifWriteImportLog_(log, item.key, LIF_FORMS.TYPES.TOP40, item.row, "Retry Pending", message);
        result.issues.push({ row:item.row, error:message });
        result.success = false;
      }
    }
  } catch (error) {
    result.success = false;
    result.issues.push({ error:String(error.message || error).slice(0,500) });
  } finally { lock.releaseLock(); }
  // Publishing can be slow; never hold the submission lock for it.
  if (result.recovered.length) result.publication = publishDirtyTop40PublicProjectionBestEffort_();
  Logger.log("TOP40_FORM_INBOX " + JSON.stringify(result));
  return result;
}

function top40FormInboxCandidates_(values, sheetId, logs, matches, now) {
  const headers = values[0] || [];
  const p = headers.indexOf("Player"), o = headers.indexOf("Opponent"), m = headers.indexOf("Mission");
  if (p < 0 || o < 0 || m < 0) throw new Error("Top 40 response headers are missing.");
  const done = {}, retryAt = {};
  logs.forEach(function(row) {
    // Earlier import versions used :00 after the response row number.
    const key = String(row[0] || "").replace(/:00$/, "");
    if (row[4] === "Imported" || row[4] === "Duplicate") done[key] = true;
    if (row[4] === "Retry Pending") retryAt[key] = Math.max(retryAt[key] || 0, new Date(row[2]).getTime() || 0);
  });
  const candidates = [];
  values.slice(1).forEach(function(row, index) {
    const key = sheetId + ":" + (index + 2);
    if (done[key] || (retryAt[key] && now - retryAt[key] < 300000)) return;
    const timestamp = new Date(row[0]).getTime();
    if (!Number.isFinite(timestamp) || now - timestamp < 90000) return;
    const matching = matches.filter(function(match) {
      if (match.status !== "Active") return false;
      if (!((match.playerA === row[p] && match.playerB === row[o]) || (match.playerA === row[o] && match.playerB === row[p]))) return false;
      const activated = new Date(match.activatedAt).getTime();
      // Never replay an earlier meeting into a later rematch.
      return Number.isFinite(activated) && timestamp >= activated;
    });
    if (matching.length === 1) candidates.push({ row:index + 2, key:key });
  });
  return candidates;
}
