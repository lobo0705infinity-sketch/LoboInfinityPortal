function validateCanonicalGame(command) {
  const input = command || {};
  const source = canonicalValidationString_(input.source).toLowerCase();
  const workflow = canonicalValidationWorkflow_(input.workflow);

  if (source === "google-form")
    return canonicalValidateGoogleFormGame_(input.submission || {});

  if (source === "portal" && workflow === "league")
    return canonicalValidatePortalLeagueGame_(input);

  if (source === "portal" && workflow === "casual")
    return canonicalValidatePortalCasualGame_(input);

  if (source === "portal" && workflow === "team-tournament")
    return canonicalValidatePortalTeamTournamentGame_(input);

  return canonicalValidationFailure_("Canonical game validation workflow is not supported.");
}

function canonicalValidateGoogleFormGame_(submission) {
  const errors = [];
  const required = [
    "mission",
    "player",
    "opponent",
    "playerFaction",
    "opponentFaction",
    "playerArmyCode",
    "opponentArmyCode",
    "gameResult",
    "firstTurn"
  ];

  required.forEach(function(key) {
    if (!String(submission[key] || "").trim())
      errors.push(key + " is required.");
  });

  if (lifNormalize_(submission.player) === lifNormalize_(submission.opponent))
    errors.push("Player and opponent must be different.");

  ["playerTp", "opponentTp", "playerOp", "opponentOp", "playerVp", "opponentVp"]
    .forEach(function(key) {
      const value = Number(submission[key]);
      if (!Number.isInteger(value) || value < 0)
        errors.push(key + " must be a non-negative whole number.");
    });

  if (Number(submission.playerTp) + Number(submission.opponentTp) > 10)
    errors.push("Tournament Points cannot total more than 10.");

  if (["Player Victory", "Opponent Victory", "Draw"].indexOf(submission.gameResult) < 0)
    errors.push("Game Result is invalid.");

  if (["Player", "Opponent"].indexOf(submission.firstTurn) < 0)
    errors.push("First Turn is invalid.");

  return canonicalValidationResult_(errors, {
    submission: submission
  });
}

function canonicalValidatePortalLeagueGame_(command) {
  const params = command.params || {};
  const auth = command.auth || null;
  const commissionerContext = command.commissionerContext || {};
  const eventId = resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);
  const event = getEventByIdSnapshot(eventId) || getCurrentLeagueEventSnapshot();

  if (!event)
    return canonicalValidationFailure_("Event was not found.");

  if (!isLeagueResultEventAcceptingResults(event))
    return canonicalValidationFailure_("This event is not currently accepting results.");

  const player =
    getResultSubmissionString(params.player) ||
    (auth && auth.user ? getCanonicalPlayerFromUser(auth.user) : "");
  const opponent = getResultSubmissionString(params.opponent);

  const identityError = canonicalValidatePortalPlayerIdentity_(
    player,
    opponent,
    "Player and opponent are required."
  );
  if (identityError)
    return canonicalValidationFailure_(identityError);

  const registrations = getEventRegistrationRows(eventId);

  if (!commissionerContext.override &&
      !isResultSubmissionRegisteredPlayer(registrations, player))
    return canonicalValidationFailure_("Player is not registered for this event.");

  if (!commissionerContext.override &&
      !isResultSubmissionRegisteredPlayer(registrations, opponent))
    return canonicalValidationFailure_("Opponent is not registered for this event.");

  if (!commissionerContext.override &&
      hasExistingLeagueResult(eventId, player, opponent))
    return canonicalValidationFailure_("This match has already been reported.");

  const scores = canonicalReadPortalScores_(params);
  if (!scores.valid)
    return canonicalValidationFailure_("Scores must be non-negative numbers.");

  if (scores.playerTp + scores.opponentTp > 10)
    return canonicalValidationFailure_("Tournament Points cannot total more than 10.");

  const winner = getResultSubmissionString(params.winner);
  const playerFaction = canonicalizeArmyName(params.playerFaction);
  const opponentFaction = canonicalizeArmyName(params.opponentFaction);

  if (playerFaction === "" || opponentFaction === "")
    return canonicalValidationFailure_("Both factions are required.");

  const playerArmyList = validateResultSubmissionArmyListId(
    params.playerArmyListId,
    player,
    playerFaction,
    params.playerArmyCode
  );
  if (!playerArmyList.valid)
    return canonicalValidationFailure_(playerArmyList.error);

  const opponentArmyList = validateResultSubmissionArmyListId(
    params.opponentArmyListId,
    opponent,
    opponentFaction,
    params.opponentArmyCode
  );
  if (!opponentArmyList.valid)
    return canonicalValidationFailure_(opponentArmyList.error);

  return canonicalValidationSuccess_(canonicalBuildPortalValidationValue_(
    eventId,
    player,
    opponent,
    scores,
    winner,
    playerFaction,
    opponentFaction,
    playerArmyList,
    opponentArmyList
  ));
}

