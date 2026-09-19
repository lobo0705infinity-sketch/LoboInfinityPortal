/*******************************************************
 * Prepared public Army workspace projections.
 *******************************************************/

const PUBLIC_ARMY_LISTS_PROJECTION_FILE_PROPERTY = "PUBLIC_ARMY_LISTS_PROJECTION_FILE_ID";
const PUBLIC_ARMY_INTELLIGENCE_SUMMARY_FILE_PROPERTY = "PUBLIC_ARMY_INTELLIGENCE_SUMMARY_FILE_ID";
const PUBLIC_ARMY_INTELLIGENCE_DETAIL_FILE_PROPERTY = "PUBLIC_ARMY_INTELLIGENCE_DETAIL_FILE_ID";
const PUBLIC_ARMY_WORKSPACE_DIRTY_PROPERTY = "PUBLIC_ARMY_WORKSPACE_PROJECTION_DIRTY";

function refreshPublicArmyWorkspaceProjection(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    const section = getApiParameter(getApiParameters(e), "section") || "armyLists";
    const result = publishPublicArmyWorkspaceProjectionSection_(section);
    return jsonOutput({
      success: true,
      section: section,
      generatedAt: result.generatedAt,
      fileIds: getPublicArmyWorkspaceProjectionFileIds_()
    });
  });
}

function markPublicArmyWorkspaceProjectionDirty_(sections) {
  try {
    const requested = Array.isArray(sections) && sections.length
      ? sections
      : ["armyLists", "intelligence"];
    markPublicProjectionRequired_(PUBLIC_ARMY_WORKSPACE_DIRTY_PROPERTY, requested);
  }
  catch (error) {
    console.error("PUBLIC_ARMY_WORKSPACE_DIRTY_MARK_FAILED " + String(error));
  }
}

function publishDirtyPublicArmyWorkspaceProjectionBestEffort_() {
  const obligation = getNextPublicProjectionObligation_(PUBLIC_ARMY_WORKSPACE_DIRTY_PROPERTY);
  if (!obligation) return { refreshed: false, success: true };
  try {
    beginPublicProjectionAttempt_(PUBLIC_ARMY_WORKSPACE_DIRTY_PROPERTY, obligation);
    const result = publishPublicArmyWorkspaceProjectionSection_(obligation.key, obligation.requiredGeneration);
    const acknowledgement = acknowledgePublicProjection_(PUBLIC_ARMY_WORKSPACE_DIRTY_PROPERTY, obligation, result);
    return { acknowledgement: acknowledgement, refreshed: true, generatedAt: result.generatedAt, section: obligation.key, remaining: countPendingPublicProjectionObligations_(PUBLIC_ARMY_WORKSPACE_DIRTY_PROPERTY), success: true };
  }
  catch (error) {
    failPublicProjectionAttempt_(PUBLIC_ARMY_WORKSPACE_DIRTY_PROPERTY, obligation, "publication", error);
    console.error("PUBLIC_ARMY_WORKSPACE_REFRESH_FAILED " + String(error));
    return { refreshed: false, success: false, error: String(error && error.message || error) };
  }
}

function publishPublicArmyWorkspaceProjectionSection_(section, generation) {
  if (section === "armyLists") return publishPublicArmyListsProjection_(generation);
  if (section === "intelligence") return publishPublicArmyIntelligenceProjections_(generation);
  throw new Error("Invalid public Army workspace projection section.");
}

function publishPublicArmyListsProjection_(generation) {
  const parse = function(output) { return JSON.parse(output.getContent()); };
  const generatedAt = new Date().toISOString();
  let artifact = {
    schemaVersion: 1,
    generatedAt: generatedAt,
    games: parse(getRecentGames({ parameter: {} })),
    casualGames: parse(getRecentGames({ parameter: { gameType: "casual" } })),
    tournamentGames: parse(getRecentGames({ parameter: { gameType: "tournament" } })),
    events: parse(getEvents({ parameter: {} }))
  };
  const file = getOrCreatePublicArmyProjectionFile_(
    PUBLIC_ARMY_LISTS_PROJECTION_FILE_PROPERTY,
    "Lobo Infinity Portal - Public Army Lists Projection.json"
  );
  artifact = writeAndValidatePublicProjectionArtifact_(file, artifact, generation);
  file.setDescription("Prepared public Army Lists inputs. Canonical data remains in Apps Script and the Game Engine.");
  return artifact;
}

function publishPublicArmyIntelligenceProjections_(generation) {
  const readModel = readArmyIntelligenceReadModelPayload();
  if (!readModel) throw new Error("Army Intelligence read model is unavailable.");
  const generatedAt = new Date().toISOString();
  const summary = buildArmyIntelligencePublicSummaryProjection(readModel);
  const details = {};
  summary.options.forEach(function(option) {
    details[option] = buildArmyIntelligencePublicFactionProjection(readModel, option);
  });
  let detailArtifact = { schemaVersion: 1, generatedAt: generatedAt, details: details };
  let summaryArtifact = { schemaVersion: 1, generatedAt: generatedAt, projection: summary };
  const detailFile = getOrCreatePublicArmyProjectionFile_(
    PUBLIC_ARMY_INTELLIGENCE_DETAIL_FILE_PROPERTY,
    "Lobo Infinity Portal - Public Army Intelligence Detail.json"
  );
  const summaryFile = getOrCreatePublicArmyProjectionFile_(
    PUBLIC_ARMY_INTELLIGENCE_SUMMARY_FILE_PROPERTY,
    "Lobo Infinity Portal - Public Army Intelligence Summary.json"
  );
  detailArtifact = writeAndValidatePublicProjectionArtifact_(detailFile, detailArtifact, generation);
  summaryArtifact = writeAndValidatePublicProjectionArtifact_(summaryFile, summaryArtifact, generation);
  detailFile.setDescription("Prepared public Army Intelligence detail. No decoding occurs during public reads.");
  summaryFile.setDescription("Prepared public Army Intelligence summary. No detailed model is read during public navigation.");
  return summaryArtifact;
}

function getOrCreatePublicArmyProjectionFile_(propertyName, fileName) {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty(propertyName);
  if (id) {
    try { return DriveApp.getFileById(id); }
    catch (error) { properties.deleteProperty(propertyName); }
  }
  const file = DriveApp.createFile(fileName, "{}", MimeType.PLAIN_TEXT);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  properties.setProperty(propertyName, file.getId());
  return file;
}

function getPublicArmyWorkspaceProjectionFileIds_() {
  const properties = PropertiesService.getScriptProperties();
  return {
    armyLists: properties.getProperty(PUBLIC_ARMY_LISTS_PROJECTION_FILE_PROPERTY) || "",
    intelligenceSummary: properties.getProperty(PUBLIC_ARMY_INTELLIGENCE_SUMMARY_FILE_PROPERTY) || "",
    intelligenceDetail: properties.getProperty(PUBLIC_ARMY_INTELLIGENCE_DETAIL_FILE_PROPERTY) || ""
  };
}
