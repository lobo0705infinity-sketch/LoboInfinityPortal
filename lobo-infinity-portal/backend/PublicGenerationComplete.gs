/*******************************************************
 * Hourly public snapshot Phase 2.
 *
 * Builds a complete, isolated candidate from one frozen
 * input. Nothing here promotes or exposes a generation.
 *******************************************************/

const PUBLIC_GENERATION_COMPLETE_SCHEMA_VERSION = 2;
const PUBLIC_GENERATION_COMPLETE_LATEST_BUILD_PROPERTY =
  "PUBLIC_GENERATION_COMPLETE_LATEST_BUILD";
const PUBLIC_GENERATION_COMPLETE_REQUIRED_SOURCES = {
  players: "PUBLIC_PLAYERS_PROJECTION_FILE_ID",
  league: "PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_ID",
  analytics: "PUBLIC_ANALYTICS_PROJECTION_FILE_ID",
  detail: "PUBLIC_DETAIL_PROJECTION_FILE_ID",
  top40: "TOP40_PUBLIC_PROJECTION_FILE_ID",
  teamTournament: "PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_ID"
};
const PUBLIC_GENERATION_COMPLETE_OPTIONAL_SOURCES = {
  armyLists: "PUBLIC_ARMY_LISTS_PROJECTION_FILE_ID",
  armyIntelligenceSummary: "PUBLIC_ARMY_INTELLIGENCE_SUMMARY_FILE_ID",
  armyIntelligenceDetail: "PUBLIC_ARMY_INTELLIGENCE_DETAIL_FILE_ID"
};

function runBuildCompletePublicGenerationCandidate() {
  const result = buildCompletePublicGenerationCandidate_();
  Logger.log("PUBLIC_GENERATION_COMPLETE_CANDIDATE " + JSON.stringify(result));
  return result;
}

function buildCompletePublicGenerationCandidate_() {
  const started = Date.now();
  let record = readActiveCompletePublicGenerationBuild_();
  try {
    if (!record) return startCompletePublicGenerationBuild_(started);
    if (record.buildType !== "complete-public-generation")
      throw new Error("A different public generation build is active: " + record.generation);
    if (record.status === "validated")
      return completePublicGenerationStatus_(record, "validated", started);

    if (record.completedStages.indexOf("required-sections") === -1)
      return buildCompletePublicGenerationRequiredStage_(record, started);
    if (record.completedStages.indexOf("optional-sections") === -1)
      return buildCompletePublicGenerationOptionalStage_(record, started);
    return validateCompletePublicGenerationStage_(record, started);
  }
  catch (error) {
    if (record) record = retainFailedCompletePublicGenerationBuild_(record, error);
    const result = completePublicGenerationStatus_(record || {}, "failed", started);
    result.success = false;
    result.safeToContinue = !!record;
    result.error = String(error && error.message ? error.message : error).slice(0, 500);
    Logger.log("PUBLIC_GENERATION_COMPLETE_CANDIDATE_FAILED " + JSON.stringify(result));
    return result;
  }
}

