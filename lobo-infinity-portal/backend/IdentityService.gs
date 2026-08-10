/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * IdentityService.gs
 *
 * Shared canonical player identity resolution.
 *******************************************************/

function resolveCanonicalPlayerIdentityByEmail(email, options) {

  const forensicStart =
    enterApiForensicFunction(
      "resolveCanonicalPlayerIdentityByEmail",
      "identityLookup",
      {}
    );

  try {

  const normalized =
    getIdentityServiceString(email)
      .toLowerCase();

  const settings =
    options || {};

  if (normalized === "")
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      0,
      "NO_EMAIL",
      "No authenticated Google email.",
      []
    );

  const playerSheetResolution =
    resolveCanonicalPlayerIdentityFromPlayersSheet(
      normalized,
      settings
    );

  if (playerSheetResolution.player !== "")
    return playerSheetResolution;

  if (settings.disableRecovery === true)
    return playerSheetResolution;

  const eventParticipantResolution =
    resolveCanonicalPlayerIdentityFromEventParticipants(
      normalized
    );

  if (eventParticipantResolution.player !== "")
    return eventParticipantResolution;

  return playerSheetResolution;

  }
  catch (err) {
    recordApiForensicException(
      "resolveCanonicalPlayerIdentityByEmail",
      "identityLookup",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "resolveCanonicalPlayerIdentityByEmail",
      "identityLookup",
      forensicStart,
      {}
    );
  }

}

function buildCanonicalPlayerIdentityByEmailMap(options) {

  const map = {};
  const sheetResolution =
    readIdentityServicePlayersSheet(options || {});

  if (sheetResolution.status !== "MATCH")
    return map;

  sheetResolution.matches.forEach(function(match) {
    if (!match.email)
      return;

    if (map[match.email])
      return;

    map[match.email] = {
      player: match.player,
      displayName: match.displayName || match.player,
      division: match.division,
      source: "Players",
      status: "MATCH"
    };
  });

  return map;

}

function getAuthLeagueIdentityByEmail(email) {

  const forensicStart =
    enterApiForensicFunction(
      "getAuthLeagueIdentityByEmail",
      "identityLookup",
      {}
    );

  try {
    return resolveCanonicalPlayerIdentityByEmail(
      email,
      {
        includeInactive: true
      }
    );
  }
  catch (err) {
    recordApiForensicException(
      "getAuthLeagueIdentityByEmail",
      "identityLookup",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "getAuthLeagueIdentityByEmail",
      "identityLookup",
      forensicStart,
      {}
    );
  }

}

function getAuthCanonicalPlayerIdentityByEmail(email) {

  const forensicStart =
    enterApiForensicFunction(
      "getAuthCanonicalPlayerIdentityByEmail",
      "identityLookup",
      {}
    );

  try {
    return resolveCanonicalPlayerIdentityByEmail(
      email,
      {
        includeInactive: true
      }
    );
  }
  catch (err) {
    recordApiForensicException(
      "getAuthCanonicalPlayerIdentityByEmail",
      "identityLookup",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "getAuthCanonicalPlayerIdentityByEmail",
      "identityLookup",
      forensicStart,
      {}
    );
  }

}

function buildCommunityLeagueIdentityByEmailMap() {

  return buildCanonicalPlayerIdentityByEmailMap({
    includeInactive: false
  });

}

function getCanonicalPlayerFromUser(user) {

  if (!user)
    return "";

  return getIdentityServiceString(user.canonicalPlayer) ||
    getIdentityServiceString(user.leaguePlayer);

}

