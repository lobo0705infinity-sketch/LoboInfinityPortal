// Owner-run recovery for the original response rejected by the optional Best Moment mismatch.
// Read the original response rather than creating another Google Forms submission.
function recoverTop40ZhukovLucasResult20261101() {
  const eventId = "event-lobo-s-american-top-40";
  const matches = readEventBracketMatches_(eventId);
  const match = matches.filter(function(item) { return item.matchId === "W1-M12"; })[0];
  if (!match || match.playerA !== "Zhukov2" || match.playerB !== "Snakes / Lucas")
    throw new Error("The expected opening match has changed; recovery stopped.");
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