function startCompletePublicGenerationBuild_(started) {
  const generation = formatPublicGenerationId_(new Date(started));
  const reservation = reservePublicGenerationBuild_(generation, new Date(started));
  let record = reservation.record;
  const storage = createPublicGenerationStorage_(generation);
  record = updatePublicGenerationBuildRecord_(record, {
    buildType: "complete-public-generation",
    schemaVersion: PUBLIC_GENERATION_COMPLETE_SCHEMA_VERSION,
    status: "building",
    storage: storage.references,
    stages: ["frozen-input", "required-sections", "optional-sections", "validation"],
    completedStages: ["reserved"],
    artifacts: {},
    metrics: { lockHoldMs: reservation.lockHoldMs, canonicalReads: 0, driveReads: 0, driveWrites: 2 }
  });

  const frozen = captureCompletePublicGenerationFrozenInput_(generation);
  const canonicalReads = Number(frozen.canonicalReadCount) || 0;
  const driveReads = Number(frozen.driveReadCount) || 0;
  delete frozen.canonicalReadCount;
  delete frozen.driveReadCount;
  const json = stablePublicGenerationJson_(frozen);
  const hash = sha256PublicGenerationText_(json);
  const bytes = utf8PublicGenerationByteCount_(json);
  const file = createImmutablePublicGenerationFile_(storage.internalFolder, "complete-frozen-input.json", json);
  validatePersistedPublicGenerationText_(file, json, hash, bytes);
  record = updatePublicGenerationBuildRecord_(record, {
    sourceCutoff: frozen.sourceCutoff,
    inputHash: hash,
    inputBytes: bytes,
    completedStages: ["reserved", "frozen-input"],
    artifacts: { frozenInput: buildPublicGenerationFileReference_(file, hash, bytes) },
    metrics: Object.assign({}, record.metrics, {
      canonicalReads: canonicalReads,
      driveReads: driveReads + 1,
      driveWrites: record.metrics.driveWrites + 2
    }),
    lastError: ""
  });
  writePublicGenerationBuildRecord_(storage, record);
  return completePublicGenerationStatus_(record, "frozen-input", started);
}

function captureCompletePublicGenerationFrozenInput_(generation) {
  const frozen = capturePublicGenerationFrozenInput_(generation);
  frozen.schemaVersion = PUBLIC_GENERATION_COMPLETE_SCHEMA_VERSION;
  frozen.preparedSources = {};
  let driveReads = 0;
  const properties = PropertiesService.getScriptProperties();
  Object.keys(PUBLIC_GENERATION_COMPLETE_REQUIRED_SOURCES).forEach(function(key) {
    const property = PUBLIC_GENERATION_COMPLETE_REQUIRED_SOURCES[key];
    const id = properties.getProperty(property);
    if (!id) throw new Error("Required prepared source is unavailable: " + key);
    const text = DriveApp.getFileById(id).getBlob().getDataAsString("UTF-8");
    frozen.preparedSources[key] = {
      capturedHash: sha256PublicGenerationText_(text),
      capturedBytes: utf8PublicGenerationByteCount_(text),
      value: parsePublicGenerationJson_(text, null)
    };
    if (!frozen.preparedSources[key].value)
      throw new Error("Required prepared source is invalid: " + key);
    driveReads += 1;
  });
  frozen.optionalSources = {};
  Object.keys(PUBLIC_GENERATION_COMPLETE_OPTIONAL_SOURCES).forEach(function(key) {
    const id = properties.getProperty(PUBLIC_GENERATION_COMPLETE_OPTIONAL_SOURCES[key]);
    if (!id) {
      frozen.optionalSources[key] = { available: false, reason: "source-unavailable" };
      return;
    }
    try {
      const text = DriveApp.getFileById(id).getBlob().getDataAsString("UTF-8");
      frozen.optionalSources[key] = {
        available: true,
        capturedHash: sha256PublicGenerationText_(text),
        capturedBytes: utf8PublicGenerationByteCount_(text),
        value: parsePublicGenerationJson_(text, null)
      };
      if (!frozen.optionalSources[key].value)
        throw new Error("invalid JSON");
      driveReads += 1;
    }
    catch (error) {
      frozen.optionalSources[key] = { available: false, reason: "source-invalid" };
    }
  });
  // The cutoff is recorded only after every source read has completed. Every
  // later stage reads this persisted object and performs no canonical reads.
  frozen.sourceCutoff = new Date().toISOString();
  frozen.driveReadCount = driveReads;
  return frozen;
}