function resolveCanonicalPlayerIdentityFromPlayersSheet(email, options) {

  const forensicStart =
    enterApiForensicFunction(
      "resolveCanonicalPlayerIdentityFromPlayersSheet",
      "playersSheetLookup",
      {}
    );

  try {

  const sheetResolution =
    readIdentityServicePlayersSheet(options || {});

  if (sheetResolution.status !== "MATCH")
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      0,
      sheetResolution.status,
      sheetResolution.reason,
      []
    );

  const matches =
    sheetResolution.matches.filter(function(match) {
      return match.email === email;
    });

  if (matches.length === 0)
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      0,
      "NO_MATCH",
      "No Players-sheet email match.",
      []
    );

  if (matches.length > 1)
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      matches.length,
      "DUPLICATE_MATCH",
      "Multiple Players-sheet rows match this Google email.",
      matches.map(function(match) {
        return match.row;
      }),
      "Players"
    );

  const first =
    matches[0];

  return buildIdentityServiceResolution(
    first.player,
    first.displayName || first.player,
    first.division,
    matches.length,
    "MATCH",
    "",
    matches.map(function(match) {
      return match.row;
    }),
    "Players"
  );

  }
  catch (err) {
    recordApiForensicException(
      "resolveCanonicalPlayerIdentityFromPlayersSheet",
      "playersSheetLookup",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "resolveCanonicalPlayerIdentityFromPlayersSheet",
      "playersSheetLookup",
      forensicStart,
      {}
    );
  }

}

function resolveCanonicalPlayerIdentityFromEventParticipants(email) {

  const forensicStart =
    enterApiForensicFunction(
      "resolveCanonicalPlayerIdentityFromEventParticipants",
      "registrationLookup",
      {}
    );

  try {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.EVENT_PARTICIPANTS);

  if (!sheet)
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      0,
      "EVENT_PARTICIPANTS_SHEET_MISSING",
      "Event Participants sheet not found.",
      []
    );

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      0,
      "EVENT_PARTICIPANTS_EMPTY",
      "Event Participants sheet has no rows.",
      []
    );

  const headers =
    values[0]
      .map(getIdentityServiceString);
  const emailCol =
    headers.indexOf("Email");
  const playerCol =
    headers.indexOf("Player");
  const displayNameCol =
    headers.indexOf("Display Name");
  const statusCol =
    headers.indexOf("Status");
  const divisionCol =
    headers.indexOf("Division");
  const notesCol =
    headers.indexOf("Notes");

  if (
    emailCol === -1 ||
    playerCol === -1
  )
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      0,
      "EVENT_PARTICIPANTS_HEADERS_MISSING",
      "Event Participants sheet is missing Email or Player headers.",
      []
    );

  const matches = [];

  values.slice(1)
    .forEach(function(row, index) {
      const rowEmail =
        getIdentityServiceString(row[emailCol])
          .toLowerCase();

      if (rowEmail !== email)
        return;

      const status =
        statusCol === -1
          ? ""
          : getIdentityServiceString(row[statusCol]).toLowerCase();

      if (isIdentityServiceInactiveStatus(status))
        return;

      const player =
        getIdentityServiceString(row[playerCol]);

      if (player === "")
        return;

      matches.push({
        player: player,
        displayName:
          displayNameCol === -1
            ? player
            : getIdentityServiceString(row[displayNameCol]) || player,
        division:
          divisionCol !== -1
            ? getIdentityServiceString(row[divisionCol])
            : notesCol !== -1
              ? getIdentityServiceString(row[notesCol])
              : "",
        row: index + 2
      });
    });

  if (matches.length === 0)
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      0,
      "NO_RECOVERY_MATCH",
      "No active Event Participants email match.",
      []
    );

  if (matches.length > 1)
    return buildIdentityServiceResolution(
      "",
      "",
      "",
      matches.length,
      "DUPLICATE_MATCH",
      "Multiple active Event Participants email rows match this Google email.",
      matches.map(function(match) {
        return match.row;
      }),
      "Event Participants"
    );

  const first =
    matches[0];

  return buildIdentityServiceResolution(
    first.player,
    first.displayName || first.player,
    first.division,
    matches.length,
    "RECOVERED_EVENT_PARTICIPANT_MATCH",
    "Recovered canonical player from Event Engine participant email.",
    matches.map(function(match) {
      return match.row;
    }),
    "Event Participants"
  );

  }
  catch (err) {
    recordApiForensicException(
      "resolveCanonicalPlayerIdentityFromEventParticipants",
      "registrationLookup",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "resolveCanonicalPlayerIdentityFromEventParticipants",
      "registrationLookup",
      forensicStart,
      {}
    );
  }

}

