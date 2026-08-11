
function handleLoboFormSubmit(e) {
  if (!e || !e.range || !e.namedValues) throw new Error("A spreadsheet form-submit event is required.");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sourceSheet = e.range.getSheet();
    const formType = lifResolveFormType_(sourceSheet);
    const responseKey = sourceSheet.getSheetId() + ":" + e.range.getRow();
    const target = SpreadsheetApp.openById(lifRequireProperty_(LIF_FORMS.PROPERTIES.TARGET_SPREADSHEET_ID));
    const log = lifEnsureImportLog_(target);
    if (lifWasImported_(log, responseKey)) return;

    const submission = lifReadSubmission_(e.namedValues, formType, e.values && e.values[0], target);
    const errors = validateCanonicalGame({
      source: "google-form",
      workflow: formType,
      submission: submission
    }).errors;
    if (errors.length) {
      lifWriteImportLog_(log, responseKey, formType, "", "Rejected", errors.join(" "));
      throw new Error(errors.join(" "));
    }

    const targetRow = lifAppendCanonicalGameSubmission_(target, submission);
    lifWriteImportLog_(log, responseKey, formType, targetRow, "Imported", "");
    SpreadsheetApp.flush();
    lifRunDeterministicRebuild_(log, responseKey, formType, targetRow);
  } finally {
    lock.releaseLock();
  }
}

function lifResolveFormType_(sheet) {
  const url = String(sheet.getFormUrl() || "");
  const sheetName = String(sheet.getName() || "").trim();
  const props = lifGetProperties_();
  const mappings = [
    [LIF_FORMS.PROPERTIES.LEAGUE_FORM_ID, LIF_FORMS.TYPES.LEAGUE],
    [LIF_FORMS.PROPERTIES.TEAM_FORM_ID, LIF_FORMS.TYPES.TEAM],
    [LIF_FORMS.PROPERTIES.CASUAL_FORM_ID, LIF_FORMS.TYPES.CASUAL]
  ];
  for (let i = 0; i < mappings.length; i += 1) {
    const id = props.getProperty(mappings[i][0]);
    if (id && url.indexOf(id) >= 0) return mappings[i][1];
  }
  if (sheetName === LIF_FORMS.TARGET_SHEET) return LIF_FORMS.TYPES.LEAGUE;
  if (sheetName === "Form Responses 15") return LIF_FORMS.TYPES.TEAM;
  throw new Error("The response sheet is not linked to an installed Lobo form.");
}

function lifReadSubmission_(named, formType, timestamp, targetSpreadsheet) {
  const f = LIF_FORMS.FIELDS;
  const get = function(title) { return String((named[title] || [""])[0] || "").trim(); };
  const selectedPlayer = get(f.PLAYER);
  const leagueContext = formType === LIF_FORMS.TYPES.LEAGUE
    ? lifResolveLeagueImportContext_(targetSpreadsheet, selectedPlayer)
    : null;
  const teamTournamentContext = formType === LIF_FORMS.TYPES.TEAM
    ? lifResolveTeamTournamentImportContext_(targetSpreadsheet, selectedPlayer)
    : null;
  return {
    timestamp: timestamp || new Date(), formType: formType,
    eventId: formType === LIF_FORMS.TYPES.CASUAL ? "" : leagueContext ? leagueContext.eventId : teamTournamentContext.eventId,
    division: formType === LIF_FORMS.TYPES.CASUAL ? "Casual" : leagueContext ? leagueContext.division : get(f.DIVISION) || "Team Tournament",
    round: get(f.ROUND), team: get(f.TEAM) || get("Your Team"), opponentTeam: get(f.OPPONENT_TEAM),
    mission: get(f.MISSION), player: leagueContext ? leagueContext.player : teamTournamentContext ? teamTournamentContext.player : selectedPlayer, opponent: get(f.OPPONENT),
    playerFaction: get(f.PLAYER_FACTION), opponentFaction: get(f.OPPONENT_FACTION),
    playerArmyCode: lifNormalizeArmyCode_(get(f.PLAYER_ARMY_CODE)),
    opponentArmyCode: lifNormalizeArmyCode_(get(f.OPPONENT_ARMY_CODE)),
    playerTp: get(f.PLAYER_TP), opponentTp: get(f.OPPONENT_TP),
    playerOp: get(f.PLAYER_OP), opponentOp: get(f.OPPONENT_OP),
    playerVp: get(f.PLAYER_VP), opponentVp: get(f.OPPONENT_VP),
    gameResult: get(f.GAME_RESULT), firstTurn: get(f.FIRST_TURN),
    bestMoment: get(f.BEST_MOMENT), notes: get(f.NOTES)
  };
}

