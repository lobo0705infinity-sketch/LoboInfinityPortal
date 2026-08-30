/*******************************************************
 * Hourly public snapshot foundation.
 *
 * Phase 1 creates one isolated, unpublished candidate
 * generation. It does not expose, promote, or publish it.
 *******************************************************/

const PUBLIC_GENERATION_SCHEMA_VERSION = 1;
const PUBLIC_GENERATION_ROOT_FOLDER_PROPERTY =
  "PUBLIC_GENERATION_FOUNDATION_ROOT_FOLDER_ID";
const PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY =
  "PUBLIC_GENERATION_FOUNDATION_ACTIVE_BUILD";
const PUBLIC_GENERATION_LATEST_BUILD_PROPERTY =
  "PUBLIC_GENERATION_FOUNDATION_LATEST_BUILD";
const PUBLIC_GENERATION_ROOT_FOLDER_NAME =
  "Lobo Infinity Portal - Public Generations";
const PUBLIC_GENERATION_INTERNAL_FOLDER_NAME = "internal-build-inputs";
const PUBLIC_GENERATION_CANDIDATES_FOLDER_NAME = "candidates";
const PUBLIC_GENERATION_ID_PATTERN = /^\d{8}T\d{6}Z$/;
const PUBLIC_GENERATION_FORBIDDEN_PUBLIC_KEYS = [
  "armycode",
  "auth",
  "commissioner",
  "credential",
  "email",
  "password",
  "private",
  "secret",
  "session",
  "token",
  "webhook"
];

function runCreatePublicGenerationCandidate() {
  const result = createPublicGenerationCandidate_();
  Logger.log("PUBLIC_GENERATION_CANDIDATE " + JSON.stringify(result));
  return result;
}

function createPublicGenerationCandidate_() {
  const startedMs = Date.now();
  const generation = formatPublicGenerationId_(new Date(startedMs));
  const reservation = reservePublicGenerationBuild_(generation, new Date(startedMs));
  let record = reservation.record;

  try {
    const storage = createPublicGenerationStorage_(generation);
    record = updatePublicGenerationBuildRecord_(record, {
      status: "building",
      storage: storage.references
    });

    const captureStartedMs = Date.now();
    const frozenInput = capturePublicGenerationFrozenInput_(generation);
    const canonicalReadCount = Number(frozenInput.canonicalReadCount) || 0;
    delete frozenInput.canonicalReadCount;
    const frozenInputJson = stablePublicGenerationJson_(frozenInput);
    const inputHash = sha256PublicGenerationText_(frozenInputJson);
    const inputBytes = utf8PublicGenerationByteCount_(frozenInputJson);
    const inputFile = createImmutablePublicGenerationFile_(
      storage.internalFolder,
      "frozen-input.json",
      frozenInputJson
    );
    validatePersistedPublicGenerationText_(inputFile, frozenInputJson, inputHash, inputBytes);

    record = updatePublicGenerationBuildRecord_(record, {
      sourceCutoff: frozenInput.sourceCutoff,
      inputHash: inputHash,
      inputBytes: inputBytes,
      canonicalReads: canonicalReadCount,
      completedStages: ["reserved", "frozen-input"],
      artifacts: {
        frozenInput: buildPublicGenerationFileReference_(inputFile, inputHash, inputBytes)
      }
    });
    writePublicGenerationBuildRecord_(storage, record);

    const representative = buildPublicGenerationCoreSection_(frozenInput);
    validatePublicGenerationPublicArtifact_(representative, generation, frozenInput.sourceCutoff);
    const artifactJson = stablePublicGenerationJson_(representative);
    const artifactHash = sha256PublicGenerationText_(artifactJson);
    const artifactBytes = utf8PublicGenerationByteCount_(artifactJson);
    const artifactFile = createImmutablePublicGenerationFile_(
      storage.candidateFolder,
      "core.json",
      artifactJson
    );
    validatePersistedPublicGenerationText_(artifactFile, artifactJson, artifactHash, artifactBytes);

    const manifest = buildPublicGenerationCandidateManifest_(
      generation,
      frozenInput.sourceCutoff,
      artifactFile,
      artifactHash,
      artifactBytes
    );
    validatePublicGenerationManifest_(manifest, generation, frozenInput.sourceCutoff);
    const manifestJson = stablePublicGenerationJson_(manifest);
    const manifestBytes = utf8PublicGenerationByteCount_(manifestJson);
    const manifestHash = sha256PublicGenerationText_(manifestJson);
    const manifestFile = createImmutablePublicGenerationFile_(
      storage.candidateFolder,
      "manifest.json",
      manifestJson
    );
    validatePersistedPublicGenerationText_(manifestFile, manifestJson, manifestHash, manifestBytes);
    validatePublicGenerationCandidateIsolation_([
      inputFile.getId(),
      artifactFile.getId(),
      manifestFile.getId()
    ]);

    record = updatePublicGenerationBuildRecord_(record, {
      status: "validated",
      completedAt: new Date().toISOString(),
      completedStages: ["reserved", "frozen-input", "core", "manifest", "validated"],
      artifacts: {
        frozenInput: record.artifacts.frozenInput,
        core: buildPublicGenerationFileReference_(artifactFile, artifactHash, artifactBytes),
        manifest: buildPublicGenerationFileReference_(manifestFile, manifestHash, manifestBytes)
      },
      lastError: ""
    });
    writePublicGenerationBuildRecord_(storage, record);
    completePublicGenerationBuild_(record);

    return {
      success: true,
      generation: generation,
      sourceCutoff: record.sourceCutoff,
      status: record.status,
      published: false,
      livePointer: false,
      candidateElapsedMs: Date.now() - startedMs,
      captureElapsedMs: Date.now() - captureStartedMs,
      lockHoldMs: reservation.lockHoldMs,
      canonicalReads: canonicalReadCount,
      driveFileWrites: 5,
      inputBytes: inputBytes,
      inputHash: inputHash,
      representativeArtifact: "core.json",
      artifactBytes: artifactBytes,
      artifactHash: artifactHash,
      manifestBytes: manifestBytes,
      manifestHash: manifestHash,
      readBackValidation: true,
      game73Captured: representative.featuredGame && representative.featuredGame.gameId === 73,
      currentProductionChanged: false
    };
  }
  catch (error) {
    failPublicGenerationBuild_(record, error);
    throw error;
  }
}

