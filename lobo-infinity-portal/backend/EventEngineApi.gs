/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * EventEngineApi.gs
 *
 * Version 3.0B Event Engine foundation.
 *******************************************************/

const EVENT_ENGINE_COMMUNITY_ID = "community-lobo-infinity";
const EVENT_ENGINE_COMMUNITY_NAME = "Lobo Infinity Community";
const EVENT_ENGINE_DEFAULT_SERIES_ID = "series-lobo-league";
const EVENT_ENGINE_DEFAULT_SERIES_NAME = "Lobo Infinity League Series";
const EVENT_ENGINE_DEFAULT_TEMPLATE_ID = "template-league-season";
const EVENT_ENGINE_DEFAULT_EVENT_ID = "event-current-league";
const EVENT_ENGINE_DEFAULT_SEASON_ID = "season-current-league";
const EVENT_ENGINE_DEFAULT_ROUND_ID = "round-current-league";

const EVENT_ENGINE_EVENT_HEADERS = [
  "ID",
  "Community ID",
  "Series ID",
  "Template ID",
  "Name",
  "Description",
  "Type",
  "Lifecycle Stage",
  "Status",
  "Owner",
  "Commissioners",
  "Start Date",
  "End Date",
  "Registration",
  "Participants",
  "Rules",
  "Scoring Model",
  "Standings Model",
  "Automation",
  "Discord",
  "Achievements",
  "History",
  "Archive",
  "Created At",
  "Updated At"
];

const EVENT_ENGINE_TEMPLATE_HEADERS = [
  "ID",
  "Name",
  "Description",
  "Event Type",
  "Version",
  "Active",
  "Rules",
  "Scoring Model",
  "Standings Model",
  "Round Model",
  "Automation",
  "Discord",
  "Achievements",
  "Registration",
  "Permissions",
  "Default Timeline",
  "Default Notifications",
  "Created At",
  "Updated At"
];

const EVENT_ENGINE_PARTICIPANT_HEADERS = [
  "Event ID",
  "Player",
  "Display Name",
  "Role",
  "Status",
  "Registered At",
  "Seed",
  "Team",
  "Notes"
];

const EVENT_ENGINE_SEASON_HEADERS = [
  "ID",
  "Event ID",
  "Name",
  "Number",
  "Start Date",
  "End Date",
  "Status",
  "Lifecycle Stage",
  "Rules",
  "Automation",
  "Created At",
  "Updated At"
];

const EVENT_ENGINE_ROUND_HEADERS = [
  "ID",
  "Event ID",
  "Season ID",
  "Name",
  "Number",
  "Type",
  "Start Date",
  "End Date",
  "Status",
  "Games",
  "Automation",
  "Created At",
  "Updated At"
];

function getEvents(e) {

  const engine =
    ensureEventEngine();

  return jsonOutput({
    success: true,
    community: getEventEngineCommunity(),
    series: [getEventEngineDefaultSeries()],
    currentEvent: getCurrentLeagueEvent(),
    events: engine.events
  });

}

function getEvent(e) {

  const params =
    getEventEngineParams(e);

  const eventId =
    getEventEngineString(params.eventId || params.id) ||
    EVENT_ENGINE_DEFAULT_EVENT_ID;

  const event =
    getEventById(eventId) ||
    getCurrentLeagueEvent();

  return jsonOutput({
    success: true,
    event: event
  });

}

function getEventTemplates() {

  ensureEventEngine();

  return jsonOutput({
    success: true,
    templates: getEventTemplateObjects()
  });

}

function getEventSeasons(e) {

  const params =
    getEventEngineParams(e);

  const eventId =
    resolveEventId(params.eventId);

  ensureEventEngine();

  return jsonOutput({
    success: true,
    eventId: eventId,
    seasons:
      getEventSeasonObjects()
        .filter(function(season) {
          return season.eventId === eventId;
        })
  });

}

