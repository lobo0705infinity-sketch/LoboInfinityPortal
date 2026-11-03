// Owner-run, guarded repair of the two Top 40 results reported on November 2.
// Reuses existing Games and their IDs; never creates or resubmits a Game.
function repairTop40Results20261102() {
  const eventId = "event-lobo-s-american-top-40";
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const specs = [
      { id:138, player1:"Harrower", player2:"KharuS", tp:"5-0", op:"7-2", vp:"154-174",
        oldOp:2, newOp:2, oldFaction1:"Kestrel Colonial Force", oldFaction2:"Oban",
        newFaction1:"Oban", newFaction2:"Kestrel Colonial Force",
        oldList1:3531976050, oldList2:3450897997, newList1:3450897997, newList2:3531976050 },
      { id:139, player1:"Rysanov", player2:"Sam", tp:"5-2", op:"6-51", vp:"169-203",
        oldOp:51, newOp:5, oldFaction1:"Tohaa", oldFaction2:"Oban",
        newFaction1:"Oban", newFaction2:"Tohaa",
        oldList1:2730349916, oldList2:4931006337, newList1:4931006337, newList2:2730349916 }
    ];
    const matches = readEventBracketMatches_(eventId);
    const harrower = matches.filter(function(m) { return m.matchId === "W1-M6"; })[0];
    const rysanov = matches.filter(function(m) { return m.matchId === "W1-M4"; })[0];
    if (!harrower || harrower.status !== "Completed" || Number(harrower.gameId) !== 138 ||
        harrower.winner !== "Harrower" || harrower.loser !== "KharuS")
      throw new Error("Harrower's bracket result changed; repair stopped.");
    if (!rysanov || rysanov.playerA !== "Rysanov" || rysanov.playerB !== "Sam" ||
        ["Active", "Completed"].indexOf(rysanov.status) < 0 ||
        (rysanov.gameId && Number(rysanov.gameId) !== 139) ||
        (rysanov.status === "Completed" && (rysanov.winner !== "Rysanov" || rysanov.loser !== "Sam")))
      throw new Error("Rysanov's bracket match changed; repair stopped.");

    // Validate every source row before the first mutation.
    const plans = specs.map(function(spec) {
      const target = getGameScoreCorrectionTarget(spec.id);
      if (!target.found || target.eventId !== eventId ||
          target.player1 !== spec.player1 || target.player2 !== spec.player2)
        throw new Error("Game " + spec.id + " identity changed; repair stopped.");
      const row = target.row;
      const before = buildGameScoreCorrectionSnapshot(row);
      const fixedOp = spec.id === 139 ? "6-5" : spec.op;
      const repaired = before.tp === spec.tp && before.op === fixedOp && before.vp === spec.vp &&
        String(row[FORM.GAME_RESULT]) === "Player 1 Victory" &&
        row[FORM.WINNINGFACTION] === spec.newFaction1 && row[FORM.LOSINGFACTION] === spec.newFaction2 &&
        Number(row[FORM.WINNER_ARMY_LIST_ID]) === spec.newList1 && Number(row[FORM.LOSER_ARMY_LIST_ID]) === spec.newList2;
      const original = before.tp === spec.tp && before.op === spec.op && before.vp === spec.vp &&
        String(row[FORM.GAME_RESULT]) === "Player 2 Victory" &&
        row[FORM.WINNINGFACTION] === spec.oldFaction1 && row[FORM.LOSINGFACTION] === spec.oldFaction2 &&
        Number(row[FORM.WINNER_ARMY_LIST_ID]) === spec.oldList1 && Number(row[FORM.LOSER_ARMY_LIST_ID]) === spec.oldList2;
      if (!original && !repaired) throw new Error("Game " + spec.id + " changed; repair stopped.");
      return { spec:spec, target:target, before:before, repaired:repaired };
    });
    markCanonicalRebuildRequired_({ reason:"top40-20261102-score-and-winner-correction", workflow:"top-40" });
    const changed = [];
    plans.forEach(function(plan) {
      if (plan.repaired) return;
      const spec = plan.spec, target = plan.target;
      [[FORM.P2OP,spec.newOp],[FORM.GAME_RESULT,"Player 1 Victory"],
       [FORM.WINNINGFACTION,spec.newFaction1],[FORM.LOSINGFACTION,spec.newFaction2],
       [FORM.WINNER_ARMY_LIST_ID,spec.newList1],[FORM.LOSER_ARMY_LIST_ID,spec.newList2]].forEach(function(update) {
        target.sheet.getRange(target.rowNumber, update[0] + 1).setValue(update[1]);
      });
      recordGameScoreCorrectionAudit({
        commissioner:"Lobo — authorized result correction", eventId:eventId, gameId:spec.id,
        player1:spec.player1, player2:spec.player2, previous:plan.before,
        next:{ tp:spec.tp, op:spec.id === 139 ? "6-5" : spec.op, vp:spec.vp },
        correctedFields:"Winner, winner/loser factions and Army List IDs" + (spec.id === 139 ? ", OP" : ""),
        reason:"Repair Player Victory label being interpreted as an opponent win; " +
          (spec.id === 139 ? "Commissioner confirmed Sam 5 OP, Rysanov 6 OP." : "Bracket and 7-2 OP confirm Harrower's win.")
      });
      changed.push(spec.id);
    });
    SpreadsheetApp.flush();
    setEventBracketMatchGameId_(eventId, "W1-M4", 139);
    applyTop40BracketProgression_(eventId, "W1-M4", 139, "Rysanov", "Sam", new Date());
    invalidateResultSubmissionCaches();
    markCanonicalRebuildRecoveryProjectionsDirty_();
    const result = { success:true, correctedGameIds:changed, linkedGameId:139, matchId:"W1-M4", winner:"Rysanov", loser:"Sam" };
    Logger.log(JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}

function publishCorrectedTop40Results20261102() {
  const recovery = recoverPendingCanonicalRebuildBestEffort_();
  if (!recovery.success) throw new Error(recovery.error || "Derived data rebuild failed.");
  const result = runFullPublicSnapshotRefresh();
  if (!result || !result.success) throw new Error(result && result.error || "Publication failed.");
  Logger.log(JSON.stringify(result));
  return result;
}