function reservePublicGenerationBuild_(generation, startedAt) {
  const lock = LockService.getScriptLock();
  const lockStart = Date.now();
  if (!lock.tryLock(1000))
    throw new Error("Public generation reservation lock is busy; no candidate was created.");
  try {
    const properties = PropertiesService.getScriptProperties();
    const activeRaw = properties.getProperty(PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY);
    if (activeRaw) {
      const active = parsePublicGenerationJson_(activeRaw, {});
      if (active && active.status !== "failed" && active.status !== "validated")
        throw new Error("A public generation candidate build is already active: " + active.generation);
    }
    const record = {
      schemaVersion: PUBLIC_GENERATION_SCHEMA_VERSION,
      generation: generation,
      sourceCutoff: "",
      inputHash: "",
      status: "reserved",
      startedAt: startedAt.toISOString(),
      completedAt: "",
      completedStages: ["reserved"],
      artifacts: {},
      storage: {},
      lastError: ""
    };
    properties.setProperty(PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY, JSON.stringify(record));
    return { record: record, lockHoldMs: Date.now() - lockStart };
  }
  finally {
    lock.releaseLock();
  }
}

function updatePublicGenerationBuildRecord_(record, updates) {
  const next = Object.assign({}, record, updates || {});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000))
    throw new Error("Public generation build-record lock is busy.");
  try {
    PropertiesService.getScriptProperties().setProperty(
      PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY,
      JSON.stringify(next)
    );
  }
  finally {
    lock.releaseLock();
  }
  return next;
}

function completePublicGenerationBuild_(record) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000))
    throw new Error("Public generation completion lock is busy.");
  try {
    const properties = PropertiesService.getScriptProperties();
    const active = parsePublicGenerationJson_(
      properties.getProperty(PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY),
      {}
    );
    if (!active || active.generation !== record.generation)
      throw new Error("Public generation active build changed before completion.");
    properties.setProperty(PUBLIC_GENERATION_LATEST_BUILD_PROPERTY, JSON.stringify(record));
    properties.deleteProperty(PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY);
  }
  finally {
    lock.releaseLock();
  }
}