function getEventRounds(e) {

  const params =
    getEventEngineParams(e);

  const eventId =
    resolveEventId(params.eventId);

  const seasonId =
    getEventEngineString(params.seasonId);

  ensureEventEngine();

  return jsonOutput({
    success: true,
    eventId: eventId,
    seasonId:
      seasonId ||
      EVENT_ENGINE_DEFAULT_SEASON_ID,
    rounds:
      getEventRoundObjects()
        .filter(function(round) {
          return (
            round.eventId === eventId &&
            (
              seasonId === "" ||
              round.seasonId === seasonId
            )
          );
        })
  });

}

function getEventMigrationAudit() {

  return jsonOutput({
    success: true,
    audit: buildEventMigrationAudit()
  });

}

function getEventMigrationPreview() {

  return jsonOutput({
    success: true,
    preview: buildEventMigrationPreview()
  });

}

function getEventMigrationReport() {

  return jsonOutput({
    success: true,
    report: buildEventMigrationReport()
  });

}

function getEventMigrationRollback() {

  return jsonOutput({
    success: true,
    rollback: buildEventMigrationRollback()
  });

}

function ensureEventEngine() {

  const sheets = {
    events:
      ensureEventEngineSheet(
        CONFIG.SHEETS.EVENTS,
        EVENT_ENGINE_EVENT_HEADERS
      ),
    templates:
      ensureEventEngineSheet(
        CONFIG.SHEETS.EVENT_TEMPLATES,
        EVENT_ENGINE_TEMPLATE_HEADERS
      ),
    participants:
      ensureEventEngineSheet(
        CONFIG.SHEETS.EVENT_PARTICIPANTS,
        EVENT_ENGINE_PARTICIPANT_HEADERS
      ),
    seasons:
      ensureEventEngineSheet(
        CONFIG.SHEETS.EVENT_SEASONS,
        EVENT_ENGINE_SEASON_HEADERS
      ),
    rounds:
      ensureEventEngineSheet(
        CONFIG.SHEETS.EVENT_ROUNDS,
        EVENT_ENGINE_ROUND_HEADERS
      )
  };

  ensureDefaultEventTemplates(sheets.templates);
  ensureDefaultCurrentLeagueEvent(sheets.events);
  ensureDefaultCurrentLeagueSeason(sheets.seasons);
  ensureDefaultCurrentLeagueRound(sheets.rounds);
  ensureDefaultCurrentLeagueParticipants(sheets.participants);

  return {
    events: getEventObjects(),
    templates: getEventTemplateObjects(),
    seasons: getEventSeasonObjects(),
    rounds: getEventRoundObjects()
  };

}

function resolveEventId(value) {

  const eventId =
    getEventEngineString(value);

  if (eventId !== "")
    return eventId;

  return EVENT_ENGINE_DEFAULT_EVENT_ID;

}

function resolveSeasonId(value) {

  const seasonId =
    getEventEngineString(value);

  if (seasonId !== "")
    return seasonId;

  return EVENT_ENGINE_DEFAULT_SEASON_ID;

}

function resolveRoundId(value) {

  const roundId =
    getEventEngineString(value);

  if (roundId !== "")
    return roundId;

  return EVENT_ENGINE_DEFAULT_ROUND_ID;

}

function getCurrentLeagueEvent() {

  ensureEventEngine();

  return getEventById(EVENT_ENGINE_DEFAULT_EVENT_ID);

}

function getEventById(eventId) {

  const target =
    getEventEngineString(eventId);

  return getEventObjects()
    .filter(function(event) {
      return event.id === target;
    })[0] || null;

}

