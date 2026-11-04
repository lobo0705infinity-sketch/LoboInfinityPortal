/** Recoverable Top 40 commits. Canonical games are never appended by recovery. */
const TOP40_SUBMISSION_KEY_PREFIX = "top40-match:";
const TOP40_SUBMISSION_HEALTH_PROPERTY = "TOP40_SUBMISSION_HEALTH_V1";

function top40MatchSubmissionKey_(eventId, matchId) {
  if (eventId !== "event-lobo-s-american-top-40" || !/^(W\d+-M\d+|L\d+-M\d+|GF-M[12])$/.test(String(matchId || "")))
    throw new Error("A valid Top 40 event and bracket match are required.");
  return TOP40_SUBMISSION_KEY_PREFIX + eventId + ":" + matchId;
}

function top40CanonicalPlayerKey_(value) {
  return String(resolveIndividualDoubleEliminationPlayer(value) || value || "").trim().toLowerCase();
}

function completeTop40CanonicalCommit_(eventId, matchId, gameId) {
  return withGamePipelineLock_(function() {
    const key = top40MatchSubmissionKey_(eventId, matchId);
    const sheet = lifGetTargetSpreadsheet_().getSheetByName(CONFIG.SHEETS.FORM);
    const rows = sheet.getDataRange().getValues().slice(1);
    const games = rows.filter(function(row) { return Number(canonicalGameId_(row)) === Number(gameId); });
    if (games.length !== 1) throw new Error("Expected exactly one saved Top 40 game.");
    const row = games[0];
    if (getGameEngineEventId(row) !== eventId || !validateGame(row))
      throw new Error("Saved game does not belong to this Top 40 event or is invalid.");
    const matches = readEventBracketMatches_(eventId);
    const match = matches.filter(function(item) { return item.matchId === matchId; })[0];
    if (!match) throw new Error("Top 40 match is missing.");
    if (String(row[FORM.MISSION]) !== getEventBracketMission_(eventId, match.bracket, match.bracketRound))
      throw new Error("Saved game mission does not match this bracket round.");
    const storedKey = String(row[26] || "");
    if (storedKey.indexOf(TOP40_SUBMISSION_KEY_PREFIX) === 0 && storedKey !== key)
      throw new Error("Saved game belongs to another bracket match.");
    if (rows.some(function(other) { return String(other[26]) === key && Number(canonicalGameId_(other)) !== Number(gameId); }))
      throw new Error("Multiple saved games claim this bracket match.");
    const a = top40CanonicalPlayerKey_(match.playerA), b = top40CanonicalPlayerKey_(match.playerB);
    const p1 = top40CanonicalPlayerKey_(row[FORM.PLAYER1]), p2 = top40CanonicalPlayerKey_(row[FORM.PLAYER2]);
    if (!a || !b || a === b || !((p1 === a && p2 === b) || (p1 === b && p2 === a)))
      throw new Error("Saved game participants do not match the bracket.");
    const result = getGameEngineExplicitResult(row);
    if (result !== "player1" && result !== "player2")
      throw new Error("Saved Top 40 game must have an explicit winner.");
    const winnerKey = result === "player1" ? p1 : p2;
    const winner = winnerKey === a ? match.playerA : match.playerB;
    const loser = winnerKey === a ? match.playerB : match.playerA;
    if (match.status === "Completed") {
      if (Number(match.gameId) !== Number(gameId) || match.winner !== winner || match.loser !== loser)
        throw new Error("Completed bracket conflicts with the saved game.");
      return { changed:false, gameId:Number(gameId), matchId:matchId };
    }
    if (match.status !== "Active" || (match.gameId && Number(match.gameId) !== Number(gameId)))
      throw new Error("Bracket match cannot be recovered from this saved game.");
    // Publication is owed BEFORE mutating the bracket; crashes cannot lose it.
    markPublicProjectionRequired_(TOP40_PUBLIC_PROJECTION_DIRTY_PROPERTY, [eventId]);
    completeEventBracketMatch_(matches, match, winner, loser, "Played", Number(gameId), new Date());
    writeEventBracketMatches_(eventId, matches);
    SpreadsheetApp.flush();
    return { changed:true, gameId:Number(gameId), matchId:matchId };
  });
}