function failPublicGenerationBuild_(record, error) {
  const failed = Object.assign({}, record || {}, {
    status: "failed",
    completedAt: new Date().toISOString(),
    lastError: String(error && error.message ? error.message : error || "Unknown failure").slice(0, 500)
  });
  try {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return;
    try {
      const properties = PropertiesService.getScriptProperties();
      properties.setProperty(PUBLIC_GENERATION_LATEST_BUILD_PROPERTY, JSON.stringify(failed));
      properties.deleteProperty(PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY);
    }
    finally {
      lock.releaseLock();
    }
  }
  catch (ignored) {
    console.error("PUBLIC_GENERATION_FAILURE_RECORD_FAILED " + String(ignored));
  }
}

function createPublicGenerationStorage_(generation) {
  if (!PUBLIC_GENERATION_ID_PATTERN.test(generation))
    throw new Error("Public generation ID is invalid.");
  const root = getOrCreatePublicGenerationRootFolder_();
  const internalRoot = getOrCreatePublicGenerationChildFolder_(root, PUBLIC_GENERATION_INTERNAL_FOLDER_NAME);
  const candidatesRoot = getOrCreatePublicGenerationChildFolder_(root, PUBLIC_GENERATION_CANDIDATES_FOLDER_NAME);
  if (internalRoot.getFoldersByName(generation).hasNext() ||
      candidatesRoot.getFoldersByName(generation).hasNext())
    throw new Error("Public generation storage already exists and cannot be overwritten: " + generation);
  const internalFolder = internalRoot.createFolder(generation);
  const candidateFolder = candidatesRoot.createFolder(generation);
  return {
    internalFolder: internalFolder,
    candidateFolder: candidateFolder,
    references: {
      internalFolderId: internalFolder.getId(),
      candidateFolderId: candidateFolder.getId()
    }
  };
}

function getOrCreatePublicGenerationRootFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const existing = properties.getProperty(PUBLIC_GENERATION_ROOT_FOLDER_PROPERTY);
  if (existing) {
    try { return DriveApp.getFolderById(existing); }
    catch (ignored) {}
  }
  const folder = DriveApp.createFolder(PUBLIC_GENERATION_ROOT_FOLDER_NAME);
  properties.setProperty(PUBLIC_GENERATION_ROOT_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function getOrCreatePublicGenerationChildFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function capturePublicGenerationFrozenInput_(generation) {
  const spreadsheet = lifGetTargetSpreadsheet_();
  const gamesTable = readPublicGenerationSheet_(spreadsheet, CONFIG.SHEETS.FORM);
  const playersTable = readPublicGenerationSheet_(spreadsheet, CONFIG.SHEETS.PLAYERS);
  const eventsTable = readPublicGenerationSheet_(spreadsheet, CONFIG.SHEETS.EVENTS);
  const games = gamesTable.rows.map(function(row, index) {
    return sanitizePublicGenerationGame_(row, index + 2);
  }).filter(function(game) { return game.player1 && game.player2; });
  const players = sanitizePublicGenerationPlayers_(playersTable);
  const event = sanitizePublicGenerationEvent_(eventsTable, EVENT_ENGINE_DEFAULT_EVENT_ID);
  return {
    schemaVersion: PUBLIC_GENERATION_SCHEMA_VERSION,
    generation: generation,
    sourceCutoff: new Date().toISOString(),
    canonicalReadCount: 3,
    games: games,
    players: players,
    event: event
  };
}

function readPublicGenerationSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return { headers: [], rows: [] };
  const values = sheet.getDataRange().getValues();
  return { headers: values.shift() || [], rows: values };
}

