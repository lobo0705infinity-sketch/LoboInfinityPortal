/*******************************************************
 * Prepared public community Players projection.
 *******************************************************/

const PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY =
  "PUBLIC_PLAYERS_PROJECTION_FILE_ID";
const PUBLIC_PLAYERS_PROJECTION_FILE_NAME =
  "Lobo Infinity Portal - Public Players Projection.json";
const PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY =
  "PUBLIC_PLAYERS_PROJECTION_DIRTY";

function refreshPublicPlayersProjection(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    const projection = publishPublicPlayersProjection_();
    return jsonOutput({
      success: true,
      generatedAt: projection.generatedAt,
      playerCount: countPublicPlayersProjectionRows_(projection),
      fileId: getPublicPlayersProjectionFileId_()
    });
  });
}

function markPublicPlayersProjectionDirty_() {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY,
      "true"
    );
  }
  catch (error) {
    console.error("PUBLIC_PLAYERS_DIRTY_MARK_FAILED " + String(error));
  }
}

function publishDirtyPublicPlayersProjectionBestEffort_() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty(PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY))
    return { refreshed: false, success: true };

  try {
    const projection = publishPublicPlayersProjection_();
    properties.deleteProperty(PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY);
    return {
      refreshed: true,
      generatedAt: projection.generatedAt,
      success: true
    };
  }
  catch (error) {
    console.error(
      "PUBLIC_PLAYERS_PROJECTION_REFRESH_FAILED " +
      JSON.stringify({
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

function publishPublicPlayersProjection_() {
  const projection = buildPublicPlayersProjection_();
  validatePublicPlayersProjection_(projection);
  const file = getOrCreatePublicPlayersProjectionFile_();
  file.setContent(JSON.stringify(projection));
  file.setDescription(
    "Prepared public community Players projection. Canonical data remains in the Lobo Apps Script project."
  );
  return projection;
}

function buildPublicPlayersProjection_() {
  const response = JSON.parse(getPlayers({ parameter: {} }).getContent());
  if (!response.success || !Array.isArray(response.divisions))
    throw new Error("Public Players projection could not be built.");

  response.divisions.forEach(function(division) {
    (division.standings || []).forEach(stripUnusedPublicPlayerFields_);
    if (division.summary && division.summary.leader)
      stripUnusedPublicPlayerFields_(division.summary.leader);
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    eventId: "",
    divisions: response.divisions
  };
}

function stripUnusedPublicPlayerFields_(player) {
  delete player.gameDerivedFavoriteFaction;
  delete player.armyListDerivedFavoriteFaction;
}

function validatePublicPlayersProjection_(projection) {
  if (!projection || projection.eventId !== "" || !Array.isArray(projection.divisions))
    throw new Error("Public Players projection is invalid.");

  projection.divisions.forEach(function(division) {
    if (!Array.isArray(division.standings) || !division.summary)
      throw new Error("Public Players division projection is invalid.");
    division.standings.forEach(function(player) {
      if (!player.player || !player.displayName || !Number.isFinite(Number(player.rank)))
        throw new Error("Public Players identity/rank projection is invalid.");
      ["games", "wins", "losses", "tp", "op", "vp"].forEach(function(field) {
        if (!Number.isFinite(Number(player[field])))
          throw new Error("Public Players statistics projection is invalid.");
      });
    });
  });
}

function countPublicPlayersProjectionRows_(projection) {
  return projection.divisions.reduce(function(total, division) {
    return total + division.standings.length;
  }, 0);
}

function getOrCreatePublicPlayersProjectionFile_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY);
  if (existingId) {
    try {
      return DriveApp.getFileById(existingId);
    }
    catch (error) {
      properties.deleteProperty(PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY);
    }
  }

  const file = DriveApp.createFile(
    PUBLIC_PLAYERS_PROJECTION_FILE_NAME,
    "{}",
    MimeType.PLAIN_TEXT
  );
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  properties.setProperty(PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY, file.getId());
  return file;
}

function getPublicPlayersProjectionFileId_() {
  return PropertiesService.getScriptProperties().getProperty(
    PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY
  ) || "";
}