function canonicalValidatePortalCasualGame_(command) {
  const params = command.params || {};
  const auth = command.auth || null;
  const player =
    getResultSubmissionString(params.player) ||
    (auth && auth.user
      ? getCanonicalPlayerFromUser(auth.user) ||
        auth.user.playerDisplayName ||
        auth.user.displayName ||
        auth.user.email
      : "");
  const opponent = getResultSubmissionString(params.opponent);

  const identityError = canonicalValidatePortalPlayerIdentity_(
    player,
    opponent,
    "Players are required."
  );
  if (identityError)
    return canonicalValidationFailure_(identityError);

  const playerFaction = canonicalizeArmyName(params.playerFaction);
  const opponentFaction = canonicalizeArmyName(params.opponentFaction);

  if (playerFaction === "")
    return canonicalValidationFailure_("Player faction is required.");

  if (opponentFaction === "")
    return canonicalValidationFailure_("Opponent faction is required.");

  const playerArmyList = validateResultSubmissionArmyListId(
    params.playerArmyListId,
    player,
    playerFaction,
    params.playerArmyCode
  );
  if (!playerArmyList.valid)
    return canonicalValidationFailure_(playerArmyList.error);

  const opponentArmyList = validateResultSubmissionArmyListId(
    params.opponentArmyListId,
    opponent,
    opponentFaction,
    params.opponentArmyCode
  );
  if (!opponentArmyList.valid)
    return canonicalValidationFailure_(opponentArmyList.error);

  if (getResultSubmissionString(params.mission) === "")
    return canonicalValidationFailure_("Mission is required.");

  if (getResultSubmissionString(params.firstTurn) === "")
    return canonicalValidationFailure_("First Turn is required.");

  if (getResultSubmissionString(params.bestMoment) === "")
    return canonicalValidationFailure_("Best Moment is required.");

  const scores = canonicalReadPortalScores_(params);
  if (!scores.valid)
    return canonicalValidationFailure_("Scores must be non-negative numbers.");

  if (scores.playerTp + scores.opponentTp > 10)
    return canonicalValidationFailure_("Tournament Points cannot total more than 10.");

  const winner = getResultSubmissionString(params.winner);

  return canonicalValidationSuccess_(canonicalBuildPortalValidationValue_(
    "",
    player,
    opponent,
    scores,
    winner,
    playerFaction,
    opponentFaction,
    playerArmyList,
    opponentArmyList
  ));
}

function canonicalValidatePortalTeamTournamentGame_(command) {
  const params = command.params || {};
  const auth = command.auth || {};
  const commissionerContext = command.commissionerContext || {};
  const eventId = resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);
  const event =
    getEventByIdSnapshot(eventId) ||
    getEventByIdSnapshot(EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

  if (!event || getTeamTournamentString(event.type) !== "Team Tournament")
    return canonicalValidationFailure_(
      "Portal result submission is only enabled for Team Tournament events."
    );

  const selectedPlayer = commissionerContext.enabled
    ? getTeamTournamentString(params.player)
    : "";
  const registration = commissionerContext.enabled && selectedPlayer !== ""
    ? getEventRegistrationForPlayer(eventId, selectedPlayer)
    : getEventRegistrationForPlayer(
        eventId,
        getEventParticipantKey(event, auth.user)
      );

  if ((!registration || registration.status === "Withdrawn") &&
      !commissionerContext.override)
    return canonicalValidationFailure_(
      "You must be registered for this Team Tournament before submitting a result."
    );

  const currentRound = getTeamTournamentCurrentRound(eventId);
  if (!isTeamTournamentRoundActive(event, currentRound))
    return canonicalValidationFailure_(
      "This Team Tournament round is not currently accepting results."
    );

  const pairings = getTeamTournamentPairings(eventId);
  let assignment = registration
    ? resolveTeamTournamentResultAssignment(
        event,
        currentRound,
        registration,
        pairings,
        params
      )
    : null;

  if (!assignment && commissionerContext.override)
    assignment = buildCommissionerTeamTournamentOverrideAssignment(
      eventId,
      currentRound,
      params
    );

  if (!assignment)
    return canonicalValidationFailure_(
      "No active table pairing was found for your registration."
    );

  const resultValidation = canonicalValidateTeamTournamentResultPolicy_(params, assignment);
  if (resultValidation.length > 0)
    return canonicalValidationFailure_(resultValidation.join(" "), resultValidation);

  const results = getTeamTournamentResults(eventId);
  if (!commissionerContext.override &&
      hasSubmittedTeamTournamentResult(results, assignment))
    return canonicalValidationFailure_("This match has already been submitted.");

  return canonicalValidationSuccess_({
    eventId: eventId,
    event: event,
    registration: registration,
    currentRound: currentRound,
    pairings: pairings,
    assignment: assignment,
    results: results
  });
}

