/*******************************************************
 * Prepared public League workspace projection.
 *******************************************************/

const PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_PROPERTY =
  "PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_ID";
const PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_NAME =
  "Lobo Infinity Portal - Public League Workspace Projection.json";
const PUBLIC_LEAGUE_WORKSPACE_PROJECTION_DIRTY_PROPERTY =
  "PUBLIC_LEAGUE_WORKSPACE_PROJECTION_DIRTY";

function refreshPublicLeagueWorkspaceProjection(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    const parameters = getApiParameters(e);
    const section = getApiParameter(parameters, "section") || "dashboard";
    const projection = publishPublicLeagueWorkspaceProjectionSection_(section);
    return jsonOutput({
      success: true,
      generatedAt: projection.generatedAt,
      section: section,
      fileId: getPublicLeagueWorkspaceProjectionFileId_()
    });
  });
}

function markPublicLeagueWorkspaceProjectionDirty_() {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PUBLIC_LEAGUE_WORKSPACE_PROJECTION_DIRTY_PROPERTY,
      JSON.stringify(["dashboard", "factions", "missions", "hallOfFame", "leagueOperations"])
    );
  }
  catch (error) {
    console.error("PUBLIC_LEAGUE_WORKSPACE_DIRTY_MARK_FAILED " + String(error));
  }
}

function publishDirtyPublicLeagueWorkspaceProjectionBestEffort_() {
  const properties = PropertiesService.getScriptProperties();
  const dirty = JSON.parse(
    properties.getProperty(PUBLIC_LEAGUE_WORKSPACE_PROJECTION_DIRTY_PROPERTY) || "[]"
  );
  if (!dirty.length)
    return { refreshed: false, success: true };

  try {
    const section = dirty.shift();
    const projection = publishPublicLeagueWorkspaceProjectionSection_(section);
    if (dirty.length)
      properties.setProperty(PUBLIC_LEAGUE_WORKSPACE_PROJECTION_DIRTY_PROPERTY, JSON.stringify(dirty));
    else
      properties.deleteProperty(PUBLIC_LEAGUE_WORKSPACE_PROJECTION_DIRTY_PROPERTY);
    return { refreshed: true, generatedAt: projection.generatedAt, section: section, remaining: dirty.length, success: true };
  }
  catch (error) {
    console.error("PUBLIC_LEAGUE_WORKSPACE_PROJECTION_REFRESH_FAILED " + String(error));
    return { refreshed: false, success: false, error: String(error && error.message || error) };
  }
}

function publishPublicLeagueWorkspaceProjection_() {
  const projection = buildPublicLeagueWorkspaceProjection_();
  validatePublicLeagueWorkspaceProjection_(projection);
  const file = getOrCreatePublicLeagueWorkspaceProjectionFile_();
  file.setContent(JSON.stringify(projection));
  file.setDescription(
    "Prepared public League workspace projection. Canonical data remains in the Lobo Apps Script project."
  );
  return projection;
}

function publishPublicLeagueWorkspaceProjectionSection_(section) {
  const allowed = ["dashboard", "factions", "missions", "hallOfFame", "leagueOperations"];
  if (allowed.indexOf(section) === -1)
    throw new Error("Invalid public League workspace projection section.");

  const file = getOrCreatePublicLeagueWorkspaceProjectionFile_();
  let projection = {};
  try { projection = JSON.parse(file.getBlob().getDataAsString() || "{}"); }
  catch (error) { projection = {}; }
  projection.schemaVersion = 1;
  projection.generatedAt = new Date().toISOString();

  const parse = function(output) {
    const value = JSON.parse(output.getContent());
    delete value.pipelineDiagnostics;
    return value;
  };
  if (section === "factions") projection.factions = parse(getFactions({ parameter: {} }));
  if (section === "leagueOperations") projection.leagueOperations = parse(getLeagueOperations());
  if (section === "hallOfFame") projection.hallOfFame = parse(getHallOfFame({ parameter: {} }));
  if (section === "missions") {
    projection.missions = {};
    [["current-league", "event-current-league", "league"], ["tournament", "event-august-2026-team-tournament", "tournament"], ["casual", "", "casual"], ["all", "", "all"]].forEach(function(scope) {
      projection.missions[scope[0]] = parse(getMissions({ parameter: { eventId: scope[1], gameType: scope[2] } }));
    });
  }
  if (section === "dashboard") {
    const factions = projection.factions || parse(getFactions({ parameter: {} }));
    const operations = projection.leagueOperations || parse(getLeagueOperations());
    projection.dashboard = buildPublicLeagueDashboardProjection_(factions, operations);
    projection.factions = projection.factions || factions;
    projection.leagueOperations = projection.leagueOperations || operations;
  }
  file.setContent(JSON.stringify(projection));
  file.setDescription("Prepared public League workspace projection. Canonical data remains in the Lobo Apps Script project.");
  return projection;
}

