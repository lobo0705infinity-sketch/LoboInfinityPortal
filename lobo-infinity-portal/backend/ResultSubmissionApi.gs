/*******************************************************
 * ResultSubmissionApi.gs
 *
 * Portal-native player result submission.
 * Reuses Form Responses and the existing Game Engine rebuild.
 *******************************************************/

function submitLeagueResult(e) {

  return requireApiPermission(e, "submitLists", function(auth) {
    const params =
      getApiParameters(e);

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
      (auth && auth.user ? auth.user.leaguePlayer : "");

    const opponent =
      getResultSubmissionString(params.opponent);

    if (player === "" || opponent === "")
      return resultSubmissionFailure("Player and opponent are required.");

    if (normalizeResultSubmissionValue(player) === normalizeResultSubmissionValue(opponent))
      return resultSubmissionFailure("Opponent must be a different player.");

    const registrations =
      getEventRegistrationRows(eventId);

    if (!isResultSubmissionRegisteredPlayer(registrations, player))
      return resultSubmissionFailure("Player is not registered for this event.");

    if (!isResultSubmissionRegisteredPlayer(registrations, opponent))
      return resultSubmissionFailure("Opponent is not registered for this event.");

    if (hasExistingLeagueResult(eventId, player, opponent))
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

    if (
      winner !== "" &&
      normalizeResultSubmissionValue(winner) !== normalizeResultSubmissionValue(expectedWinner)
    )
      return resultSubmissionFailure("Winner does not match the submitted scores.");

    const playerIsWinner =
      normalizeResultSubmissionValue(expectedWinner) === normalizeResultSubmissionValue(player);

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
      playerIsWinner
        ? getResultSubmissionString(params.playerFaction)
        : getResultSubmissionString(params.opponentFaction);
    row[FORM.LOSINGFACTION] =
      playerIsWinner
        ? getResultSubmissionString(params.opponentFaction)
        : getResultSubmissionString(params.playerFaction);
    row[FORM.MOMENT] = getResultSubmissionString(params.bestMoment);
    row[FORM.EVENT_ID] = eventId;

    const sheet =
      SpreadsheetApp
        .getActive()
        .getSheetByName(CONFIG.SHEETS.FORM);

    if (!sheet)
      return resultSubmissionFailure("Result datastore was not found.");

    sheet.appendRow(row);

    if (typeof rebuildGameEngine === "function")
      rebuildGameEngine();

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

function resultSubmissionFailure(message) {

  return jsonOutput({
    success: false,
    error: message
  });

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
  }

}