function lifResolveTeamTournamentImportContext_(spreadsheet, selectedPlayer) {
  if (!spreadsheet) throw new Error("The target portal spreadsheet is required for Team Tournament imports.");
  const tournamentOptions = lifGetTeamTournamentFormOptions_();
  const selectedKey = lifNormalize_(selectedPlayer);
  const registeredPlayer = tournamentOptions.players
    .filter(function(player) {
      return lifNormalize_(player) === selectedKey;
    })[0];
  if (!registeredPlayer) throw new Error("Selected Player is not registered in the active Team Tournament.");
  return {
    eventId: tournamentOptions.eventId,
    player: String(registeredPlayer).trim()
  };
}

function lifResolveActiveTeamTournamentEventId_(spreadsheet) {
  if (!spreadsheet) throw new Error("The target portal spreadsheet is required to resolve the active Team Tournament.");
  const events = lifReadSheetObjects_(spreadsheet, "Events").filter(function(event) {
    return lifNormalize_(event["Type"]) === "team tournament" && lifLeagueRowIsActive_(event);
  });
  const current = events.filter(function(event) {
    return lifNormalize_(event["Status"]) === "current active event" ||
      lifNormalize_(event["Status"]) === "active" ||
      lifNormalize_(event["Lifecycle Stage"]) === "active";
  });
  if (current.length === 1) return String(current[0]["ID"] || "").trim();
  if (current.length > 1) throw new Error("Multiple active Team Tournament events were found.");
  const defaultId = typeof EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID === "undefined"
    ? ""
    : String(EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID || "").trim();
  const configured = events.filter(function(event) {
    return defaultId && String(event["ID"] || "").trim() === defaultId;
  });
  if (configured.length === 1) return defaultId;
  if (events.length === 1) return String(events[0]["ID"] || "").trim();
  if (!events.length) throw new Error("No active Team Tournament event was found.");
  throw new Error("Multiple Team Tournament events are active; the current event is ambiguous.");
}

function lifResolveLeagueImportContext_(spreadsheet, selectedPlayer) {
  if (!spreadsheet) throw new Error("The target portal spreadsheet is required for League imports.");
  const players = lifReadSheetObjects_(spreadsheet, "Players");
  const selectedKey = lifNormalize_(selectedPlayer);
  const player = players.filter(function(row) {
    return lifNormalize_(row["Player"]) === selectedKey || lifNormalize_(row["Display Name"]) === selectedKey;
  })[0];
  if (!player) throw new Error("Selected Player was not found in the Players sheet.");
  const canonicalPlayer = String(player["Player"] || selectedPlayer).trim();
  const displayName = String(player["Display Name"] || canonicalPlayer).trim();
  const playerKeys = [lifNormalize_(canonicalPlayer), lifNormalize_(displayName)];
  const activeLeagueEvents = {};
  lifReadSheetObjects_(spreadsheet, "Events").forEach(function(event) {
    if (lifNormalize_(event["Type"]) === "league" && lifLeagueRowIsActive_(event)) {
      const eventId = String(event["ID"] || "").trim();
      if (eventId) activeLeagueEvents[eventId] = true;
    }
  });
  const registrations = lifReadSheetObjects_(spreadsheet, "Event Participants").filter(function(registration) {
    const eventId = String(registration["Event ID"] || "").trim();
    const registrationKey = lifNormalize_(registration["Player"] || registration["Display Name"]);
    return activeLeagueEvents[eventId] && playerKeys.indexOf(registrationKey) >= 0 && lifLeagueRowIsActive_(registration);
  });
  if (!registrations.length) throw new Error("Selected Player has no current active League registration.");
  let registration = registrations.filter(function(row) {
    return String(row["Event ID"] || "").trim() === "event-current-league";
  })[0];
  if (!registration && registrations.length === 1) registration = registrations[0];
  if (!registration) throw new Error("Selected Player has multiple active League registrations; the current event is ambiguous.");
  const division = String(registration["Notes"] || player["Division"] || "").trim();
  if (!division) throw new Error("Selected Player has no League division in portal data.");
  return { eventId: String(registration["Event ID"] || "").trim(), division: division, player: canonicalPlayer };
}

function lifReadSheetObjects_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(sheetName + " sheet not found.");
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];
  const headers = values[0].map(function(value) { return String(value || "").trim(); });
  return values.slice(1).map(function(row) {
    const object = {};
    headers.forEach(function(header, index) { if (header) object[header] = row[index]; });
    return object;
  });
}