function ensureDefaultEventTemplates(sheet) {

  const defaults = [
    [
      EVENT_ENGINE_DEFAULT_TEMPLATE_ID,
      "League Season Template",
      "Recurring league season with divisions, TP/OP/VP scoring, standings, reminders, achievements, and promotion context.",
      "League",
      "1",
      true,
      "League rules",
      "TP/OP/VP",
      "Division standings",
      "League Weeks",
      "Season reminders, promotion race, final week",
      "League channel",
      "League scoped",
      "Commissioner controlled",
      "Commissioner, Assistant Commissioner, Player",
      "Season start, midseason, final week, awards",
      "Remaining games, deadline, promotion/relegation",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ],
    [
      "template-army-roulette",
      "Army Roulette Template",
      "Special event template for randomized army participation.",
      "Special Event",
      "1",
      true,
      "Army Roulette rules",
      "Participation and event result",
      "Event standings",
      "Event Rounds",
      "Registration, pairings, results",
      "Event channel",
      "Event scoped",
      "Open registration",
      "Organizer, Assistant Organizer, Player",
      "Registration, active, completed",
      "Registration and result notifications",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ],
    [
      "template-team-tournament",
      "Team Tournament Template",
      "Team event template for rostered tournament play.",
      "Team Event",
      "1",
      true,
      "Team tournament rules",
      "Team aggregate",
      "Team standings",
      "Tournament Rounds",
      "Pairings, round reminders, awards",
      "Tournament channel",
      "Tournament scoped",
      "Roster registration",
      "Organizer, Assistant Organizer, Player",
      "Pairings and round results",
      "Round deadlines and results",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ],
    [
      "template-aurora-campaign",
      "Aurora VII Campaign Template",
      "Narrative campaign template with campaign turns and story automation.",
      "Narrative Campaign",
      "1",
      true,
      "Campaign rules",
      "Narrative objectives",
      "Campaign progress",
      "Campaign Turns",
      "Story updates, turn reminders",
      "Campaign channel",
      "Campaign scoped",
      "Organizer controlled",
      "Organizer, Assistant Organizer, Player",
      "Chapter updates and milestones",
      "Turn reminders and story updates",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ],
    [
      "template-escalation-league",
      "Escalation League Template",
      "Escalation format template with phased rounds.",
      "Escalation",
      "1",
      true,
      "Escalation rules",
      "Phase scoring",
      "Event standings",
      "Escalation Phases",
      "Phase reminders, standings",
      "Event channel",
      "Event scoped",
      "Open registration",
      "Organizer, Assistant Organizer, Player",
      "Phase start and phase close",
      "Phase deadlines",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ],
    [
      "template-narrative-weekend",
      "Narrative Weekend Template",
      "Casual narrative weekend template for one-off story events.",
      "Casual",
      "1",
      true,
      "Narrative weekend rules",
      "Participation",
      "No standings",
      "Casual Sessions",
      "Registration and schedule reminders",
      "Community channel",
      "Participation scoped",
      "Open registration",
      "Organizer, Player",
      "Event announcement and recap",
      "Event reminders",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ]
  ];

  defaults.forEach(function(row) {
    upsertEventEngineRow(
      sheet,
      EVENT_ENGINE_TEMPLATE_HEADERS,
      "ID",
      row[0],
      row
    );
  });

}

function ensureDefaultCurrentLeagueEvent(sheet) {

  const settings =
    getEventEngineSettings();

  upsertEventEngineRow(
    sheet,
    EVENT_ENGINE_EVENT_HEADERS,
    "ID",
    EVENT_ENGINE_DEFAULT_EVENT_ID,
    [
      EVENT_ENGINE_DEFAULT_EVENT_ID,
      EVENT_ENGINE_COMMUNITY_ID,
      EVENT_ENGINE_DEFAULT_SERIES_ID,
      EVENT_ENGINE_DEFAULT_TEMPLATE_ID,
      "Current League",
      "Backward-compatible default Event for the existing Lobo Infinity League.",
      "League",
      "Active",
      "Active",
      "Commissioner",
      "",
      settings.seasonStartDate || "",
      settings.seasonEndDate || "",
      settings.registrationOpen === "true"
        ? "Registration Open"
        : "Registration Closed",
      "Players sheet",
      "Current league rules",
      "TP/OP/VP",
      "Division standings",
      "Existing Automation Center",
      "Existing Discord configuration",
      "League scoped achievements",
      "Current league history",
      "Not archived",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ]
  );

}

function ensureDefaultCurrentLeagueSeason(sheet) {

  const settings =
    getEventEngineSettings();

  upsertEventEngineRow(
    sheet,
    EVENT_ENGINE_SEASON_HEADERS,
    "ID",
    EVENT_ENGINE_DEFAULT_SEASON_ID,
    [
      EVENT_ENGINE_DEFAULT_SEASON_ID,
      EVENT_ENGINE_DEFAULT_EVENT_ID,
      settings.currentSeason || "Current League Season",
      1,
      settings.seasonStartDate || "",
      settings.seasonEndDate || "",
      "Active",
      "Active",
      "Current league season rules",
      "Season reminders",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ]
  );

}