function buildCompletePublicGenerationRequiredStage_(record, started) {
  const context = readCompletePublicGenerationContext_(record);
  const sections = {
    core: buildPublicGenerationCoreSection_(context.frozen),
    games: buildCompletePublicGenerationGames_(context.frozen),
    players: context.frozen.preparedSources.players.value,
    league: context.frozen.preparedSources.league.value,
    analytics: context.frozen.preparedSources.analytics.value,
    detail: context.frozen.preparedSources.detail.value,
    top40: context.frozen.preparedSources.top40.value,
    teamTournament: context.frozen.preparedSources.teamTournament.value
  };
  const artifacts = Object.assign({}, record.artifacts);
  Object.keys(sections).forEach(function(key) {
    artifacts[key] = writeCompletePublicGenerationArtifact_(
      context.candidateFolder, record, key, sections[key], true
    );
  });
  record = updateCompletePublicGenerationRecord_(record, {
    completedStages: record.completedStages.concat(["required-sections"]),
    artifacts: artifacts,
    lastError: ""
  });
  return completePublicGenerationStatus_(record, "required-sections", started);
}

function buildCompletePublicGenerationOptionalStage_(record, started) {
  const context = readCompletePublicGenerationContext_(record);
  const artifacts = Object.assign({}, record.artifacts);
  const optional = {};
  Object.keys(context.frozen.optionalSources || {}).forEach(function(key) {
    const source = context.frozen.optionalSources[key];
    if (!source.available) {
      optional[key] = { available: false, required: false, reason: source.reason || "unavailable" };
      return;
    }
    artifacts[key] = writeCompletePublicGenerationArtifact_(
      context.candidateFolder, record, key, source.value, false
    );
    optional[key] = { available: true, required: false, sourceGeneration: record.generation };
  });
  record = updateCompletePublicGenerationRecord_(record, {
    completedStages: record.completedStages.concat(["optional-sections"]),
    artifacts: artifacts,
    optionalSections: optional,
    lastError: ""
  });
  return completePublicGenerationStatus_(record, "optional-sections", started);
}

function validateCompletePublicGenerationStage_(record, started) {
  const context = readCompletePublicGenerationContext_(record);
  const required = ["core", "games", "players", "league", "analytics", "detail", "top40", "teamTournament"];
  const sections = {};
  required.forEach(function(key) {
    sections[key] = validateCompletePublicGenerationArtifactReference_(record, key, true);
  });
  Object.keys(record.optionalSections || {}).forEach(function(key) {
    if (record.optionalSections[key].available)
      sections[key] = validateCompletePublicGenerationArtifactReference_(record, key, false);
    else sections[key] = record.optionalSections[key];
  });
  validateCompletePublicGenerationSemantics_(record, context.frozen);
  const manifest = {
    schemaVersion: PUBLIC_GENERATION_COMPLETE_SCHEMA_VERSION,
    generation: record.generation,
    sourceCutoff: record.sourceCutoff,
    generatedAt: new Date().toISOString(),
    status: "candidate",
    published: false,
    livePointer: false,
    sections: sections
  };
  const manifestRef = writeCompletePublicGenerationArtifact_(
    context.candidateFolder, record, "manifest", manifest, true, true
  );
  const artifacts = Object.assign({}, record.artifacts, { manifest: manifestRef });
  validatePublicGenerationCandidateIsolation_(Object.keys(artifacts).map(function(key) {
    return artifacts[key] && artifacts[key].fileId;
  }).filter(Boolean));
  record = updateCompletePublicGenerationRecord_(record, {
    status: "validated",
    completedAt: new Date().toISOString(),
    completedStages: record.completedStages.concat(["validation"]),
    artifacts: artifacts,
    lastError: ""
  });
  writePublicGenerationBuildRecord_(context.storage, record);
  completeCompletePublicGenerationBuild_(record);
  return completePublicGenerationStatus_(record, "validation", started);
}

function buildCompletePublicGenerationGames_(frozen) {
  return {
    count: (frozen.games || []).length,
    games: frozen.games || []
  };
}