function buildPublicLeagueWorkspaceProjection_() {
  const leagueEventId = "event-current-league";
  const parse = function(output) {
    const value = JSON.parse(output.getContent());
    delete value.pipelineDiagnostics;
    return value;
  };
  const factions = parse(getFactions({ parameter: {} }));
  const leagueOperations = parse(getLeagueOperations());
  const missions = {};
  [
    ["current-league", leagueEventId, "league"],
    ["tournament", "event-august-2026-team-tournament", "tournament"],
    ["casual", "", "casual"],
    ["all", "", "all"]
  ].forEach(function(scope) {
    missions[scope[0]] = parse(getMissions({ parameter: {
      eventId: scope[1],
      gameType: scope[2]
    }}));
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dashboard: buildPublicLeagueDashboardProjection_(factions, leagueOperations),
    factions: factions,
    missions: missions,
    hallOfFame: parse(getHallOfFame({ parameter: {} })),
    leagueOperations: leagueOperations
  };
}

function buildPublicLeagueDashboardProjection_(factions, leagueOperations) {
  const playersFileId = getPublicPlayersProjectionFileId_();
  if (!playersFileId)
    throw new Error("Public Players projection is required for the League Dashboard projection.");

  const playersProjection = JSON.parse(
    DriveApp.getFileById(playersFileId).getBlob().getDataAsString()
  );
  const divisions = (playersProjection.divisions || []).filter(function(division) {
    return ["main", "pga", "pgb"].indexOf(division.division) !== -1;
  });
  const main = divisions.filter(function(division) {
    return division.division === "main";
  })[0];
  if (!main || !main.summary)
    throw new Error("Public Players projection does not contain Main Man standings.");

  const leader = main.summary.leader || {};
  return {
    success: true,
    leader: leader,
    topFaction: factions.factions.length ? factions.factions[0].name : "",
    gamesPlayed: Number(main.summary.gamesPlayed) || 0,
    activePlayers: Number(main.summary.activePlayers) || 0,
    mainManStandings: main.standings || [],
    leagueOverview: {
      divisions: divisions.map(function(division) {
        return {
          division: division.division,
          divisionLabel: division.divisionLabel,
          players: Number(division.summary.players) || 0,
          gamesPlayed: Number(division.summary.gamesPlayed) || 0,
          activePlayers: Number(division.summary.activePlayers) || 0
        };
      }),
      totalLeagueGames: divisions.reduce(function(total, division) {
        return total + (Number(division.summary.gamesPlayed) || 0);
      }, 0),
      totalActivePlayers: divisions.reduce(function(total, division) {
        return total + (Number(division.summary.players) || 0);
      }, 0)
    },
    currentOperationsMissions: (leagueOperations.operations.missions || [])
      .slice(0, 2)
      .map(function(operation) { return operation.mission; })
      .filter(function(mission) { return mission !== ""; })
  };
}

function validatePublicLeagueWorkspaceProjection_(projection) {
  if (!projection || !projection.generatedAt || !projection.dashboard ||
      !Array.isArray(projection.factions && projection.factions.factions) ||
      !projection.missions || !projection.hallOfFame ||
      !projection.leagueOperations || !projection.leagueOperations.operations)
    throw new Error("Public League workspace projection is invalid.");

  ["current-league", "tournament", "casual", "all"].forEach(function(scope) {
    if (!Array.isArray(projection.missions[scope] && projection.missions[scope].missions))
      throw new Error("Public League mission projection is invalid for " + scope + ".");
  });
}

function getOrCreatePublicLeagueWorkspaceProjectionFile_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_PROPERTY);
  if (existingId) {
    try { return DriveApp.getFileById(existingId); }
    catch (error) { properties.deleteProperty(PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_PROPERTY); }
  }
  const file = DriveApp.createFile(
    PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_NAME,
    "{}",
    MimeType.PLAIN_TEXT
  );
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  properties.setProperty(PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_PROPERTY, file.getId());
  return file;
}

function getPublicLeagueWorkspaceProjectionFileId_() {
  return PropertiesService.getScriptProperties().getProperty(
    PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_PROPERTY
  ) || "";
}