function recoverTop40Submissions() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { success:true, skipped:true, reason:"Submission in progress" };
  const result = { success:true, checkedAt:new Date().toISOString(), recovered:[], issues:[] };
  try {
    const eventId = "event-lobo-s-american-top-40";
    const sheet = lifGetTargetSpreadsheet_().getSheetByName(CONFIG.SHEETS.FORM);
    const rows = sheet.getDataRange().getValues().slice(1);
    const matches = readEventBracketMatches_(eventId);
    const claimed = {};
    rows.forEach(function(row) {
      if (getGameEngineEventId(row) !== eventId) return;
      const gameId = Number(canonicalGameId_(row));
      const key = String(row[26] || "");
      const keyed = key.indexOf(TOP40_SUBMISSION_KEY_PREFIX) === 0;
      const matchId = keyed ? key.slice(key.lastIndexOf(":") + 1) : "";
      const linked = matches.filter(function(match) { return Number(match.gameId) === gameId; });
      if (!keyed && linked.length === 1 && linked[0].status === "Completed") return;
      // Legacy unlinked games are flagged, never guessed from a repeated pairing.
      const target = matchId || (linked.length === 1 ? linked[0].matchId : "");
      if (!target || claimed[target]) {
        result.issues.push("Game #" + gameId + ": missing or duplicate bracket association.");
        return;
      }
      claimed[target] = true;
      try {
        const completed = completeTop40CanonicalCommit_(eventId, target, gameId);
        if (completed.changed) result.recovered.push(completed);
      } catch (error) {
        result.issues.push("Game #" + gameId + " / " + target + ": " + String(error.message || error).slice(0,250));
      }
    });
    // Also invalidate on an unchanged scan: a prior execution may have crashed
    // after writing the bracket but before clearing its cached projections.
    invalidateEventEngineSnapshotCache();
    invalidatePortalCacheGroup("events");
    if (typeof invalidateEventRegistrationCaches === "function") invalidateEventRegistrationCaches();
    // Publication retries run independently of the full analytics rebuild worker.
    result.publication = publishDirtyTop40PublicProjectionBestEffort_();
    if (!result.publication.success) result.issues.push("Top 40 publication pending: " + String(result.publication.error || "retry required").slice(0,250));
    result.success = result.issues.length === 0;
  } catch (error) {
    result.success = false;
    result.issues.push(String(error.message || error).slice(0,300));
  } finally {
    try {
      PropertiesService.getScriptProperties().setProperty(TOP40_SUBMISSION_HEALTH_PROPERTY, JSON.stringify({
        checkedAt:result.checkedAt, success:result.success, recoveredCount:result.recovered.length,
        issueCount:result.issues.length, issues:result.issues.slice(0,15)
      }));
    } finally { lock.releaseLock(); }
  }
  if (!result.success) console.error("TOP40_SUBMISSION_RECOVERY_PENDING " + JSON.stringify(result));
  Logger.log(JSON.stringify(result));
  return result;
}

function getTop40SubmissionHealthIssues_() {
  const raw = PropertiesService.getScriptProperties().getProperty(TOP40_SUBMISSION_HEALTH_PROPERTY);
  if (!raw) return [];
  try {
    const health = JSON.parse(raw);
    return (health.issues || []).map(function(issue) {
      return buildAuditIssue("critical", "Top 40: " + issue,
        "Automatic recovery retries every five minutes; inspect the saved game if the conflict persists.", "/event/lobos-top-40/bracket");
    });
  } catch (error) {
    return [buildAuditIssue("critical", "Top 40 recovery status could not be read.", "Run recoverTop40Submissions.", "/commissioner")];
  }
}

function installTop40SubmissionRecovery() {
  const existing = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === "recoverTop40Submissions";
  });
  if (!existing.length) ScriptApp.newTrigger("recoverTop40Submissions").timeBased().everyMinutes(5).create();
  const result = recoverTop40Submissions();
  Logger.log("Top 40 recovery installed; existing games are never resubmitted.");
  return result;
}
