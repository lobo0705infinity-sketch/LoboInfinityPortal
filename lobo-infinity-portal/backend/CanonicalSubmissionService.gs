function submitCanonicalGame(command) {
  const input = command || {};
  const source = canonicalSubmissionString_(input.source).toLowerCase();
  const workflow = canonicalSubmissionWorkflow_(input.workflow);

  if (source === "google-form")
    return canonicalSubmitGoogleFormGame_(input, workflow);

  if (source === "portal" && (workflow === "league" || workflow === "casual"))
    return canonicalSubmitPortalGame_(input, workflow);

  if (source === "portal" && workflow === "team-tournament")
    return canonicalSubmitPortalTeamTournamentGame_(input);

  return canonicalSubmissionFailure_(
    "Canonical game submission workflow is not supported.",
    null
  );
}

function canonicalSubmitGoogleFormGame_(command, workflow) {
  const log = command.importLog;
  const responseKey = command.responseKey;

  if (lifWasImported_(log, responseKey))
    return canonicalSubmissionSuccess_(
      "Already Imported",
      null,
      null,
      null,
      { workflow: workflow }
    );

  const submission = command.submission || lifReadSubmission_(
    command.namedValues,
    workflow,
    command.timestamp,
    command.targetSpreadsheet
  );
  const validation = validateCanonicalGame({
    source: "google-form",
    workflow: workflow,
    submission: submission
  });

  if (!validation.valid) {
    lifWriteImportLog_(
      log,
      responseKey,
      workflow,
      "",
      "Rejected",
      validation.errors.join(" ")
    );
    throw new Error(validation.errors.join(" "));
  }

  const sheet = lifEnsureCanonicalSheet_(command.targetSpreadsheet);
  const row = buildCanonicalGameRow(
    canonicalSubmissionBuildGoogleFormGameCommand_(submission)
  );
  sheet.appendRow(row);
  const targetRow = sheet.getLastRow();

  lifWriteImportLog_(log, responseKey, workflow, targetRow, "Imported", "");
  SpreadsheetApp.flush();
  coordinateCanonicalRebuild({
    importLog: log,
    responseKey: responseKey,
    workflow: workflow,
    targetRow: targetRow,
    logMissing: true
  });

  if (workflow === "team-tournament")
    invalidateTeamTournamentRuntimeCache(submission.eventId);

  return canonicalSubmissionSuccess_(
    "Imported",
    row,
    targetRow,
    validation,
    {
      workflow: workflow,
      submission: submission
    }
  );
}

function canonicalSubmitPortalGame_(command, workflow) {
  const validation = validateCanonicalGame({
    source: "portal",
    workflow: workflow,
    params: command.params,
    auth: command.auth,
    commissionerContext: command.commissionerContext
  });

  if (!validation.valid)
    return canonicalSubmissionFailure_(validation.error, validation);

  const row = buildCanonicalGameRow(
    canonicalSubmissionBuildPortalGameCommand_(command, workflow, validation.value)
  );
  const sheet = lifGetTargetSpreadsheet_().getSheetByName(CONFIG.SHEETS.FORM);

  if (!sheet)
    return canonicalSubmissionFailure_("Result datastore was not found.", validation);

  ensureResultSubmissionArmyListHeaders(sheet);
  sheet.appendRow(row);

  canonicalSubmissionRecordPortalAudit_(
    command.commissionerContext,
    workflow,
    validation.value,
    row
  );
  coordinateCanonicalRebuild({
    workflow: workflow,
    targetRow: null,
    logMissing: false
  });

  if (typeof publishLatestGameSubmittedAutomationEvent === "function")
    publishLatestGameSubmittedAutomationEvent();

  invalidateResultSubmissionCaches();

  return canonicalSubmissionSuccess_(
    "Submitted",
    row,
    null,
    validation,
    {
      workflow: workflow,
      eventId: validation.value.eventId,
      player: validation.value.player,
      opponent: validation.value.opponent
    }
  );
}