function canonicalValidateTeamTournamentResultPolicy_(params, assignment) {
  const issues = [];
  const winner = getTeamTournamentString(params.winner);
  const tournamentPoints = parseTeamTournamentSubmittedScore(params.tournamentPoints);
  const objectivePoints = parseTeamTournamentSubmittedScore(params.objectivePoints);
  const victoryPoints = parseTeamTournamentSubmittedScore(params.victoryPoints);
  const submittedOpponent = getTeamTournamentString(params.opponent);

  if (assignment.opponent === "" && submittedOpponent === "")
    issues.push("Opponent could not be resolved from the published pairing.");

  [
    ["roundId", "roundId", "Round"],
    ["teamA", "teamA", "Team"],
    ["teamB", "teamB", "Opponent team"],
    ["player", "player", "Player"],
    ["opponent", "opponent", "Opponent"],
    ["mission", "mission", "Mission"],
    ["table", "table", "Table"]
  ].forEach(function(check) {
    const submitted = getTeamTournamentString(params[check[0]]);
    const expected = getTeamTournamentString(assignment[check[1]]);

    if (submitted !== "" && expected !== "" && !teamTournamentSameValue(submitted, expected))
      issues.push(check[2] + " does not match the published pairing.");
  });

  if (!tournamentPoints.valid || !objectivePoints.valid || !victoryPoints.valid)
    issues.push("Scores must use the published you-opponent format, for example 7-3.");

  if (tournamentPoints.valid && tournamentPoints.left + tournamentPoints.right > 10)
    issues.push("Tournament Points cannot total more than 10.");

  if (winner === "")
    issues.push("Game Result is required.");

  return issues;
}

function canonicalValidatePortalPlayerIdentity_(player, opponent, missingMessage) {
  if (player === "" || opponent === "")
    return missingMessage;

  if (normalizeResultSubmissionValue(player) === normalizeResultSubmissionValue(opponent))
    return "Opponent must be a different player.";

  return "";
}

function canonicalReadPortalScores_(params) {
  const scores = {
    playerTp: parseResultSubmissionScore(params.playerTournamentPoints),
    opponentTp: parseResultSubmissionScore(params.opponentTournamentPoints),
    playerOp: parseResultSubmissionScore(params.playerObjectivePoints),
    opponentOp: parseResultSubmissionScore(params.opponentObjectivePoints),
    playerVp: parseResultSubmissionScore(params.playerVictoryPoints),
    opponentVp: parseResultSubmissionScore(params.opponentVictoryPoints)
  };

  scores.valid = !(
    scores.playerTp === null ||
    scores.opponentTp === null ||
    scores.playerOp === null ||
    scores.opponentOp === null ||
    scores.playerVp === null ||
    scores.opponentVp === null
  );

  return scores;
}

function canonicalBuildPortalValidationValue_(
  eventId,
  player,
  opponent,
  scores,
  winner,
  playerFaction,
  opponentFaction,
  playerArmyList,
  opponentArmyList
) {
  const expectedWinner = determineLeagueSubmissionWinner(
    player,
    opponent,
    scores.playerTp,
    scores.opponentTp,
    scores.playerOp,
    scores.opponentOp,
    scores.playerVp,
    scores.opponentVp
  );
  const submittedResult = winner !== "" ? winner : expectedWinner;

  return {
    eventId: eventId,
    player: player,
    opponent: opponent,
    playerTp: scores.playerTp,
    opponentTp: scores.opponentTp,
    playerOp: scores.playerOp,
    opponentOp: scores.opponentOp,
    playerVp: scores.playerVp,
    opponentVp: scores.opponentVp,
    playerFaction: playerFaction,
    opponentFaction: opponentFaction,
    playerArmyList: playerArmyList,
    opponentArmyList: opponentArmyList,
    submittedResult: submittedResult,
    playerIsWinner:
      normalizeResultSubmissionValue(submittedResult) ===
      normalizeResultSubmissionValue(player),
    resultIsDraw: normalizeResultSubmissionValue(submittedResult) === "draw"
  };
}

function canonicalValidationWorkflow_(value) {
  const normalized = canonicalValidationString_(value).toLowerCase();

  if (normalized === "team" || normalized === "team tournament" || normalized === "team-tournament")
    return "team-tournament";

  return normalized;
}

function canonicalValidationSuccess_(value) {
  return canonicalValidationResult_([], value || {});
}

function canonicalValidationFailure_(message, errors) {
  return canonicalValidationResult_(errors || [message], {}, message);
}

function canonicalValidationResult_(errors, value, error) {
  const issues = errors || [];

  return {
    valid: issues.length === 0,
    errors: issues,
    error: error || (issues.length ? issues[0] : ""),
    value: value || {}
  };
}

function canonicalValidationString_(value) {
  return String(value || "").trim();
}