function sanitizePublicGenerationGame_(row, sourceRow) {
  const winner = determineWinner(row);
  const player1Faction = winner === 2 ? row[FORM.LOSINGFACTION] : row[FORM.WINNINGFACTION];
  const player2Faction = winner === 2 ? row[FORM.WINNINGFACTION] : row[FORM.LOSINGFACTION];
  return {
    gameId: sourceRow - 1,
    sourceRow: sourceRow,
    date: normalizePublicGenerationValue_(row[FORM.DATE]),
    division: String(row[FORM.DIVISION] || ""),
    mission: String(row[FORM.MISSION] || ""),
    player1: String(row[FORM.PLAYER1] || ""),
    player2: String(row[FORM.PLAYER2] || ""),
    player1Faction: String(player1Faction || ""),
    player2Faction: String(player2Faction || ""),
    player1Tp: Number(row[FORM.P1TP]) || 0,
    player2Tp: Number(row[FORM.P2TP]) || 0,
    player1Op: Number(row[FORM.P1OP]) || 0,
    player2Op: Number(row[FORM.P2OP]) || 0,
    player1Vp: Number(row[FORM.P1VP]) || 0,
    player2Vp: Number(row[FORM.P2VP]) || 0,
    winner: winner === 1 ? String(row[FORM.PLAYER1] || "") :
      winner === 2 ? String(row[FORM.PLAYER2] || "") : "Draw",
    eventId: String(row[FORM.EVENT_ID] || ""),
    gameType: String(row[FORM.GAME_TYPE] || "")
  };
}

function sanitizePublicGenerationPlayers_(table) {
  const columns = getPlayerRegistryColumns(table.headers || []);
  return (table.rows || []).map(function(row) {
    const player = String(row[columns.player] || "").trim();
    return {
      player: player,
      displayName: String(columns.displayName >= 0 ? row[columns.displayName] || player : player),
      division: String(row[columns.division] || ""),
      active: row[columns.active] === true
    };
  }).filter(function(player) { return player.player; });
}

function sanitizePublicGenerationEvent_(table, eventId) {
  const headers = table.headers || [];
  const columns = {};
  headers.forEach(function(header, index) {
    columns[String(header || "").trim().toLowerCase()] = index;
  });
  const row = (table.rows || []).filter(function(candidate) {
    return String(candidate[columns["id"]] || "") === eventId;
  })[0] || [];
  function value(label) {
    const index = columns[label];
    return index === undefined ? "" : String(row[index] || "");
  }
  return {
    id: eventId,
    name: value("name") || "Current League",
    type: value("type") || "League",
    status: value("status") || value("lifecycle stage") || "Active"
  };
}

function buildPublicGenerationCoreSection_(frozenInput) {
  const game73 = (frozenInput.games || []).filter(function(game) {
    return Number(game.gameId) === 73;
  })[0] || null;
  return {
    schemaVersion: PUBLIC_GENERATION_SCHEMA_VERSION,
    generation: frozenInput.generation,
    sourceGeneration: frozenInput.generation,
    sourceCutoff: frozenInput.sourceCutoff,
    section: "core",
    community: {
      name: "Lobo Infinity League",
      event: frozenInput.event
    },
    counts: {
      canonicalGames: (frozenInput.games || []).length,
      publicPlayers: (frozenInput.players || []).filter(function(player) {
        return player.active;
      }).length
    },
    featuredGame: game73 ? {
      gameId: game73.gameId,
      date: game73.date,
      division: game73.division,
      mission: game73.mission,
      player1: game73.player1,
      player2: game73.player2,
      player1Faction: game73.player1Faction,
      player2Faction: game73.player2Faction,
      player1Tp: game73.player1Tp,
      player2Tp: game73.player2Tp,
      player1Op: game73.player1Op,
      player2Op: game73.player2Op,
      player1Vp: game73.player1Vp,
      player2Vp: game73.player2Vp,
      winner: game73.winner,
      eventId: game73.eventId,
      gameType: game73.gameType
    } : null
  };
}

function buildPublicGenerationCandidateManifest_(generation, sourceCutoff, file, hash, bytes) {
  return {
    schemaVersion: PUBLIC_GENERATION_SCHEMA_VERSION,
    generation: generation,
    sourceCutoff: sourceCutoff,
    generatedAt: new Date().toISOString(),
    status: "candidate",
    sections: {
      core: {
        artifact: file.getId(),
        contentHash: hash,
        byteCount: bytes,
        sourceGeneration: generation,
        required: true
      }
    }
  };
}

function validatePublicGenerationManifest_(manifest, generation, sourceCutoff) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.status !== "candidate")
    throw new Error("Public generation manifest schema is invalid.");
  if (manifest.generation !== generation || !PUBLIC_GENERATION_ID_PATTERN.test(generation))
    throw new Error("Public generation manifest generation is invalid.");
  if (!manifest.sourceCutoff || manifest.sourceCutoff !== sourceCutoff)
    throw new Error("Public generation manifest source cutoff is invalid.");
  const core = manifest.sections && manifest.sections.core;
  if (!core || !core.artifact || !core.contentHash || !Number.isFinite(Number(core.byteCount)) ||
      core.sourceGeneration !== generation || core.required !== true)
    throw new Error("Public generation core manifest entry is invalid.");
}

