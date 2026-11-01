// Owner-run recovery for the original response rejected by the optional Best Moment mismatch.
// Read the original response rather than creating another Google Forms submission.
function recoverTop40ZhukovLucasResult20261101() {
  const eventId = "event-lobo-s-american-top-40";
  const matches = readEventBracketMatches_(eventId);
  const match = matches.filter(function(item) { return item.matchId === "W1-M12"; })[0];
  if (!match || match.playerA !== "Zhukov2" || match.playerB !== "Snakes / Lucas")
    throw new Error("The expected opening match has changed; recovery stopped.");
  const recorded = getFormResponses().filter(function(row) {
    return getGameEngineEventId(row) === eventId && row[FORM.PLAYER1] === "Zhukov2" && row[FORM.PLAYER2] === "Snakes / Lucas";
  });
  if (recorded.length) return finalizeTop40ZhukovLucasRecordedResult20261101();
  if (match.status !== "Completed") {
    const responseBook = SpreadsheetApp.openById(lifRequireProperty_(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID));
    const sheet = responseBook.getSheets().filter(function(item) { return item.getSheetId() === 521529464; })[0];
    if (!sheet) throw new Error("The original Top 40 response sheet is missing.");
    const range = sheet.getRange(2, 1, 1, sheet.getLastColumn());
    const event = { range:range, namedValues:{}, values:range.getDisplayValues()[0] };
    const named = lifBuildCasualNamedValuesFromResponseRow_(event);
    if (String((named.Player || [""])[0]) !== "Zhukov2" ||
        String((named.Opponent || [""])[0]) !== "Snakes / Lucas" ||
        String((named["Game Result"] || [""])[0]) !== "Opponent Victory" ||
        String((named.Mission || [""])[0]) !== "Corporate Appropriation")
      throw new Error("The original response no longer matches this recovery.");
    handleLoboFormSubmit(event);
  }
  const completed = readEventBracketMatches_(eventId).filter(function(item) { return item.matchId === "W1-M12"; })[0];
  if (completed.status !== "Completed" || !completed.gameId || completed.winner !== "Snakes / Lucas")
    throw new Error("Result recovery did not complete; inspect records before retrying.");
  const projection = publishTop40PublicProjection_();
  const summary = { success:true, matchId:completed.matchId, gameId:completed.gameId, winner:completed.winner, publishedAt:projection.generatedAt };
  Logger.log(JSON.stringify(summary));
  return summary;
}

// Finish only the already-persisted game if a synchronous analytics rebuild
// exhausts the execution window before the normal bracket linkage step.
function finalizeTop40ZhukovLucasRecordedResult20261101() {
  const eventId = "event-lobo-s-american-top-40";
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const games = getFormResponses().filter(function(row) {
      return getGameEngineEventId(row) === eventId && row[FORM.PLAYER1] === "Zhukov2" && row[FORM.PLAYER2] === "Snakes / Lucas";
    });
    if (games.length !== 1) throw new Error("Expected exactly one existing Top 40 game; no game will be created.");
    const game = games[0];
    const gameId = canonicalGameId_(game);
    if (!gameId || Number(game[FORM.P1TP]) !== 1 || Number(game[FORM.P2TP]) !== 5 ||
        Number(game[FORM.P1OP]) !== 4 || Number(game[FORM.P2OP]) !== 5 ||
        Number(game[FORM.P1VP]) !== 93 || Number(game[FORM.P2VP]) !== 150)
      throw new Error("The recorded game's identity or scores changed; recovery stopped.");
    setEventBracketMatchGameId_(eventId, "W1-M12", gameId);
    applyTop40BracketProgression_(eventId, "W1-M12", gameId, "Snakes / Lucas", "Zhukov2", new Date());
    const log = lifEnsureImportLog_(lifGetTargetSpreadsheet_());
    if (!lifWasImported_(log, "521529464:2"))
      lifWriteImportLog_(log, "521529464:2", LIF_FORMS.TYPES.TOP40, 2, "Imported", "Recovered existing Game ID " + gameId + "; Match ID W1-M12");
    const projection = publishTop40PublicProjection_();
    const summary = { success:true, gameId:gameId, matchId:"W1-M12", publishedAt:projection.generatedAt };
    Logger.log(JSON.stringify(summary));
    return summary;
  } finally { lock.releaseLock(); }
}
