function deleteCanonicalPlayer(e) {
  const params = getApiParameters(e);
  const playerName = getPlayerRegistryString(params.player || params.handle);

  if (playerName === "")
    return jsonOutput({ success: false, error: "Player is required." });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = lifGetTargetSpreadsheet_();
    const audit = auditCanonicalPlayerDeletion(spreadsheet, playerName);

    if (!audit.found)
      return jsonOutput({ success: false, error: "Canonical Player was not found." });

    if (audit.dependencies.length > 0)
      return jsonOutput({
        success: false,
        code: "PLAYER_HAS_HISTORY",
        dependencies: audit.dependencies,
        error:
          "Player cannot be deleted because authoritative history exists: " +
          audit.dependencies.join(", ") + "."
      });

    audit.eligibleParticipantRows
      .slice()
      .sort(function(left, right) { return right - left; })
      .forEach(function(rowNumber) {
        audit.participantSheet.deleteRow(rowNumber);
      });

    audit.playerSheet.deleteRow(audit.playerRow);

    invalidatePlayerRegistryCache();
    invalidateEventEngineSnapshotCache();
    invalidatePortalCacheGroup("all");

    return jsonOutput({
      success: true,
      player: audit.player,
      removedParticipantRows: audit.eligibleParticipantRows.length,
      message: audit.player + " was deleted."
    });
  }
  finally {
    lock.releaseLock();
  }
}

function auditCanonicalPlayerDeletion(spreadsheet, playerName) {
  const playerKey = normalizeCanonicalPlayerDeletionKey(playerName);
  const playerSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.PLAYERS);

  if (!playerSheet)
    throw new Error("Players sheet not found.");

  const playerTable = readCanonicalPlayerDeletionTable(playerSheet);
  const playerMatches = findCanonicalPlayerDeletionRows(
    playerTable,
    ["Player"],
    playerKey
  );

  if (playerMatches.length === 0)
    return { found: false, dependencies: [] };

  const dependencies = [];

  if (playerMatches.length > 1)
    dependencies.push("duplicate canonical Player rows");

  const playerMatch = playerMatches[0];
  const playerRow = playerTable.rows[playerMatch.index];

  if (getCanonicalPlayerDeletionValue(playerRow, playerTable, "Division") !== "")
    dependencies.push("league division assignment");

  ["Google Email", "Email", "Alias", "Aliases"].forEach(function(header) {
    if (getCanonicalPlayerDeletionValue(playerRow, playerTable, header) !== "")
      dependencies.push("player identity mapping");
  });

  const specs = [
    [CONFIG.SHEETS.FORM, ["Player 1", "Player 2"], "canonical games"],
    [CONFIG.SHEETS.ENGINE, ["Player", "Opponent"], "Game Engine history"],
    [CONFIG.SHEETS.ARMY_LISTS, ["Player"], "Army Lists"],
    [CONFIG.SHEETS.ARMY_INTELLIGENCE, ["Player"], "Army Intelligence history"],
    [CONFIG.SHEETS.ACHIEVEMENTS, ["Player"], "achievements"],
    [CONFIG.SHEETS.SEASON_AVAILABILITY, ["Player"], "stored availability"],
    [CONFIG.SHEETS.SCHEDULING_REQUESTS, ["From Player", "To Player"], "scheduling history"],
    [CONFIG.SHEETS.TEAM_TOURNAMENT_INVITATIONS, ["Captain", "Player"], "Team Tournament invitation"],
    [CONFIG.SHEETS.USERS, ["Display Name"], "Users identity record"]
  ];

  specs.forEach(function(spec) {
    if (canonicalPlayerDeletionSheetHasMatch(spreadsheet, spec[0], spec[1], playerKey))
      dependencies.push(spec[2]);
  });

  if (canonicalPlayerDeletionTeamHasMatch(spreadsheet, playerKey))
    dependencies.push("Team Tournament team membership");

  if (canonicalPlayerDeletionPairingHasMatch(spreadsheet, playerKey))
    dependencies.push("Team Tournament pairing history");

  [
    CONFIG.SHEETS.ARMY_CODE_VALIDATION_AUDIT,
    CONFIG.SHEETS.GAME_SCORE_CORRECTION_AUDIT,
    CONFIG.SHEETS.GAME_ARMY_CODE_CORRECTION_AUDIT,
    CONFIG.SHEETS.SEASON_ARCHIVE
  ].forEach(function(sheetName) {
    if (canonicalPlayerDeletionSheetHasAnyCellMatch(spreadsheet, sheetName, playerKey))
      dependencies.push(sheetName);
  });

  const participantAudit = auditCanonicalPlayerDeletionParticipants(
    spreadsheet,
    playerKey
  );

  participantAudit.dependencies.forEach(function(dependency) {
    dependencies.push(dependency);
  });

  return {
    found: true,
    player: getCanonicalPlayerDeletionValue(playerRow, playerTable, "Player"),
    playerSheet: playerSheet,
    playerRow: playerMatch.rowNumber,
    participantSheet: participantAudit.sheet,
    eligibleParticipantRows: participantAudit.eligibleRows,
    dependencies: uniqueCanonicalPlayerDeletionValues(dependencies)
  };
}