function validatePublicGenerationPublicArtifact_(artifact, generation, sourceCutoff) {
  if (!artifact || artifact.generation !== generation || artifact.sourceGeneration !== generation ||
      artifact.sourceCutoff !== sourceCutoff || artifact.section !== "core")
    throw new Error("Public generation representative artifact is invalid.");
  assertNoForbiddenPublicGenerationKeys_(artifact, "core");
}

function validatePublicGenerationCandidateIsolation_(candidateFileIds) {
  const properties = PropertiesService.getScriptProperties().getProperties();
  const foundationProperties = [
    PUBLIC_GENERATION_ROOT_FOLDER_PROPERTY,
    PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY,
    PUBLIC_GENERATION_LATEST_BUILD_PROPERTY
  ];
  Object.keys(properties).forEach(function(key) {
    if (foundationProperties.indexOf(key) !== -1) return;
    const value = String(properties[key] || "");
    (candidateFileIds || []).forEach(function(fileId) {
      if (fileId && value.indexOf(String(fileId)) !== -1)
        throw new Error("Candidate artifact is referenced by non-foundation production state: " + key);
    });
  });
}

function assertNoForbiddenPublicGenerationKeys_(value, path) {
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach(function(key) {
    const normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
    PUBLIC_GENERATION_FORBIDDEN_PUBLIC_KEYS.forEach(function(forbidden) {
      if (normalized.indexOf(forbidden) !== -1)
        throw new Error("Public generation contains forbidden key at " + path + "." + key);
    });
    assertNoForbiddenPublicGenerationKeys_(value[key], path + "." + key);
  });
}

function createImmutablePublicGenerationFile_(folder, name, content) {
  if (folder.getFilesByName(name).hasNext())
    throw new Error("Immutable public generation file already exists: " + name);
  return folder.createFile(name, content, MimeType.PLAIN_TEXT);
}

function validatePersistedPublicGenerationText_(file, expected, expectedHash, expectedBytes) {
  const persisted = file.getBlob().getDataAsString("UTF-8");
  if (persisted !== expected || sha256PublicGenerationText_(persisted) !== expectedHash ||
      utf8PublicGenerationByteCount_(persisted) !== expectedBytes)
    throw new Error("Public generation artifact read-back validation failed.");
}

function writePublicGenerationBuildRecord_(storage, record) {
  const folder = storage.internalFolder;
  const existing = folder.getFilesByName("build-record.json");
  if (existing.hasNext()) {
    existing.next().setContent(stablePublicGenerationJson_(record));
    return;
  }
  folder.createFile("build-record.json", stablePublicGenerationJson_(record), MimeType.PLAIN_TEXT);
}

function buildPublicGenerationFileReference_(file, hash, bytes) {
  return { fileId: file.getId(), contentHash: hash, byteCount: bytes };
}

function formatPublicGenerationId_(date) {
  return Utilities.formatDate(date, "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

function normalizePublicGenerationValue_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]")
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
  return String(value || "");
}

function sha256PublicGenerationText_(text) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text),
    Utilities.Charset.UTF_8
  ).map(function(value) {
    const byte = value < 0 ? value + 256 : value;
    return ("0" + byte.toString(16)).slice(-2);
  }).join("");
}

function utf8PublicGenerationByteCount_(text) {
  return Utilities.newBlob(String(text), MimeType.PLAIN_TEXT).getBytes().length;
}

function stablePublicGenerationJson_(value) {
  return JSON.stringify(sortPublicGenerationValue_(value));
}

function sortPublicGenerationValue_(value) {
  if (Array.isArray(value))
    return value.map(sortPublicGenerationValue_);
  if (!value || typeof value !== "object")
    return value;
  const output = {};
  Object.keys(value).sort().forEach(function(key) {
    output[key] = sortPublicGenerationValue_(value[key]);
  });
  return output;
}

function parsePublicGenerationJson_(value, fallback) {
  try { return JSON.parse(String(value || "")); }
  catch (ignored) { return fallback; }
}