function writeCompletePublicGenerationArtifact_(folder, record, key, data, required, isManifest) {
  const artifact = isManifest ? data : {
    schemaVersion: PUBLIC_GENERATION_COMPLETE_SCHEMA_VERSION,
    generation: record.generation,
    sourceGeneration: record.generation,
    sourceCutoff: record.sourceCutoff,
    section: key,
    data: data
  };
  assertNoForbiddenPublicGenerationKeys_(artifact, key);
  const json = stablePublicGenerationJson_(artifact);
  const hash = sha256PublicGenerationText_(json);
  const bytes = utf8PublicGenerationByteCount_(json);
  const file = createImmutablePublicGenerationFile_(folder, key + ".json", json);
  validatePersistedPublicGenerationText_(file, json, hash, bytes);
  return {
    fileId: file.getId(),
    artifact: key + ".json",
    contentHash: hash,
    byteCount: bytes,
    sourceGeneration: record.generation,
    required: required === true,
    readBack: true
  };
}

function validateCompletePublicGenerationArtifactReference_(record, key, required) {
  const ref = record.artifacts && record.artifacts[key];
  if (!ref || !ref.fileId || !ref.contentHash || !Number.isFinite(Number(ref.byteCount)))
    throw new Error("Generation artifact reference is invalid: " + key);
  const text = DriveApp.getFileById(ref.fileId).getBlob().getDataAsString("UTF-8");
  if (sha256PublicGenerationText_(text) !== ref.contentHash ||
      utf8PublicGenerationByteCount_(text) !== ref.byteCount)
    throw new Error("Generation artifact read-back failed: " + key);
  const value = parsePublicGenerationJson_(text, null);
  if (!value || value.generation !== record.generation || value.sourceCutoff !== record.sourceCutoff)
    throw new Error("Generation artifact provenance failed: " + key);
  return {
    artifact: ref.artifact,
    fileId: ref.fileId,
    contentHash: ref.contentHash,
    byteCount: ref.byteCount,
    sourceGeneration: ref.sourceGeneration,
    required: required === true
  };
}

function validateCompletePublicGenerationSemantics_(record, frozen) {
  const ids = {};
  (frozen.games || []).forEach(function(game) {
    if (ids[game.gameId]) throw new Error("Duplicate canonical Game ID in frozen input: " + game.gameId);
    ids[game.gameId] = true;
  });
  const game73 = (frozen.games || []).filter(function(game) { return Number(game.gameId) === 73; })[0];
  if (!game73 || game73.player1 !== "Lobo" || game73.player2 !== "Nighthawkmk2" ||
      game73.mission !== "Dead Man's Switch" || Number(game73.player1Tp) !== 5 ||
      Number(game73.player2Tp) !== 0 || Number(game73.player1Op) !== 8 ||
      Number(game73.player2Op) !== 1 || Number(game73.player1Vp) !== 262 ||
      Number(game73.player2Vp) !== 122)
    throw new Error("Game 73 semantic fixture failed.");
  ["players", "league", "analytics", "detail", "top40", "teamTournament"].forEach(function(key) {
    const source = frozen.preparedSources[key];
    if (!source || !source.value) throw new Error("Required frozen public source is missing: " + key);
  });
  const league = frozen.preparedSources.league.value;
  const divisions = league && league.dashboard && league.dashboard.divisionStandings;
  if (!Array.isArray(divisions) || divisions.length !== 3)
    throw new Error("Three-division League semantic validation failed.");
  const playersText = stablePublicGenerationJson_(frozen.preparedSources.players.value);
  const analyticsText = stablePublicGenerationJson_(frozen.preparedSources.analytics.value);
  const leagueText = stablePublicGenerationJson_(league);
  const detailText = stablePublicGenerationJson_(frozen.preparedSources.detail.value);
  ["Lobo", "Nighthawkmk2"].forEach(function(name) {
    if (playersText.indexOf(name) === -1 || leagueText.indexOf(name) === -1 ||
        detailText.indexOf(name) === -1)
      throw new Error("Game 73 player cross-reference is missing: " + name);
  });
  ["Corregidor Jurisdictional Command", "Shindenbutai", "Dead Man's Switch"].forEach(function(value) {
    if (analyticsText.indexOf(value) === -1 || detailText.indexOf(value) === -1)
      throw new Error("Game 73 analytics/profile cross-reference is missing: " + value);
  });
  if (detailText.indexOf('"id":73') === -1 && detailText.indexOf('"gameId":73') === -1)
    throw new Error("Game 73 public detail cross-reference is missing.");
  assertNoForbiddenPublicGenerationKeys_(frozen.preparedSources.players.value, "players");
  assertNoForbiddenPublicGenerationKeys_(frozen.preparedSources.detail.value, "detail");
}

