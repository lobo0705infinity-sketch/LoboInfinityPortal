/*******************************************************
 * Prepared public Team Tournament projection.
 *
 * Canonical Team Tournament calculations remain authoritative.
 * The automation worker publishes an anonymous, public-safe
 * result for Vercel to serve without a browser Apps Script read.
 *******************************************************/

const PUBLIC_TEAM_TOURNAMENT_EVENT_ID =
  "event-august-2026-team-tournament";
const PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_PROPERTY =
  "PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_ID";
const PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_NAME =
  "Lobo Infinity Portal - Team Tournament Public Projection.json";
const PUBLIC_TEAM_TOURNAMENT_DIRTY_PROPERTY =
  "PUBLIC_TEAM_TOURNAMENT_PROJECTION_DIRTY";

function refreshPublicTeamTournamentProjection(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    const projection = publishPublicTeamTournamentProjection_();
    return jsonOutput({
      success: true,
      eventId: projection.eventId,
      generatedAt: projection.generatedAt,
      fileId: getPublicTeamTournamentProjectionFileId_()
    });
  });
}

function markPublicTeamTournamentProjectionDirty_(eventId) {
  if (String(eventId || "") !== PUBLIC_TEAM_TOURNAMENT_EVENT_ID)
    return;

  try {
    PropertiesService.getScriptProperties().setProperty(
      PUBLIC_TEAM_TOURNAMENT_DIRTY_PROPERTY,
      PUBLIC_TEAM_TOURNAMENT_EVENT_ID
    );
  }
  catch (error) {
    console.error("PUBLIC_TEAM_TOURNAMENT_DIRTY_MARK_FAILED " + String(error));
  }
}

function publishDirtyPublicTeamTournamentProjectionBestEffort_() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty(PUBLIC_TEAM_TOURNAMENT_DIRTY_PROPERTY))
    return { refreshed: false, success: true };

  try {
    const projection = publishPublicTeamTournamentProjection_();
    properties.deleteProperty(PUBLIC_TEAM_TOURNAMENT_DIRTY_PROPERTY);
    return {
      refreshed: true,
      generatedAt: projection.generatedAt,
      success: true
    };
  }
  catch (error) {
    console.error(
      "PUBLIC_TEAM_TOURNAMENT_PROJECTION_REFRESH_FAILED " +
      JSON.stringify({
        eventId: PUBLIC_TEAM_TOURNAMENT_EVENT_ID,
        message: error && error.message ? String(error.message) : String(error)
      })
    );
    return {
      error: error && error.message ? String(error.message) : String(error),
      refreshed: false,
      success: false
    };
  }
}

function publishPublicTeamTournamentProjection_() {
  const projection = buildPublicTeamTournamentProjection_();
  validatePublicTeamTournamentProjection_(projection);
  const file = getOrCreatePublicTeamTournamentProjectionFile_();
  file.setContent(JSON.stringify(projection));
  file.setDescription(
    "Prepared public Team Tournament projection. Canonical data remains in the Lobo Apps Script project."
  );
  return projection;
}

function buildPublicTeamTournamentProjection_() {
  const response = JSON.parse(
    getTeamTournament({
      parameter: { eventId: PUBLIC_TEAM_TOURNAMENT_EVENT_ID }
    }).getContent()
  );

  if (!response.success || !response.tournament)
    throw new Error("Team Tournament public projection could not be built.");

  const tournament = response.tournament;

  // Request-specific and operational collections are never published.
  tournament.registration.currentPlayer = null;
  tournament.registration.registrations = [];
  tournament.registration.teams = [];
  tournament.registration.freeAgents = [];
  tournament.registration.captains = [];
  tournament.invitations = [];
  tournament.freeAgents = [];
  tournament.resultStatuses = [];

  // Canonical games own private notes/submission metadata and Army Codes.
  [tournament.latestResults, tournament.tournamentResults].forEach(function(results) {
    (results || []).forEach(function(result) {
      delete result.armyCode;
      delete result.armyListId;
      delete result.armyListId1;
      delete result.armyListId2;
      delete result.notes;
      delete result.submittedBy;
    });
  });

  return {
    schemaVersion: 1,
    eventId: PUBLIC_TEAM_TOURNAMENT_EVENT_ID,
    generatedAt: new Date().toISOString(),
    tournament: tournament
  };
}

function validatePublicTeamTournamentProjection_(projection) {
  const tournament = projection && projection.tournament;
  if (
    !projection ||
    projection.eventId !== PUBLIC_TEAM_TOURNAMENT_EVENT_ID ||
    !tournament ||
    !tournament.event ||
    tournament.event.id !== PUBLIC_TEAM_TOURNAMENT_EVENT_ID
  )
    throw new Error("Team Tournament public projection event isolation failed.");

  ["teams", "standings", "pairings", "latestResults"].forEach(function(key) {
    if (!Array.isArray(tournament[key]))
      throw new Error("Team Tournament public projection is missing " + key + ".");
  });
}

function getOrCreatePublicTeamTournamentProjectionFile_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(
    PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_PROPERTY
  );
  if (existingId) {
    try {
      return DriveApp.getFileById(existingId);
    }
    catch (error) {
      properties.deleteProperty(PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_PROPERTY);
    }
  }

  const file = DriveApp.createFile(
    PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_NAME,
    "{}",
    MimeType.PLAIN_TEXT
  );
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  properties.setProperty(
    PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_PROPERTY,
    file.getId()
  );
  return file;
}

function getPublicTeamTournamentProjectionFileId_() {
  return PropertiesService.getScriptProperties().getProperty(
    PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_PROPERTY
  ) || "";
}