function lifLeagueRowIsActive_(row) {
  const terminal = { archived: true, canceled: true, cancelled: true, complete: true, completed: true, deleted: true, inactive: true, rejected: true, retired: true, withdrawn: true };
  return !terminal[lifNormalize_(row["Status"])] && !terminal[lifNormalize_(row["Lifecycle Stage"])] && lifNormalize_(row["Archive"]) !== "archived";
}

function lifBuildCanonicalRow_(s) {
  const casual = s.formType === LIF_FORMS.TYPES.CASUAL;
  const command = {
    division: s.division,
    mission: s.mission,
    player: s.player,
    opponent: s.opponent,
    playerTp: s.playerTp,
    opponentTp: s.opponentTp,
    playerOp: s.playerOp,
    opponentOp: s.opponentOp,
    playerVp: s.playerVp,
    opponentVp: s.opponentVp,
    firstTurn: s.firstTurn,
    firstTurnMode: casual ? "legacy-casual" : "canonical",
    playerFaction: s.playerFaction,
    opponentFaction: s.opponentFaction,
    canonicalizeFactions: !casual,
    bestMoment: s.bestMoment,
    eventId: s.eventId,
    gameType: casual
      ? "casual"
      : s.formType === LIF_FORMS.TYPES.TEAM
        ? "tournament"
        : "league",
    gameResult: s.gameResult,
    gameResultMode: casual ? "winner-name" : "canonical",
    playerArmyCode: s.playerArmyCode,
    opponentArmyCode: s.opponentArmyCode,
    deriveArmyListIds: !casual
  };

  if (casual) {
    command.timestamp = s.timestamp;
    command.date = new Date();
    command.playerArmyListId = "";
    command.opponentArmyListId = "";
  }

  return buildCanonicalGameRow(command);
}

function lifResolveCanonicalFirstTurn_(submission) {
  const firstTurn = String(submission.firstTurn || "").trim();
  const normalized = lifNormalize_(firstTurn);
  if (normalized === "player" || normalized === lifNormalize_(submission.player)) {
    return String(submission.player || "").trim();
  }
  if (normalized === "opponent" || normalized === lifNormalize_(submission.opponent)) {
    return String(submission.opponent || "").trim();
  }
  return firstTurn;
}

function lifEnsureCanonicalSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(LIF_FORMS.TARGET_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(LIF_FORMS.TARGET_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(LIF_FORMS.CANONICAL_HEADERS.slice());
  const headers = sheet.getRange(1, 1, 1, LIF_FORMS.CANONICAL_HEADERS.length).getValues()[0];
  LIF_FORMS.CANONICAL_HEADERS.forEach(function(header, index) {
    if (!String(headers[index] || "").trim()) sheet.getRange(1, index + 1).setValue(header);
  });
  return sheet;
}

function lifAppendCanonicalGameSubmission_(spreadsheet, submission) {
  const sheet = lifEnsureCanonicalSheet_(spreadsheet);
  sheet.appendRow(lifBuildCanonicalRow_(submission));
  return sheet.getLastRow();
}

function lifEnsureImportLog_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(LIF_FORMS.IMPORT_LOG_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(LIF_FORMS.IMPORT_LOG_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(LIF_FORMS.IMPORT_LOG_HEADERS.slice());
  return sheet;
}

function lifWasImported_(log, key) {
  if (log.getLastRow() < 2) return false;
  return log.getRange(2, 1, log.getLastRow() - 1, 1).getDisplayValues()
    .some(function(row) { return row[0] === key; });
}

function lifWriteImportLog_(log, key, type, row, status, message) {
  log.appendRow([key, type, new Date(), row, status, message]);
}

function lifRunDeterministicRebuild_(log, responseKey, formType, targetRow) {
  const functionName = typeof rebuildEverything === "function"
    ? "rebuildEverything"
    : typeof rebuildGameEngine === "function"
      ? "rebuildGameEngine"
      : "none";
  try {
    lifRunCanonicalGamePipeline_();
  } catch (error) {
    lifWriteImportLog_(log, responseKey, formType, targetRow, "Rebuild Failed", JSON.stringify({
      timestamp: new Date().toISOString(),
      functionName: functionName,
      message: error && error.message ? String(error.message) : String(error),
      stack: error && error.stack ? String(error.stack) : ""
    }));
    throw error;
  }
}

function lifRunCanonicalGamePipeline_() {
  if (typeof rebuildEverything === "function") rebuildEverything();
  else if (typeof rebuildGameEngine === "function") rebuildGameEngine();
  else Logger.log("Import complete. Deterministic rebuild function is not present in this Apps Script runtime.");
}