function readCompletePublicGenerationContext_(record) {
  const storage = {
    internalFolder: DriveApp.getFolderById(record.storage.internalFolderId),
    candidateFolder: DriveApp.getFolderById(record.storage.candidateFolderId)
  };
  const text = DriveApp.getFileById(record.artifacts.frozenInput.fileId).getBlob().getDataAsString("UTF-8");
  if (sha256PublicGenerationText_(text) !== record.inputHash)
    throw new Error("Frozen complete-generation input hash changed.");
  const frozen = parsePublicGenerationJson_(text, null);
  if (!frozen || frozen.generation !== record.generation || frozen.sourceCutoff !== record.sourceCutoff)
    throw new Error("Frozen complete-generation input provenance is invalid.");
  return { storage: storage, internalFolder: storage.internalFolder, candidateFolder: storage.candidateFolder, frozen: frozen };
}

function readActiveCompletePublicGenerationBuild_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY);
  return raw ? parsePublicGenerationJson_(raw, null) : null;
}

function updateCompletePublicGenerationRecord_(record, updates) {
  const next = updatePublicGenerationBuildRecord_(record, updates);
  const context = {
    internalFolder: DriveApp.getFolderById(next.storage.internalFolderId),
    candidateFolder: DriveApp.getFolderById(next.storage.candidateFolderId)
  };
  writePublicGenerationBuildRecord_(context, next);
  return next;
}

function retainFailedCompletePublicGenerationBuild_(record, error) {
  return updateCompletePublicGenerationRecord_(record, {
    status: "building",
    lastError: String(error && error.message ? error.message : error).slice(0, 500),
    lastAttemptAt: new Date().toISOString()
  });
}

function completeCompletePublicGenerationBuild_(record) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("Complete generation completion lock is busy.");
  try {
    const properties = PropertiesService.getScriptProperties();
    const active = parsePublicGenerationJson_(properties.getProperty(PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY), {});
    if (!active || active.generation !== record.generation)
      throw new Error("Complete generation active build changed before completion.");
    properties.setProperty(PUBLIC_GENERATION_COMPLETE_LATEST_BUILD_PROPERTY, JSON.stringify(record));
    properties.deleteProperty(PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY);
  }
  finally { lock.releaseLock(); }
}

function completePublicGenerationStatus_(record, stage, started) {
  const completed = record.completedStages || [];
  const stages = record.stages || ["frozen-input", "required-sections", "optional-sections", "validation"];
  const remaining = stages.filter(function(value) { return completed.indexOf(value) === -1; });
  return {
    success: record.status !== "failed",
    generation: record.generation || "",
    sourceCutoff: record.sourceCutoff || "",
    inputHash: record.inputHash || "",
    status: record.status || "failed",
    stageAttempted: stage,
    stageCompleted: completed.indexOf(stage) !== -1,
    completedStages: completed,
    remainingStages: remaining,
    safeToContinue: record.status !== "validated" && record.status !== "failed",
    elapsedMs: Date.now() - started,
    published: false,
    livePointer: false
  };
}