function canonicalSubmitPortalTeamTournamentGame_(command) {
  const params = command.params || {};
  const validation = validateCanonicalGame({
    source: "portal",
    workflow: "team-tournament",
    params: params,
    auth: command.auth,
    commissionerContext: command.commissionerContext
  });

  if (!validation.valid)
    return canonicalSubmissionFailure_(validation.error, validation);

  const assignment = validation.value.assignment;
  const timestamp = getTeamTournamentTimestamp();
  const tournamentPoints = parseTeamTournamentSubmittedScore(params.tournamentPoints);
  const objectivePoints = parseTeamTournamentSubmittedScore(params.objectivePoints);
  const victoryPoints = parseTeamTournamentSubmittedScore(params.victoryPoints);
  const playerArmyCode = getTeamTournamentString(
    params.playerArmyCode || params.player1ArmyCode
  );
  const opponentArmyCode = getTeamTournamentString(
    params.opponentArmyCode || params.player2ArmyCode
  );
  const playerFaction =
    canonicalizeArmyName(params.playerFaction) ||
    getTeamTournamentArmyCodeFaction(playerArmyCode);
  const opponentFaction =
    canonicalizeArmyName(params.opponentFaction) ||
    getTeamTournamentArmyCodeFaction(opponentArmyCode);
  const submission = {
    timestamp: timestamp,
    formType: LIF_FORMS.TYPES.TEAM,
    eventId: validation.value.eventId,
    division: "Team Tournament",
    round: assignment.round,
    team: assignment.teamA,
    opponentTeam: assignment.teamB,
    mission: assignment.mission,
    player: assignment.player,
    opponent: assignment.opponent,
    playerFaction: playerFaction,
    opponentFaction: opponentFaction,
    playerArmyCode: playerArmyCode,
    opponentArmyCode: opponentArmyCode,
    playerTp: tournamentPoints.left,
    opponentTp: tournamentPoints.right,
    playerOp: objectivePoints.left,
    opponentOp: objectivePoints.right,
    playerVp: victoryPoints.left,
    opponentVp: victoryPoints.right,
    gameResult: getTeamTournamentCanonicalGameResult_(params.winner, assignment),
    firstTurn: getTeamTournamentCanonicalFirstTurn_(params.firstTurn, assignment),
    bestMoment: getTeamTournamentString(params.bestMoment),
    notes: getTeamTournamentString(params.notes)
  };
  const sheet = lifEnsureCanonicalSheet_(lifGetTargetSpreadsheet_());
  const row = buildCanonicalGameRow(
    canonicalSubmissionBuildGoogleFormGameCommand_(submission)
  );
  sheet.appendRow(row);
  const targetRow = sheet.getLastRow();

  SpreadsheetApp.flush();
  coordinateCanonicalRebuild({
    workflow: "team-tournament",
    targetRow: targetRow,
    logMissing: true
  });

  invalidateTeamTournamentRuntimeCache(validation.value.eventId);

  return canonicalSubmissionSuccess_(
    "Submitted",
    row,
    targetRow,
    validation,
    {
      workflow: "team-tournament",
      eventId: validation.value.eventId,
      assignment: assignment,
      timestamp: timestamp,
      submission: submission
    }
  );
}

