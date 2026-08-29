/*******************************************************
 * Prepared public event projections.
 *
 * Canonical Apps Script mutations publish a complete JSON
 * artifact. Public navigation reads that artifact through
 * Vercel and never opens Sheets during the page request.
 *******************************************************/

const TOP40_PUBLIC_EVENT_ID = "event-lobo-s-american-top-40";
const TOP40_PUBLIC_PROJECTION_FILE_PROPERTY =
  "TOP40_PUBLIC_PROJECTION_FILE_ID";
const TOP40_PUBLIC_PROJECTION_FILE_NAME =
  "Lobo Infinity Portal - Top 40 Public Projection.json";

function refreshTop40PublicProjection(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    const projection = publishTop40PublicProjection_();
    return jsonOutput({
      success: true,
      eventId: projection.eventId,
      generatedAt: projection.generatedAt,
      fileId: getTop40PublicProjectionFileId_()
    });
  });
}

function publishTop40PublicProjectionBestEffort_(eventId) {
  if (typeof markPublicAnalyticsProjectionDirty_ === "function")
    markPublicAnalyticsProjectionDirty_(eventId);
  if (typeof markPublicTeamTournamentProjectionDirty_ === "function")
    markPublicTeamTournamentProjectionDirty_(eventId);

  if (String(eventId || "") !== TOP40_PUBLIC_EVENT_ID)
    return;

  try {
    publishTop40PublicProjection_();
  }
  catch (error) {
    console.error(
      "TOP40_PUBLIC_PROJECTION_REFRESH_FAILED " +
      JSON.stringify({
        eventId: TOP40_PUBLIC_EVENT_ID,
        message: error && error.message ? String(error.message) : String(error)
      })
    );
  }
}

function publishTop40PublicProjection_() {
  const projection = buildTop40PublicProjection_();
  validateTop40PublicProjection_(projection);
  const json = JSON.stringify(projection);
  const file = getOrCreateTop40PublicProjectionFile_();

  // setContent replaces the artifact only after the complete projection
  // has been built and validated, preserving the last known good file on
  // any earlier failure. Canonical callers already hold their own mutation
  // locks where required; the projection must never acquire a nested lock.
  file.setContent(json);
  file.setDescription(
    "Prepared public Top 40 event projection. Canonical data remains in the Lobo Apps Script project."
  );

  return projection;
}

function buildTop40PublicProjection_() {
  const eventHomeResponse = JSON.parse(
    getEventHome({ parameter: { eventId: TOP40_PUBLIC_EVENT_ID } }).getContent()
  );
  const bracketResponse = JSON.parse(
    getEventBracket({ parameter: { eventId: TOP40_PUBLIC_EVENT_ID } }).getContent()
  );

  if (!eventHomeResponse.success || !eventHomeResponse.home)
    throw new Error("Top 40 Event Home projection could not be built.");

  if (!bracketResponse.success || !bracketResponse.bracket)
    throw new Error("Top 40 bracket projection could not be built.");

  const home = eventHomeResponse.home;

  // Explicitly remove request/user-specific fields from the public artifact.
  home.eligibleOpponents = [];
  home.playerStatus = {
    registrationStatus: "Not Registered",
    currentTeam: "",
    captain: false,
    upcomingMatch: "",
    outstandingAction: ""
  };

  return {
    schemaVersion: 1,
    eventId: TOP40_PUBLIC_EVENT_ID,
    generatedAt: new Date().toISOString(),
    home: home,
    bracket: bracketResponse.bracket
  };
}

function validateTop40PublicProjection_(projection) {
  if (!projection || projection.eventId !== TOP40_PUBLIC_EVENT_ID)
    throw new Error("Top 40 public projection event isolation failed.");

  if (
    !projection.home ||
    !projection.home.event ||
    projection.home.event.id !== TOP40_PUBLIC_EVENT_ID
  )
    throw new Error("Top 40 public Event Home projection is invalid.");

  if (!projection.bracket || projection.bracket.eventId !== TOP40_PUBLIC_EVENT_ID)
    throw new Error("Top 40 public bracket projection is invalid.");
}

function getOrCreateTop40PublicProjectionFile_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(
    TOP40_PUBLIC_PROJECTION_FILE_PROPERTY
  );

  if (existingId) {
    try {
      return DriveApp.getFileById(existingId);
    }
    catch (error) {
      properties.deleteProperty(TOP40_PUBLIC_PROJECTION_FILE_PROPERTY);
    }
  }

  const file = DriveApp.createFile(
    TOP40_PUBLIC_PROJECTION_FILE_NAME,
    "{}",
    MimeType.PLAIN_TEXT
  );
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  properties.setProperty(TOP40_PUBLIC_PROJECTION_FILE_PROPERTY, file.getId());
  return file;
}

function getTop40PublicProjectionFileId_() {
  return PropertiesService.getScriptProperties().getProperty(
    TOP40_PUBLIC_PROJECTION_FILE_PROPERTY
  ) || "";
}