function ensureDefaultCurrentLeagueRound(sheet) {

  upsertEventEngineRow(
    sheet,
    EVENT_ENGINE_ROUND_HEADERS,
    "ID",
    EVENT_ENGINE_DEFAULT_ROUND_ID,
    [
      EVENT_ENGINE_DEFAULT_ROUND_ID,
      EVENT_ENGINE_DEFAULT_EVENT_ID,
      EVENT_ENGINE_DEFAULT_SEASON_ID,
      "Current League",
      1,
      "League Week",
      "",
      "",
      "Active",
      "Existing league games resolve here until migration.",
      "Season Command Center reminders",
      getEventEngineTimestamp(),
      getEventEngineTimestamp()
    ]
  );

}

function ensureDefaultCurrentLeagueParticipants(sheet) {

  const players =
    getEventEnginePlayerRows();

  players.forEach(function(player) {
    upsertEventEngineCompositeRow(
      sheet,
      EVENT_ENGINE_PARTICIPANT_HEADERS,
      [
        "Event ID",
        "Player"
      ],
      [
        EVENT_ENGINE_DEFAULT_EVENT_ID,
        player.player
      ],
      [
        EVENT_ENGINE_DEFAULT_EVENT_ID,
        player.player,
        player.displayName || player.player,
        "Player",
        "Active",
        "",
        "",
        "",
        ""
      ]
    );
  });

}

function getEventObjects() {

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENTS,
      EVENT_ENGINE_EVENT_HEADERS
    );

  return getEventEngineRows(sheet)
    .map(function(row) {
      return {
        id: row["ID"],
        communityId: row["Community ID"],
        seriesId: row["Series ID"],
        templateId: row["Template ID"],
        name: row["Name"],
        description: row["Description"],
        type: row["Type"],
        lifecycleStage: row["Lifecycle Stage"],
        status: row["Status"],
        owner: row["Owner"],
        commissioners: row["Commissioners"],
        startDate: row["Start Date"],
        endDate: row["End Date"],
        registration: row["Registration"],
        participants: row["Participants"],
        rules: row["Rules"],
        scoringModel: row["Scoring Model"],
        standingsModel: row["Standings Model"],
        automation: row["Automation"],
        discord: row["Discord"],
        achievements: row["Achievements"],
        history: row["History"],
        archive: row["Archive"],
        createdAt: row["Created At"],
        updatedAt: row["Updated At"]
      };
    });

}

function getEventTemplateObjects() {

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_TEMPLATES,
      EVENT_ENGINE_TEMPLATE_HEADERS
    );

  return getEventEngineRows(sheet)
    .map(function(row) {
      return {
        id: row["ID"],
        name: row["Name"],
        description: row["Description"],
        eventType: row["Event Type"],
        version: row["Version"],
        active: getEventEngineBoolean(row["Active"]),
        rules: row["Rules"],
        scoringModel: row["Scoring Model"],
        standingsModel: row["Standings Model"],
        roundModel: row["Round Model"],
        automation: row["Automation"],
        discord: row["Discord"],
        achievements: row["Achievements"],
        registration: row["Registration"],
        permissions: row["Permissions"],
        defaultTimeline: row["Default Timeline"],
        defaultNotifications: row["Default Notifications"],
        createdAt: row["Created At"],
        updatedAt: row["Updated At"]
      };
    });

}

function getEventSeasonObjects() {

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_SEASONS,
      EVENT_ENGINE_SEASON_HEADERS
    );

  return getEventEngineRows(sheet)
    .map(function(row) {
      return {
        id: row["ID"],
        eventId: row["Event ID"],
        name: row["Name"],
        number: Number(row["Number"]) || 0,
        startDate: row["Start Date"],
        endDate: row["End Date"],
        status: row["Status"],
        lifecycleStage: row["Lifecycle Stage"],
        rules: row["Rules"],
        automation: row["Automation"],
        createdAt: row["Created At"],
        updatedAt: row["Updated At"]
      };
    });

}