function canonicalSubmissionBuildGoogleFormGameCommand_(submission) {
  const casual = submission.formType === LIF_FORMS.TYPES.CASUAL;
  const command = {
    division: submission.division,
    mission: submission.mission,
    player: submission.player,
    opponent: submission.opponent,
    playerTp: submission.playerTp,
    opponentTp: submission.opponentTp,
    playerOp: submission.playerOp,
    opponentOp: submission.opponentOp,
    playerVp: submission.playerVp,
    opponentVp: submission.opponentVp,
    firstTurn: submission.firstTurn,
    firstTurnMode: casual ? "legacy-casual" : "canonical",
    playerFaction: submission.playerFaction,
    opponentFaction: submission.opponentFaction,
    canonicalizeFactions: !casual,
    bestMoment: submission.bestMoment,
    eventId: submission.eventId,
    gameType: casual
      ? "casual"
      : submission.formType === LIF_FORMS.TYPES.TEAM
        ? "tournament"
        : "league",
    gameResult: submission.gameResult,
    gameResultMode: casual ? "winner-name" : "canonical",
    playerArmyCode: submission.playerArmyCode,
    opponentArmyCode: submission.opponentArmyCode,
    deriveArmyListIds: !casual
  };

  if (casual) {
    command.timestamp = submission.timestamp;
    command.date = new Date();
    command.playerArmyListId = "";
    command.opponentArmyListId = "";
  }

  return command;
}

function canonicalSubmissionBuildPortalGameCommand_(command, workflow, validated) {
  const params = command.params || {};
  const submissionTimestamp = getResultSubmissionTimestamp();
  const submissionDate = getResultSubmissionDate();
  const playerArmyCode = getResultSubmissionArmyCode(
    params.playerArmyCode ||
    (validated.playerArmyList.list && validated.playerArmyList.list.armyCode)
  );
  const opponentArmyCode = getResultSubmissionArmyCode(
    params.opponentArmyCode ||
    (validated.opponentArmyList.list && validated.opponentArmyList.list.armyCode)
  );

  return {
    timestamp: submissionTimestamp,
    date: submissionDate,
    division: workflow === "casual"
      ? "Casual"
      : getResultSubmissionString(params.division),
    mission: getResultSubmissionString(params.mission),
    player: validated.player,
    opponent: validated.opponent,
    playerTp: validated.playerTp,
    opponentTp: validated.opponentTp,
    playerOp: validated.playerOp,
    opponentOp: validated.opponentOp,
    playerVp: validated.playerVp,
    opponentVp: validated.opponentVp,
    firstTurn: getResultSubmissionString(params.firstTurn),
    playerFaction: validated.playerFaction,
    opponentFaction: validated.opponentFaction,
    bestMoment: getResultSubmissionString(params.bestMoment),
    eventId: validated.eventId,
    gameType: workflow,
    outcome: validated.resultIsDraw
      ? "draw"
      : validated.playerIsWinner
        ? "player"
        : "opponent",
    playerArmyCode: playerArmyCode,
    opponentArmyCode: opponentArmyCode,
    playerArmyListId: getResultSubmissionArmyListId(
      validated.playerArmyList,
      playerArmyCode
    ),
    opponentArmyListId: getResultSubmissionArmyListId(
      validated.opponentArmyList,
      opponentArmyCode
    )
  };
}

function canonicalSubmissionRecordPortalAudit_(commissionerContext, workflow, validated, row) {
  recordResultSubmissionCommissionerAudit(
    commissionerContext,
    workflow,
    {
      eventId: validated.eventId,
      player: validated.player,
      opponent: validated.opponent,
      mission: row[FORM.MISSION],
      result: row[FORM.GAME_RESULT],
      winnerArmyListId: row[FORM.WINNER_ARMY_LIST_ID],
      loserArmyListId: row[FORM.LOSER_ARMY_LIST_ID]
    }
  );
}

function canonicalSubmissionWorkflow_(value) {
  const normalized = canonicalSubmissionString_(value).toLowerCase();

  if (normalized === "team" || normalized === "team tournament" || normalized === "team-tournament")
    return "team-tournament";

  return normalized;
}

function canonicalSubmissionSuccess_(status, row, targetRow, validation, context) {
  return {
    success: true,
    status: status,
    row: row,
    targetRow: targetRow,
    validation: validation,
    context: context || {}
  };
}

function canonicalSubmissionFailure_(message, validation) {
  return {
    success: false,
    status: "Rejected",
    error: message,
    row: null,
    targetRow: null,
    validation: validation,
    context: {}
  };
}

function canonicalSubmissionString_(value) {
  return String(value || "").trim();
}