function readIdentityServicePlayersSheet(options) {

  const forensicStart =
    enterApiForensicFunction(
      "readIdentityServicePlayersSheet",
      "playersSheetLookup",
      {}
    );

  try {

  const settings =
    options || {};

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.PLAYERS);

  if (!sheet)
    return {
      matches: [],
      reason: "Players sheet not found.",
      status: "PLAYERS_SHEET_MISSING"
    };

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length === 0)
    return {
      matches: [],
      reason: "Players sheet has no rows.",
      status: "PLAYERS_SHEET_EMPTY"
    };

  const headers =
    values[0]
      .map(getIdentityServiceString);
  const playerCol =
    headers.indexOf("Player");
  const emailCol =
    headers.indexOf("Google Email");
  const displayNameCol =
    headers.indexOf("Display Name");
  const divisionCol =
    headers.indexOf("Division");
  const activeCol =
    headers.indexOf("Active");

  if (
    playerCol === -1 ||
    emailCol === -1
  )
    return {
      matches: [],
      reason: "Players sheet is missing Player or Google Email headers.",
      status: "PLAYERS_HEADERS_MISSING"
    };

  const includeInactive =
    settings.includeInactive === true;
  const matches = [];

  values.slice(1)
    .forEach(function(row, index) {
      const email =
        getIdentityServiceString(row[emailCol])
          .toLowerCase();

      if (email === "")
        return;

      if (
        !includeInactive &&
        activeCol !== -1 &&
        getIdentityServiceBoolean(row[activeCol]) === false
      )
        return;

      matches.push({
        email: email,
        player:
          getIdentityServiceString(row[playerCol]),
        displayName:
          displayNameCol === -1
            ? getIdentityServiceString(row[playerCol])
            : getIdentityServiceString(row[displayNameCol]) ||
              getIdentityServiceString(row[playerCol]),
        division:
          divisionCol === -1
            ? ""
            : getIdentityServiceString(row[divisionCol]),
        row: index + 2
      });
    });

  return {
    matches: matches,
    reason: "",
    status: "MATCH"
  };

  }
  catch (err) {
    recordApiForensicException(
      "readIdentityServicePlayersSheet",
      "playersSheetLookup",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "readIdentityServicePlayersSheet",
      "playersSheetLookup",
      forensicStart,
      {}
    );
  }

}

function buildIdentityServiceResolution(player, displayName, division, matches, status, reason, matchRows, source) {

  return {
    player: getIdentityServiceString(player),
    displayName:
      getIdentityServiceString(displayName) ||
      getIdentityServiceString(player),
    division: getIdentityServiceString(division),
    matchRows: matchRows || [],
    matches: Number(matches) || 0,
    reason: reason || "",
    source: source || "",
    status: status
  };

}

function isIdentityServiceInactiveStatus(status) {

  const inactive = {
    archived: true,
    canceled: true,
    cancelled: true,
    complete: true,
    completed: true,
    deleted: true,
    disabled: true,
    removed: true,
    retired: true,
    withdrawn: true
  };

  return inactive[getIdentityServiceString(status).toLowerCase()] === true;

}

function getIdentityServiceBoolean(value) {

  if (value === true)
    return true;

  const normalized =
    getIdentityServiceString(value)
      .toLowerCase();

  return !(
    normalized === "false" ||
    normalized === "no" ||
    normalized === "0" ||
    normalized === "inactive"
  );

}

function getIdentityServiceString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