function getEventRoundObjects() {

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_ROUNDS,
      EVENT_ENGINE_ROUND_HEADERS
    );

  return getEventEngineRows(sheet)
    .map(function(row) {
      return {
        id: row["ID"],
        eventId: row["Event ID"],
        seasonId: row["Season ID"],
        name: row["Name"],
        number: Number(row["Number"]) || 0,
        type: row["Type"],
        startDate: row["Start Date"],
        endDate: row["End Date"],
        status: row["Status"],
        games: row["Games"],
        automation: row["Automation"],
        createdAt: row["Created At"],
        updatedAt: row["Updated At"]
      };
    });

}

function buildEventMigrationAudit() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  const requiredSheets = [
    CONFIG.SHEETS.EVENTS,
    CONFIG.SHEETS.EVENT_TEMPLATES,
    CONFIG.SHEETS.EVENT_PARTICIPANTS,
    CONFIG.SHEETS.EVENT_SEASONS,
    CONFIG.SHEETS.EVENT_ROUNDS
  ];

  const sheetStatus =
    requiredSheets.map(function(name) {
      const sheet =
        spreadsheet.getSheetByName(name);

      return {
        sheet: name,
        exists: !!sheet,
        rows:
          sheet
            ? Math.max(0, sheet.getLastRow() - 1)
            : 0
      };
    });

  const engineSheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.ENGINE);

  const engineHeaders =
    engineSheet
      ? engineSheet
          .getRange(1, 1, 1, engineSheet.getLastColumn())
          .getValues()[0]
          .map(getEventEngineString)
      : [];

  const missingGameScopeColumns =
    [
      "Event ID",
      "Season ID",
      "Round ID"
    ].filter(function(header) {
      return engineHeaders.indexOf(header) === -1;
    });

  return {
    checkedAt: getEventEngineTimestamp(),
    requiredSheets: sheetStatus,
    defaultEventExists:
      !!getEventByIdNoEnsure(EVENT_ENGINE_DEFAULT_EVENT_ID),
    gameEngineRows:
      engineSheet
        ? Math.max(0, engineSheet.getLastRow() - 1)
        : 0,
    missingGameScopeColumns: missingGameScopeColumns,
    automaticMigration: false,
    compatibility:
      "Missing eventId, seasonId, and roundId resolve to Current League until a future migration is explicitly run."
  };

}

function buildEventMigrationPreview() {

  const audit =
    buildEventMigrationAudit();

  return {
    generatedAt: getEventEngineTimestamp(),
    automaticMigration: false,
    plannedChanges: [
      "Create Events, Event Templates, Event Participants, Event Seasons, and Event Rounds sheets if missing.",
      "Seed Current League as the backward-compatible default Event.",
      "Seed Current League Season and Current League Round defaults.",
      "Map active Players sheet rows to Event Participants for Current League.",
      "In a future migration, add Event ID, Season ID, and Round ID columns to historical game rows."
    ],
    rowsAffectedNow: 0,
    futureGameRowsToScope: audit.gameEngineRows,
    missingGameScopeColumns: audit.missingGameScopeColumns,
    rollback:
      buildEventMigrationRollback()
  };

}

function buildEventMigrationReport() {

  const engine =
    ensureEventEngine();

  return {
    generatedAt: getEventEngineTimestamp(),
    community: getEventEngineCommunity(),
    series: getEventEngineDefaultSeries(),
    defaultEvent: getCurrentLeagueEvent(),
    counts: {
      events: engine.events.length,
      templates: engine.templates.length,
      seasons: engine.seasons.length,
      rounds: engine.rounds.length,
      participants: getEventParticipantCount(EVENT_ENGINE_DEFAULT_EVENT_ID)
    },
    migrationStatus:
      "Foundation installed. Legacy game data has not been migrated.",
    backwardCompatibility:
      "Existing APIs continue to operate against legacy data. Missing event scope resolves to Current League."
  };

}

function buildEventMigrationRollback() {

  return {
    automaticRollbackRequired: false,
    reason:
      "Version 3.0B does not mutate historical game, standings, achievement, identity, or Hall of Fame records.",
    rollbackSteps: [
      "Leave existing legacy APIs untouched.",
      "If necessary, disable new Event Engine API routes.",
      "Optional manual cleanup may remove Event Engine foundation sheets after confirming no future Version 3 work depends on them.",
      "No historical league data restoration is required because production data is not migrated in 3.0B."
    ]
  };

}