function auditCanonicalPlayerDeletionParticipants(spreadsheet, playerKey) {
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.EVENT_PARTICIPANTS);

  if (!sheet)
    return { sheet: null, eligibleRows: [], dependencies: [] };

  const table = readCanonicalPlayerDeletionTable(sheet);
  const matches = findCanonicalPlayerDeletionRows(table, ["Player", "Display Name"], playerKey);
  const eligibleRows = [];
  const dependencies = [];

  matches.forEach(function(match) {
    const row = table.rows[match.index];

    if (isEligibleSynthesizedCurrentLeagueParticipant(row, table, playerKey))
      eligibleRows.push(match.rowNumber);
    else
      dependencies.push("event participation history");
  });

  if (eligibleRows.length > 1)
    dependencies.push("ambiguous current-League participant rows");

  return { sheet: sheet, eligibleRows: eligibleRows, dependencies: dependencies };
}

function isEligibleSynthesizedCurrentLeagueParticipant(row, table, playerKey) {
  if (getCanonicalPlayerDeletionValue(row, table, "Event ID") !== EVENT_ENGINE_DEFAULT_EVENT_ID)
    return false;

  if (normalizeCanonicalPlayerDeletionKey(getCanonicalPlayerDeletionValue(row, table, "Player")) !== playerKey)
    return false;

  if (getCanonicalPlayerDeletionValue(row, table, "Role") !== "Player")
    return false;

  if (getCanonicalPlayerDeletionValue(row, table, "Status") !== "Active")
    return false;

  return [
    "Registered At", "Seed", "Team", "Notes", "Email", "Discord",
    "Preferred Team", "Captain", "Free Agent", "Faction", "Updated At"
  ].every(function(header) {
    return getCanonicalPlayerDeletionValue(row, table, header) === "";
  });
}

function canonicalPlayerDeletionSheetHasMatch(spreadsheet, sheetName, headers, playerKey) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2)
    return false;
  return findCanonicalPlayerDeletionRows(
    readCanonicalPlayerDeletionTable(sheet),
    headers,
    playerKey
  ).length > 0;
}

function canonicalPlayerDeletionTeamHasMatch(spreadsheet, playerKey) {
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.TEAM_TOURNAMENT_TEAMS);
  if (!sheet || sheet.getLastRow() < 2)
    return false;
  const table = readCanonicalPlayerDeletionTable(sheet);
  return table.rows.some(function(row) {
    return normalizeCanonicalPlayerDeletionKey(getCanonicalPlayerDeletionValue(row, table, "Captain")) === playerKey ||
      canonicalPlayerDeletionStructuredValueContains(
        getCanonicalPlayerDeletionValue(row, table, "Players"),
        playerKey
      );
  });
}

function canonicalPlayerDeletionPairingHasMatch(spreadsheet, playerKey) {
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.TEAM_TOURNAMENT_PAIRINGS);
  if (!sheet || sheet.getLastRow() < 2)
    return false;
  const table = readCanonicalPlayerDeletionTable(sheet);
  return table.rows.some(function(row) {
    return canonicalPlayerDeletionStructuredValueContains(
      getCanonicalPlayerDeletionValue(row, table, "Player Pairings"),
      playerKey
    );
  });
}

function canonicalPlayerDeletionStructuredValueContains(value, playerKey) {
  const text = String(value || "").trim();
  if (text === "")
    return false;

  try {
    return canonicalPlayerDeletionJsonContains(JSON.parse(text), playerKey);
  }
  catch (err) {
    return text.split(/[;,|\n]/).some(function(part) {
      return normalizeCanonicalPlayerDeletionKey(part) === playerKey;
    });
  }
}

function canonicalPlayerDeletionJsonContains(value, playerKey) {
  if (typeof value === "string")
    return normalizeCanonicalPlayerDeletionKey(value) === playerKey;
  if (Array.isArray(value))
    return value.some(function(item) {
      return canonicalPlayerDeletionJsonContains(item, playerKey);
    });
  if (value && typeof value === "object")
    return Object.keys(value).some(function(key) {
      return canonicalPlayerDeletionJsonContains(value[key], playerKey);
    });
  return false;
}

function canonicalPlayerDeletionSheetHasAnyCellMatch(spreadsheet, sheetName, playerKey) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2)
    return false;
  const values = sheet.getDataRange().getValues();
  return values.slice(1).some(function(row) {
    return row.some(function(value) {
      return normalizeCanonicalPlayerDeletionKey(value) === playerKey;
    });
  });
}

function readCanonicalPlayerDeletionTable(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0].map(function(value) {
    return String(value || "").trim();
  }) : [];
  const columns = {};
  headers.forEach(function(header, index) { columns[header] = index; });
  return { headers: headers, columns: columns, rows: values.slice(1) };
}

function findCanonicalPlayerDeletionRows(table, headers, playerKey) {
  const indexes = headers.map(function(header) {
    return table.columns[header];
  }).filter(function(index) { return index !== undefined; });

  return table.rows.map(function(row, index) {
    return { row: row, index: index, rowNumber: index + 2 };
  }).filter(function(entry) {
    return indexes.some(function(index) {
      return normalizeCanonicalPlayerDeletionKey(entry.row[index]) === playerKey;
    });
  });
}

function getCanonicalPlayerDeletionValue(row, table, header) {
  const index = table.columns[header];
  return index === undefined ? "" : String(row[index] || "").trim();
}

function normalizeCanonicalPlayerDeletionKey(value) {
  return String(value === null || value === undefined ? "" : value).trim().toLowerCase();
}

function uniqueCanonicalPlayerDeletionValues(values) {
  const seen = {};
  return values.filter(function(value) {
    if (seen[value]) return false;
    seen[value] = true;
    return true;
  });
}