function ensureEventEngineSheet(name, headers) {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(name);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(name);

  const headerRange =
    sheet.getRange(1, 1, 1, headers.length);

  const currentHeaders =
    headerRange
      .getValues()[0]
      .map(getEventEngineString);

  const matches =
    headers.every(function(header, index) {
      return currentHeaders[index] === header;
    });

  if (!matches)
    headerRange.setValues([headers]);

  return sheet;

}

function upsertEventEngineRow(sheet, headers, keyHeader, keyValue, row) {

  const keyColumn =
    headers.indexOf(keyHeader);

  if (keyColumn === -1)
    return;

  const values =
    sheet
      .getDataRange()
      .getValues();

  let rowNumber = -1;

  for (let index = 1; index < values.length; index++) {
    if (getEventEngineString(values[index][keyColumn]) === keyValue) {
      rowNumber = index + 1;
      break;
    }
  }

  if (rowNumber === -1)
    sheet.appendRow(row);

}

function upsertEventEngineCompositeRow(sheet, headers, keyHeaders, keyValues, row) {

  const keyColumns =
    keyHeaders.map(function(header) {
      return headers.indexOf(header);
    });

  if (
    keyColumns.filter(function(column) {
      return column === -1;
    }).length > 0
  )
    return;

  const values =
    sheet
      .getDataRange()
      .getValues();

  let rowNumber = -1;

  for (let index = 1; index < values.length; index++) {
    const matches =
      keyColumns.every(function(column, keyIndex) {
        return getEventEngineString(values[index][column]) === keyValues[keyIndex];
      });

    if (matches) {
      rowNumber = index + 1;
      break;
    }
  }

  if (rowNumber === -1)
    sheet.appendRow(row);

}

function getEventEngineRows(sheet) {

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  const headers =
    values[0].map(getEventEngineString);

  return values
    .slice(1)
    .map(function(row) {
      const record = {};

      headers.forEach(function(header, index) {
        record[header] =
          getEventEngineString(row[index]);
      });

      return record;
    })
    .filter(function(record) {
      return record[headers[0]] !== "";
    });

}

function getEventParticipantCount(eventId) {

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_PARTICIPANTS,
      EVENT_ENGINE_PARTICIPANT_HEADERS
    );

  return getEventEngineRows(sheet)
    .filter(function(row) {
      return row["Event ID"] === eventId;
    }).length;

}

function getEventByIdNoEnsure(eventId) {

  const spreadsheet =
    SpreadsheetApp.getActive();

  const sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.EVENTS);

  if (!sheet)
    return null;

  return getEventEngineRows(sheet)
    .filter(function(row) {
      return row["ID"] === eventId;
    })[0] || null;

}

function getEventEngineCommunity() {

  return {
    id: EVENT_ENGINE_COMMUNITY_ID,
    name: EVENT_ENGINE_COMMUNITY_NAME
  };

}

function getEventEngineDefaultSeries() {

  return {
    id: EVENT_ENGINE_DEFAULT_SERIES_ID,
    communityId: EVENT_ENGINE_COMMUNITY_ID,
    name: EVENT_ENGINE_DEFAULT_SERIES_NAME,
    description: "Backward-compatible series containing the current Lobo Infinity League event."
  };

}

function getEventEngineSettings() {

  try {
    if (typeof getSettingsObject === "function")
      return getSettingsObject();

    return JSON.parse(getSettings().getContent()).settings || {};
  }
  catch (err) {
    return {};
  }

}

function getEventEnginePlayerRows() {

  if (typeof getOperationsLeagueIdentityRows === "function")
    return getOperationsLeagueIdentityRows();

  return [];

}

function getEventEngineParams(e) {

  if (
    e &&
    e.parameter
  )
    return e.parameter;

  return {};

}

function getEventEngineTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getEventEngineBoolean(value) {

  const text =
    getEventEngineString(value)
      .toLowerCase();

  return (
    value === true ||
    text === "true" ||
    text === "yes" ||
    text === "1"
  );

}

function getEventEngineString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
