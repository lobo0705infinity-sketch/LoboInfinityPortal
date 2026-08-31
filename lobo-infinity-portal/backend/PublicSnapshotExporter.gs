/*******************************************************
 * Public Snapshot Exporter V1.
 *
 * Owner-run, unpublished, isolated static export. This
 * file intentionally has no dependency on prepared
 * projections, automation queues, or generation prototypes.
 *******************************************************/

const PUBLIC_SNAPSHOT_V1_SCHEMA_VERSION = 1;
const PUBLIC_SNAPSHOT_V1_ROOT_PROPERTY = "PUBLIC_SNAPSHOT_V1_ROOT_FOLDER_ID";
const PUBLIC_SNAPSHOT_V1_ROOT_NAME = "Lobo Public Snapshots V1";
const PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_PROPERTY = "PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_ID";
const PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY = "LOBO_SNAPSHOT_PUBLISH_TOKEN";
const PUBLIC_SNAPSHOT_PUBLISH_URL = "https://lobo-infinity-portal.vercel.app/api/public-snapshot-publish";
const PUBLIC_SNAPSHOT_PUBLIC_FILES = [
  "snapshot.json", "players.json", "games.json", "events.json",
  "missions.json", "factions.json", "standings.json", "army-lists.json",
  "army-intelligence-summary.json", "army-intelligence-detail.json",
  "schedule.json", "statistics.json", "community.json"
];

function runBuildPublicSnapshotV1() {
  const result = buildPublicSnapshotV1_();
  Logger.log("PUBLIC_SNAPSHOT_V1 " + JSON.stringify(result));
  return result;
}

function runPublishPublicSnapshotV1Proof(publicationToken) {
  return publishLatestPublicSnapshotV1_(true, publicationToken);
}

function runHourlyPublicSnapshot() {
  const started = Date.now();
  const build = buildPublicSnapshotV1_();
  if (!build || build.success !== true || build.status !== "validated") {
    const failed = {
      success: false, stage: "build", snapshotId: build && build.snapshotId,
      error: build && build.error ? build.error : "Public snapshot build failed.",
      pointerUpdated: false, elapsedMs: Date.now() - started
    };
    Logger.log("PUBLIC_SNAPSHOT_HOURLY " + JSON.stringify(failed));
    return failed;
  }
  try {
    const publication = publishLatestPublicSnapshotV1_(true, null, build.snapshotId);
    const result = {
      success: true, stage: "complete", snapshotId: build.snapshotId,
      sourceCutoff: build.sourceCutoff, status: "published",
      filesUploaded: publication.filesUploaded, publishedToBlob: true,
      pointerUpdated: true, current: publication.current,
      elapsedMs: Date.now() - started
    };
    Logger.log("PUBLIC_SNAPSHOT_HOURLY " + JSON.stringify(result));
    return result;
  } catch (error) {
    const failed = {
      success: false, stage: "publication", snapshotId: build.snapshotId,
      sourceCutoff: build.sourceCutoff,
      error: String(error && error.message ? error.message : error).slice(0, 500),
      pointerUpdated: false, elapsedMs: Date.now() - started
    };
    Logger.log("PUBLIC_SNAPSHOT_HOURLY " + JSON.stringify(failed));
    return failed;
  }
}

function installHourlyPublicSnapshotTrigger() {
  const handler = "runHourlyPublicSnapshot";
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(handler).timeBased().everyHours(1).create();
  const count = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  }).length;
  if (count !== 1) throw new Error("Expected exactly one hourly Public Snapshot trigger.");
  const result = { success: true, functionName: handler, frequency: "hourly", triggerCount: count };
  Logger.log("PUBLIC_SNAPSHOT_TRIGGER " + JSON.stringify(result));
  return result;
}

function publishLatestPublicSnapshotV1_(activate, publicationToken, expectedSnapshotId) {
  const properties = PropertiesService.getScriptProperties();
  const suppliedToken = String(publicationToken || "").trim();
  if (suppliedToken) properties.setProperty(PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY, suppliedToken);
  const token = suppliedToken || String(properties.getProperty(PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY) || "").trim();
  if (!token) throw new Error("Missing LOBO_SNAPSHOT_PUBLISH_TOKEN Script Property.");

  const rootId = String(properties.getProperty(PUBLIC_SNAPSHOT_V1_ROOT_PROPERTY) || "").trim();
  if (!rootId) throw new Error("Public Snapshot V1 root folder is not configured.");
  const proofId = getLatestValidatedPublicSnapshotId_(properties);
  if (expectedSnapshotId && proofId !== expectedSnapshotId)
    throw new Error("Latest validated snapshot changed before publication.");
  const matches = DriveApp.getFolderById(rootId).getFoldersByName(proofId);
  if (!matches.hasNext()) throw new Error("Validated proof snapshot not found: " + proofId);
  const folder = matches.next();
  if (matches.hasNext()) throw new Error("Duplicate proof snapshot folders found.");

  const files = {};
  PUBLIC_SNAPSHOT_PUBLIC_FILES.forEach(function(filename) {
    const fileMatches = folder.getFilesByName(filename);
    if (!fileMatches.hasNext()) throw new Error("Proof snapshot file not found: " + filename);
    files[filename] = fileMatches.next().getBlob().getDataAsString("UTF-8");
    if (fileMatches.hasNext()) throw new Error("Duplicate proof snapshot file: " + filename);
  });
  const metadata = JSON.parse(files["snapshot.json"]);
  if (metadata.snapshotId !== proofId || metadata.status !== "validated" ||
      metadata.published !== false || metadata.livePointer !== false)
    throw new Error("Proof snapshot metadata is not a validated unpublished snapshot.");

  const response = UrlFetchApp.fetch(PUBLIC_SNAPSHOT_PUBLISH_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      snapshotId: metadata.snapshotId,
      sourceCutoff: metadata.sourceCutoff,
      activate: activate === true,
      files: files
    })
  });
  const statusCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText() || "{}");
  if (statusCode < 200 || statusCode >= 300 || result.success !== true)
    throw new Error("Public snapshot publication failed (HTTP " + statusCode + "): " + String(result.error || "Unknown error"));
  if (activate === true && (result.activated !== true || !result.current || result.current.snapshotId !== proofId))
    throw new Error("Public snapshot activation did not return the expected current pointer.");
  const proof = {
    success: true,
    snapshotId: result.snapshotId,
    sourceCutoff: result.sourceCutoff,
    filesUploaded: result.uploaded,
    files: result.files,
    publishedToBlob: true,
    livePointer: result.activated === true,
    current: result.current || null
  };
  Logger.log("PUBLIC_SNAPSHOT_V1_PUBLICATION " + JSON.stringify(proof));
  return proof;
}

function getLatestValidatedPublicSnapshotId_(properties) {
  const snapshotId = String(
    properties.getProperty(PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_PROPERTY) || ""
  ).trim();
  if (!/^\d{8}T\d{6}Z$/.test(snapshotId))
    throw new Error("Latest validated Public Snapshot V1 identity is unavailable.");
  return snapshotId;
}

function buildPublicSnapshotV1_() {
  const started = Date.now();
  const snapshotId = formatPublicSnapshotId_(new Date(started));
  let folder = null;
  try {
    folder = createPublicSnapshotFolder_(snapshotId);
    const frozen = capturePublicSnapshotSource_(snapshotId);
    const playerIndex = buildPublicSnapshotPlayerIndex_(frozen.playersTable);
    const games = buildPublicSnapshotGameContext_(frozen.gamesTable, playerIndex);
    const events = buildPublicSnapshotEvents_(frozen.eventsTable, games, buildPublicSnapshotEventState_(frozen));
    const players = buildPublicSnapshotPlayers_(frozen.playersTable, games);
    const publicGames = buildPublicSnapshotGames_(games, events);
    const missions = buildPublicSnapshotMissions_(games);
    const factions = buildPublicSnapshotFactions_(games, players);
    const standings = buildPublicSnapshotStandings_(frozen.playersTable, games);
    const armyLists = buildPublicSnapshotArmyLists_(frozen.armyLists);
    const armyIntelligence = buildPublicSnapshotArmyIntelligence_(frozen.armyIntelligence);
    const schedule = buildPublicSnapshotSchedule_(frozen, standings, events, games);
    const statistics = buildPublicSnapshotStatistics_(players, publicGames, frozen.hallOfFame);
    const community = buildPublicSnapshotCommunity_(frozen);
    const datasets = {
      players: players, games: publicGames, events: events,
      missions: missions, factions: factions, standings: standings,
      "army-lists": armyLists,
      "army-intelligence-summary": armyIntelligence.summary,
      "army-intelligence-detail": armyIntelligence.detail,
      schedule: schedule, statistics: statistics, community: community
    };
    const files = {}; let totalBytes = 0;
    Object.keys(datasets).forEach(function(name) {
      files[name] = writePublicSnapshotFile_(folder, name + ".json", {
        schemaVersion: PUBLIC_SNAPSHOT_V1_SCHEMA_VERSION,
        snapshotId: snapshotId,
        sourceCutoff: frozen.sourceCutoff,
        data: datasets[name]
      });
      totalBytes += files[name].byteCount;
    });
    validatePublicSnapshotV1_(snapshotId, frozen.sourceCutoff, datasets, files, games);
    const metadata = {
      schemaVersion: PUBLIC_SNAPSHOT_V1_SCHEMA_VERSION,
      snapshotId: snapshotId,
      sourceCutoff: frozen.sourceCutoff,
      createdAt: new Date().toISOString(),
      status: "validated",
      published: false,
      livePointer: false,
      files: {
        players: "players.json", games: "games.json", events: "events.json",
        missions: "missions.json", factions: "factions.json", standings: "standings.json",
        armyLists: "army-lists.json",
        armyIntelligenceSummary: "army-intelligence-summary.json",
        armyIntelligenceDetail: "army-intelligence-detail.json",
        schedule: "schedule.json", statistics: "statistics.json", community: "community.json"
      }
    };
    files.snapshot = writePublicSnapshotFile_(folder, "snapshot.json", metadata);
    totalBytes += files.snapshot.byteCount;
    validatePublicSnapshotFile_(files.snapshot.fileId, snapshotId, frozen.sourceCutoff, true);
    PropertiesService.getScriptProperties().setProperty(PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_PROPERTY, snapshotId);
    return {
      success: true, snapshotId: snapshotId, sourceCutoff: frozen.sourceCutoff,
      status: "validated", published: false, livePointer: false,
      elapsedMs: Date.now() - started, canonicalReads: frozen.readCount, driveWrites: 13,
      totalBytes: totalBytes, maxLockHoldMs: 0,
      records: {
        players: players.length, games: publicGames.length, events: events.length,
        missions: missions.length, factions: factions.length, standings: standings.length,
        armyLists: armyLists.length,
        armyIntelligenceDetails: armyIntelligence.detail.length,
        schedule: schedule[0].requests.length, statistics: statistics[0].playerCareers.length,
        community: community[0].streams.length + community[0].news.length + community[0].timeline.length
      }, files: files
    };
  }
  catch (error) {
    const result = {
      success: false, snapshotId: snapshotId, status: "failed",
      published: false, livePointer: false,
      error: String(error && error.message ? error.message : error).slice(0, 500),
      elapsedMs: Date.now() - started
    };
    Logger.log("PUBLIC_SNAPSHOT_V1_FAILED " + JSON.stringify(result));
    return result;
  }
}

function formatPublicSnapshotId_(date) {
  return Utilities.formatDate(date, "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

function createPublicSnapshotFolder_(snapshotId) {
  const properties = PropertiesService.getScriptProperties();
  let root = null;
  const rootId = properties.getProperty(PUBLIC_SNAPSHOT_V1_ROOT_PROPERTY);
  if (rootId) {
    try { root = DriveApp.getFolderById(rootId); } catch (ignored) { root = null; }
  }
  if (!root) {
    root = DriveApp.createFolder(PUBLIC_SNAPSHOT_V1_ROOT_NAME);
    properties.setProperty(PUBLIC_SNAPSHOT_V1_ROOT_PROPERTY, root.getId());
  }
  if (root.getFoldersByName(snapshotId).hasNext())
    throw new Error("Public snapshot already exists: " + snapshotId);
  return root.createFolder(snapshotId);
}

function readPublicSnapshotSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return { headers: [], rows: [] };
  const values = sheet.getDataRange().getValues();
  return { headers: values.shift() || [], rows: values };
}

function capturePublicSnapshotSource_(snapshotId) {
  const spreadsheet = lifGetTargetSpreadsheet_();
  const gamesTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.FORM);
  const playersTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.PLAYERS);
  const eventsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.EVENTS);
  const armyLists = readPublicSnapshotPersistedArmyLists_();
  const armyIntelligence = readPublicSnapshotPersistedArmyIntelligence_();
  const leagueOperationsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.LEAGUE_OPERATIONS);
  const schedulingTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.SCHEDULING_REQUESTS);
  const settingsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.SETTINGS);
  const streamsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.STREAMS);
  const newsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.COMMISSIONER_NEWS);
  const timelineTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.COMMUNITY_TIMELINE);
  const participantsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.EVENT_PARTICIPANTS);
  const roundsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.EVENT_ROUNDS);
  const bracketTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.EVENT_BRACKET_MATCHES);
  const bracketMissionsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.EVENT_BRACKET_MISSIONS);
  const teamsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.TEAM_TOURNAMENT_TEAMS);
  const pairingsTable = readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.TEAM_TOURNAMENT_PAIRINGS);
  const hallOfFame = buildPublicSnapshotHallOfFameStrict_(armyLists);
  return {
    snapshotId: snapshotId,
    sourceCutoff: new Date().toISOString(),
    gamesTable: freezePublicSnapshotTable_(gamesTable),
    playersTable: freezePublicSnapshotTable_(playersTable),
    eventsTable: freezePublicSnapshotTable_(eventsTable),
    armyLists: JSON.parse(JSON.stringify(armyLists)),
    armyIntelligence: JSON.parse(JSON.stringify(armyIntelligence)),
    leagueOperationsTable: freezePublicSnapshotTable_(leagueOperationsTable),
    schedulingTable: freezePublicSnapshotTable_(schedulingTable),
    settingsTable: freezePublicSnapshotTable_(settingsTable),
    streamsTable: freezePublicSnapshotTable_(streamsTable),
    newsTable: freezePublicSnapshotTable_(newsTable),
    timelineTable: freezePublicSnapshotTable_(timelineTable),
    participantsTable: freezePublicSnapshotTable_(participantsTable),
    roundsTable: freezePublicSnapshotTable_(roundsTable),
    bracketTable: freezePublicSnapshotTable_(bracketTable),
    bracketMissionsTable: freezePublicSnapshotTable_(bracketMissionsTable),
    teamsTable: freezePublicSnapshotTable_(teamsTable),
    pairingsTable: freezePublicSnapshotTable_(pairingsTable),
    hallOfFame: JSON.parse(JSON.stringify(hallOfFame)),
    readCount: 17
  };
}

function readPublicSnapshotPersistedArmyLists_() {
  const model = readArmyListsReadModelPayload();
  if (!model || !Array.isArray(model.lists))
    throw new Error("Public snapshot Army Lists persisted model unavailable.");
  return model;
}

function readPublicSnapshotPersistedArmyIntelligence_() {
  const model = readArmyIntelligenceReadModelPayload();
  if (!model || !Array.isArray(model.lists))
    throw new Error("Public snapshot Army Intelligence persisted model unavailable.");
  return model;
}

function freezePublicSnapshotTable_(table) {
  return {
    headers: (table.headers || []).map(normalizePublicSnapshotValue_),
    rows: (table.rows || []).map(function(row) { return row.map(normalizePublicSnapshotValue_); })
  };
}

function normalizePublicSnapshotValue_(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return "";
  return value;
}

function normalizePublicSnapshotIdentity_(value) {
  return String(value || "").trim().toLowerCase();
}

function buildPublicSnapshotPlayerIndex_(table) {
  const columns = getPlayerRegistryColumns(table.headers || []); const index = {};
  (table.rows || []).forEach(function(row) {
    const player = String(row[columns.player] || "").trim();
    if (!player) return;
    const key = normalizePublicSnapshotIdentity_(player);
    if (index[key] && index[key].player !== player)
      throw new Error("Player Registry identity collision: " + player);
    index[key] = {
      player: player,
      displayName: String(columns.displayName >= 0 ? row[columns.displayName] || player : player).trim(),
      division: String(row[columns.division] || "").trim(),
      active: String(row[columns.active] || "").toLowerCase() === "true"
    };
  });
  return index;
}

function resolvePublicSnapshotParticipant_(index, raw) {
  const historical = String(raw || "").trim();
  return index[normalizePublicSnapshotIdentity_(historical)] || {
    player: historical, displayName: historical, division: "", active: false, historical: true
  };
}

function buildPublicSnapshotGameContext_(table, playerIndex) {
  return (table.rows || []).map(function(row, index) {
    const sourceRow = index + 2;
    const winnerSide = determineWinner(row);
    const rawPlayer1 = String(row[FORM.PLAYER1] || "");
    const rawPlayer2 = String(row[FORM.PLAYER2] || "");
    if (!rawPlayer1.trim() || !rawPlayer2.trim()) return null;
    const player1 = resolvePublicSnapshotParticipant_(playerIndex, rawPlayer1);
    const player2 = resolvePublicSnapshotParticipant_(playerIndex, rawPlayer2);
    const player1Faction = winnerSide === 2 ? row[FORM.LOSINGFACTION] : row[FORM.WINNINGFACTION];
    const player2Faction = winnerSide === 2 ? row[FORM.WINNINGFACTION] : row[FORM.LOSINGFACTION];
    const player1ArmyListId = winnerSide === 2 ? row[FORM.LOSER_ARMY_LIST_ID] : row[FORM.WINNER_ARMY_LIST_ID];
    const player2ArmyListId = winnerSide === 2 ? row[FORM.WINNER_ARMY_LIST_ID] : row[FORM.LOSER_ARMY_LIST_ID];
    return {
      gameId: sourceRow - 1,
      date: String(row[FORM.DATE] || ""), division: String(row[FORM.DIVISION] || "").trim(),
      mission: String(row[FORM.MISSION] || "").trim(),
      player1: player1.player, player1DisplayName: player1.displayName,
      player2: player2.player, player2DisplayName: player2.displayName,
      player1Faction: String(player1Faction || "").trim(),
      player2Faction: String(player2Faction || "").trim(),
      player1ArmyListId: String(player1ArmyListId || "").trim(),
      player2ArmyListId: String(player2ArmyListId || "").trim(),
      player1Tp: Number(row[FORM.P1TP]) || 0, player2Tp: Number(row[FORM.P2TP]) || 0,
      player1Op: Number(row[FORM.P1OP]) || 0, player2Op: Number(row[FORM.P2OP]) || 0,
      player1Vp: Number(row[FORM.P1VP]) || 0, player2Vp: Number(row[FORM.P2VP]) || 0,
      winner: winnerSide === 1 ? player1.player : winnerSide === 2 ? player2.player : "Draw",
      eventId: String(row[FORM.EVENT_ID] || EVENT_ENGINE_DEFAULT_EVENT_ID).trim() || EVENT_ENGINE_DEFAULT_EVENT_ID,
      gameType: String(row[FORM.GAME_TYPE] || "League").trim() || "League",
      bestMoment: String(row[FORM.MOMENT] || ""), firstTurn: String(row[FORM.FIRSTTURN] || "")
    };
  }).filter(Boolean);
}

function publicSnapshotColumns_(headers) {
  const output = {};
  (headers || []).forEach(function(header, index) {
    output[String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "")] = index;
  });
  return output;
}

function publicSnapshotCell_(row, columns, labels) {
  for (let index = 0; index < labels.length; index += 1) {
    const key = String(labels[index]).toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (columns[key] !== undefined) return String(row[columns[key]] || "").trim();
  }
  return "";
}

function buildPublicSnapshotEvents_(table, games, eventState) {
  const columns = publicSnapshotColumns_(table.headers || []);
  return (table.rows || []).map(function(row) {
    const id = publicSnapshotCell_(row, columns, ["id", "event id"]);
    if (!id) return null;
    const state = eventState && eventState[id] || {};
    return {
      id: id, name: publicSnapshotCell_(row, columns, ["name"]),
      description: publicSnapshotCell_(row, columns, ["description"]),
      type: publicSnapshotCell_(row, columns, ["type"]),
      lifecycleStage: publicSnapshotCell_(row, columns, ["lifecycle stage"]),
      status: publicSnapshotCell_(row, columns, ["status"]),
      startDate: publicSnapshotCell_(row, columns, ["start date"]),
      endDate: publicSnapshotCell_(row, columns, ["end date"]),
      rules: publicSnapshotCell_(row, columns, ["rules"]),
      scoringModel: publicSnapshotCell_(row, columns, ["scoring model"]),
      standingsModel: publicSnapshotCell_(row, columns, ["standings model"]),
      completedGames: games.filter(function(game) { return game.eventId === id; }).length,
      registeredCount: (state.participants || []).length,
      participants: state.participants || [], rounds: state.rounds || [],
      bracket: state.bracket || [], bracketMissions: state.bracketMissions || [],
      teams: state.teams || [], pairings: state.pairings || []
    };
  }).filter(Boolean);
}

function buildPublicSnapshotEventState_(frozen) {
  const output = {};
  const add = function(eventId, key, value) {
    if (!eventId) return;
    if (!output[eventId]) output[eventId] = {};
    if (!output[eventId][key]) output[eventId][key] = [];
    output[eventId][key].push(value);
  };
  buildPublicSnapshotRows_(frozen.participantsTable, {
    eventId: ["event id"], player: ["player"], displayName: ["display name"], role: ["role"],
    status: ["status"], registeredAt: ["registered at"], seed: ["seed"], team: ["team"],
    preferredTeam: ["preferred team"], captain: ["captain"], freeAgent: ["free agent"],
    faction: ["faction"], updatedAt: ["updated at"], itsName: ["its name"]
  }).forEach(function(row) { const id = row.eventId; delete row.eventId; add(id, "participants", row); });
  buildPublicSnapshotRows_(frozen.roundsTable, {
    id: ["id"], eventId: ["event id"], name: ["name"], number: ["number"], type: ["type"],
    startDate: ["start date"], endDate: ["end date"], status: ["status"], games: ["games"],
    mission: ["mission"]
  }).forEach(function(row) { const id = row.eventId; delete row.eventId; add(id, "rounds", row); });
  buildPublicSnapshotRows_(frozen.bracketTable, {
    eventId: ["event id"], matchId: ["match id"], bracket: ["bracket"], bracketRound: ["bracket round"],
    position: ["position"], playerA: ["player a"], seedA: ["seed a"], playerB: ["player b"],
    seedB: ["seed b"], status: ["status"], winner: ["winner"], loser: ["loser"],
    deadline: ["deadline"], gameId: ["game id"], resolution: ["resolution"]
  }).forEach(function(row) { const id = row.eventId; delete row.eventId; add(id, "bracket", row); });
  buildPublicSnapshotRows_(frozen.bracketMissionsTable, {
    eventId: ["event id"], bracket: ["bracket"], bracketRound: ["bracket round"], mission: ["mission"]
  }).forEach(function(row) { const id = row.eventId; delete row.eventId; add(id, "bracketMissions", row); });
  buildPublicSnapshotRows_(frozen.teamsTable, {
    eventId: ["event id"], teamId: ["team id"], teamName: ["team name"], captain: ["captain"],
    players: ["players"], factionRestrictions: ["faction restrictions"], logoUrl: ["logo url"],
    status: ["status"], createdAt: ["created at"], updatedAt: ["updated at"]
  }).forEach(function(row) { const id = row.eventId; delete row.eventId; add(id, "teams", row); });
  buildPublicSnapshotRows_(frozen.pairingsTable, {
    eventId: ["event id"], roundId: ["round id"], round: ["round"], teamA: ["team a"],
    teamB: ["team b"], playerPairings: ["player pairings"], status: ["status"], results: ["results"],
    createdAt: ["created at"], updatedAt: ["updated at"]
  }).forEach(function(row) { const id = row.eventId; delete row.eventId; add(id, "pairings", row); });
  return output;
}

function buildPublicSnapshotGames_(games, events) {
  const names = {}; (events || []).forEach(function(event) { names[event.id] = event.name; });
  return games.map(function(source) {
    const draw = source.winner === "Draw";
    const winnerIsPlayer1 = source.winner === source.player1;
    const loser = draw ? "Draw" : winnerIsPlayer1 ? source.player2 : source.player1;
    return {
      id: source.gameId, eventId: source.eventId, eventName: names[source.eventId] || "",
      gameType: source.gameType, date: source.date, division: source.division,
      winner: source.winner,
      winnerDisplayName: draw ? "Draw" : winnerIsPlayer1 ? source.player1DisplayName : source.player2DisplayName,
      loser: loser,
      loserDisplayName: draw ? "Draw" : winnerIsPlayer1 ? source.player2DisplayName : source.player1DisplayName,
      winnerFaction: draw ? source.player1Faction : winnerIsPlayer1 ? source.player1Faction : source.player2Faction,
      loserFaction: draw ? source.player2Faction : winnerIsPlayer1 ? source.player2Faction : source.player1Faction,
      mission: source.mission,
      tp: publicSnapshotScore_(source.player1Tp, source.player2Tp, winnerIsPlayer1, draw),
      op: publicSnapshotScore_(source.player1Op, source.player2Op, winnerIsPlayer1, draw),
      vp: publicSnapshotScore_(source.player1Vp, source.player2Vp, winnerIsPlayer1, draw),
      bestMoment: source.bestMoment, firstTurn: source.firstTurn,
      winnerArmyListId: draw ? source.player1ArmyListId : winnerIsPlayer1 ? source.player1ArmyListId : source.player2ArmyListId,
      loserArmyListId: draw ? source.player2ArmyListId : winnerIsPlayer1 ? source.player2ArmyListId : source.player1ArmyListId
    };
  });
}

function publicSnapshotScore_(player1, player2, winnerIsPlayer1, draw) {
  return (winnerIsPlayer1 || draw ? player1 : player2) + "–" +
    (winnerIsPlayer1 || draw ? player2 : player1);
}

function buildPublicSnapshotPlayers_(table, games) {
  const index = buildPublicSnapshotPlayerIndex_(table); const records = {};
  Object.keys(index).forEach(function(key) {
    const source = index[key];
    records[key] = {
      player: source.player, displayName: source.displayName, division: source.division,
      active: source.active, games: 0, wins: 0, losses: 0, draws: 0,
      tp: 0, op: 0, vp: 0, factions: {}, missions: {}, lastActive: ""
    };
  });
  games.forEach(function(game) {
    [[game.player1, 1], [game.player2, 2]].forEach(function(tuple) {
      const record = records[normalizePublicSnapshotIdentity_(tuple[0])];
      if (!record) return;
      const side = tuple[1]; const draw = game.winner === "Draw";
      record.games += 1;
      if (draw) record.draws += 1; else if (game.winner === record.player) record.wins += 1; else record.losses += 1;
      record.tp += side === 1 ? game.player1Tp : game.player2Tp;
      record.op += side === 1 ? game.player1Op : game.player2Op;
      record.vp += side === 1 ? game.player1Vp : game.player2Vp;
      const faction = side === 1 ? game.player1Faction : game.player2Faction;
      record.factions[faction] = (record.factions[faction] || 0) + 1;
      record.missions[game.mission] = (record.missions[game.mission] || 0) + 1;
      if (String(game.date) > record.lastActive) record.lastActive = String(game.date);
    });
  });
  const divisions = {};
  Object.keys(records).forEach(function(key) {
    const division = records[key].division || "Community";
    if (!divisions[division]) divisions[division] = [];
    divisions[division].push(records[key]);
  });
  Object.keys(divisions).forEach(function(division) {
    divisions[division].sort(publicSnapshotPlayerSort_);
    divisions[division].forEach(function(record, index) { record.rank = index + 1; });
  });
  return Object.keys(records).sort().map(function(key) {
    const record = records[key];
    const favoriteFaction = publicSnapshotMostFrequent_(record.factions);
    const favoriteMission = publicSnapshotMostFrequent_(record.missions);
    return {
      player: record.player, displayName: record.displayName,
      division: record.division, divisionLabel: record.division, rank: record.rank || 0,
      games: record.games, wins: record.wins, losses: record.losses, draws: record.draws,
      tp: record.tp, op: record.op, vp: record.vp,
      faction: favoriteFaction, favoriteFaction: favoriteFaction, favoriteArmy: favoriteFaction,
      lastActive: record.lastActive,
      statusBadges: record.active ? ["League Player"] : record.games ? ["Casual Player"] : ["New Player"],
      favoriteMission: favoriteMission
    };
  });
}

function publicSnapshotPlayerSort_(left, right) {
  return right.tp - left.tp || right.op - left.op || right.vp - left.vp ||
    left.player.localeCompare(right.player);
}

function publicSnapshotMostFrequent_(counts) {
  return Object.keys(counts || {}).filter(Boolean).sort(function(left, right) {
    return counts[right] - counts[left] || left.localeCompare(right);
  })[0] || "";
}

function publicSnapshotAverage_(value, count) {
  return count ? Math.round(value * 10 / count) / 10 : 0;
}

function publicSnapshotPercentage_(value, count) {
  return count ? Math.round(value * 1000 / count) / 10 : 0;
}

function publicSnapshotRecentGames_(games) {
  return games.slice().sort(function(left, right) {
    return String(right.date).localeCompare(String(left.date)) || right.gameId - left.gameId;
  }).slice(0, 10).map(function(game) { return { id: game.gameId }; });
}

function buildPublicSnapshotMissions_(games) {
  const groups = {};
  games.forEach(function(game) {
    if (!game.mission) return;
    if (!groups[game.mission]) groups[game.mission] = [];
    groups[game.mission].push(game);
  });
  return Object.keys(groups).sort().map(function(mission) {
    const rows = groups[mission]; const factions = {}; const wins = {}; const divisions = {};
    let tp = 0; let op = 0; let vp = 0; let firstTurnWins = 0;
    rows.forEach(function(game) {
      divisions[game.division] = (divisions[game.division] || 0) + 1;
      [game.player1Faction, game.player2Faction].forEach(function(faction) {
        if (faction) factions[faction] = (factions[faction] || 0) + 1;
      });
      const winnerFaction = game.winner === game.player1 ? game.player1Faction :
        game.winner === game.player2 ? game.player2Faction : "";
      if (winnerFaction) wins[winnerFaction] = (wins[winnerFaction] || 0) + 1;
      tp += game.player1Tp + game.player2Tp; op += game.player1Op + game.player2Op;
      vp += game.player1Vp + game.player2Vp;
      const first = game.firstTurn === "Player 1" ? game.player1 :
        game.firstTurn === "Player 2" ? game.player2 : game.firstTurn;
      if (first && first === game.winner) firstTurnWins += 1;
    });
    const successful = Object.keys(factions).sort(function(left, right) {
      return (wins[right] || 0) / factions[right] - (wins[left] || 0) / factions[left] ||
        factions[right] - factions[left] || left.localeCompare(right);
    })[0] || "";
    return {
      mission: mission, games: rows.length,
      averageTP: publicSnapshotAverage_(tp, rows.length * 2),
      averageOP: publicSnapshotAverage_(op, rows.length * 2),
      averageVP: publicSnapshotAverage_(vp, rows.length * 2),
      firstTurnWinRate: publicSnapshotPercentage_(firstTurnWins, rows.length),
      mostSuccessfulFaction: successful, mostPlayedFaction: publicSnapshotMostFrequent_(factions),
      lastPlayed: rows.reduce(function(value, game) { return String(game.date) > value ? String(game.date) : value; }, ""),
      divisionBreakdown: Object.keys(divisions).sort().map(function(division) {
        return { division: division, games: divisions[division] };
      }),
      recentGames: publicSnapshotRecentGames_(rows),
      bestMoments: rows.filter(function(game) { return game.bestMoment; }).map(function(game) {
        return { gameId: game.gameId, date: game.date, mission: game.mission, moment: game.bestMoment };
      })
    };
  });
}

function buildPublicSnapshotFactions_(games, players) {
  const groups = {}; const names = {};
  players.forEach(function(player) { names[normalizePublicSnapshotIdentity_(player.player)] = player.displayName; });
  games.forEach(function(game) {
    [1, 2].forEach(function(side) {
      const faction = side === 1 ? game.player1Faction : game.player2Faction;
      if (!faction) return;
      if (!groups[faction]) groups[faction] = [];
      const player = side === 1 ? game.player1 : game.player2;
      groups[faction].push({
        game: game, player: player,
        opponent: side === 1 ? game.player2Faction : game.player1Faction,
        won: game.winner === player, draw: game.winner === "Draw",
        tp: side === 1 ? game.player1Tp : game.player2Tp,
        op: side === 1 ? game.player1Op : game.player2Op,
        vp: side === 1 ? game.player1Vp : game.player2Vp
      });
    });
  });
  return Object.keys(groups).sort().map(function(name) {
    const rows = groups[name]; const summary = summarizePublicSnapshotFaction_(rows);
    const playersByName = {}; const missions = {}; const divisions = {}; const matchups = {};
    rows.forEach(function(row) {
      if (!playersByName[row.player]) playersByName[row.player] = [];
      playersByName[row.player].push(row);
      missions[row.game.mission] = (missions[row.game.mission] || 0) + 1;
      divisions[row.game.division] = (divisions[row.game.division] || 0) + 1;
      if (!matchups[row.opponent]) matchups[row.opponent] = [];
      matchups[row.opponent].push(row);
    });
    const topPlayer = Object.keys(playersByName).sort(function(left, right) {
      const a = summarizePublicSnapshotFaction_(playersByName[left]);
      const b = summarizePublicSnapshotFaction_(playersByName[right]);
      return b.wins - a.wins || b.games - a.games || left.localeCompare(right);
    })[0] || "";
    const matchupRows = Object.keys(matchups).filter(Boolean).sort().map(function(opponent) {
      const row = summarizePublicSnapshotFaction_(matchups[opponent]); row.opponent = opponent; return row;
    });
    return {
      name: name, games: summary.games, wins: summary.wins, losses: summary.losses,
      draws: summary.draws, winRate: summary.winRate,
      averageTP: summary.averageTP, averageOP: summary.averageOP, averageVP: summary.averageVP,
      topPlayer: topPlayer, topPlayerDisplayName: names[normalizePublicSnapshotIdentity_(topPlayer)] || topPlayer,
      lastPlayed: rows.reduce(function(value, row) { return String(row.game.date) > value ? String(row.game.date) : value; }, ""),
      mostPlayedMission: publicSnapshotMostFrequent_(missions),
      divisionBreakdown: Object.keys(divisions).sort().map(function(division) {
        return { division: division, games: divisions[division] };
      }),
      recentGames: publicSnapshotRecentGames_(rows.map(function(row) { return row.game; })),
      bestMoments: rows.filter(function(row) { return row.game.bestMoment; }).map(function(row) {
        return { gameId: row.game.gameId, date: row.game.date,
          mission: row.game.mission, moment: row.game.bestMoment };
      }),
      matchups: matchupRows
    };
  });
}

function summarizePublicSnapshotFaction_(rows) {
  const wins = rows.filter(function(row) { return row.won; }).length;
  const draws = rows.filter(function(row) { return row.draw; }).length;
  const totals = rows.reduce(function(out, row) {
    out.tp += row.tp; out.op += row.op; out.vp += row.vp; return out;
  }, { tp: 0, op: 0, vp: 0 });
  return {
    games: rows.length, wins: wins, losses: rows.length - wins - draws, draws: draws,
    winRate: publicSnapshotPercentage_(wins, rows.length),
    averageTP: publicSnapshotAverage_(totals.tp, rows.length),
    averageOP: publicSnapshotAverage_(totals.op, rows.length),
    averageVP: publicSnapshotAverage_(totals.vp, rows.length)
  };
}

function isPublicSnapshotCurrentLeagueGame_(game) {
  const type = typeof normalizeGameType === "function" ? normalizeGameType(game.gameType) :
    String(game.gameType || "league").trim().toLowerCase();
  return game.eventId === EVENT_ENGINE_DEFAULT_EVENT_ID && type === "league";
}

function getPublicSnapshotCurrentLeagueDivisions_() {
  return [CONFIG.DIVISIONS.MAIN_MAN, CONFIG.DIVISIONS.PGA, CONFIG.DIVISIONS.PGB];
}

function isPublicSnapshotCompletedGame_(game) {
  return Boolean(game && game.gameId && String(game.date || "").trim() &&
    String(game.player1 || "").trim() && String(game.player2 || "").trim());
}

function buildPublicSnapshotRemainingMatchups_(playersTable, games) {
  const divisionLabels = getPublicSnapshotCurrentLeagueDivisions_();
  const knownDivisions = {};
  divisionLabels.forEach(function(division) { knownDivisions[division] = true; });

  const playerIndex = buildPublicSnapshotPlayerIndex_(playersTable);
  const rosterByKey = {};
  const rosterByDivision = {};
  divisionLabels.forEach(function(division) { rosterByDivision[division] = []; });
  Object.keys(playerIndex).sort().forEach(function(key) {
    const player = playerIndex[key];
    if (!player.active || !knownDivisions[player.division]) return;
    const record = { key: key, player: player.player, displayName: player.displayName, division: player.division };
    rosterByKey[key] = record;
    rosterByDivision[player.division].push(record);
  });

  divisionLabels.forEach(function(division) {
    rosterByDivision[division].sort(function(left, right) {
      return left.displayName.localeCompare(right.displayName) || left.player.localeCompare(right.player);
    });
  });

  const completedByDivision = {};
  const completedByPlayer = {};
  divisionLabels.forEach(function(division) { completedByDivision[division] = {}; });
  Object.keys(rosterByKey).forEach(function(key) { completedByPlayer[key] = {}; });

  (games || []).forEach(function(game) {
    if (!isPublicSnapshotCurrentLeagueGame_(game) || !isPublicSnapshotCompletedGame_(game)) return;
    const player1Key = normalizePublicSnapshotIdentity_(game.player1);
    const player2Key = normalizePublicSnapshotIdentity_(game.player2);
    const player1 = rosterByKey[player1Key];
    const player2 = rosterByKey[player2Key];
    if (!player1 || !player2 || player1Key === player2Key || player1.division !== player2.division) return;
    if (String(game.division || "").trim() !== player1.division) return;
    const ordered = [player1Key, player2Key].sort();
    const pairKey = ordered[0] + "\u0000" + ordered[1];
    if (completedByDivision[player1.division][pairKey]) return;
    completedByDivision[player1.division][pairKey] = true;
    completedByPlayer[player1Key][player2Key] = true;
    completedByPlayer[player2Key][player1Key] = true;
  });

  return divisionLabels.map(function(division) {
    const roster = rosterByDivision[division];
    const completedUniqueMatchups = Object.keys(completedByDivision[division]).length;
    const totalPossibleUniqueMatchups = roster.length > 1 ? roster.length * (roster.length - 1) / 2 : 0;
    return {
      eventId: EVENT_ENGINE_DEFAULT_EVENT_ID,
      division: division,
      divisionLabel: division,
      playerCount: roster.length,
      totalPossibleUniqueMatchups: totalPossibleUniqueMatchups,
      completedUniqueMatchups: completedUniqueMatchups,
      remainingUniqueMatchups: totalPossibleUniqueMatchups - completedUniqueMatchups,
      players: roster.map(function(player) {
        const completedOpponents = roster.filter(function(opponent) {
          return opponent.key !== player.key && completedByPlayer[player.key][opponent.key];
        });
        const remainingOpponents = roster.filter(function(opponent) {
          return opponent.key !== player.key && !completedByPlayer[player.key][opponent.key];
        });
        const projectOpponent = function(opponent) {
          return { player: opponent.player, displayName: opponent.displayName };
        };
        return {
          player: player.player,
          displayName: player.displayName,
          opponentsCompleted: completedOpponents.length,
          opponentsRemaining: remainingOpponents.length,
          completedOpponents: completedOpponents.map(projectOpponent),
          remainingOpponents: remainingOpponents.map(projectOpponent)
        };
      })
    };
  });
}

function validatePublicSnapshotRemainingMatchups_(remainingMatchups) {
  const expectedDivisions = getPublicSnapshotCurrentLeagueDivisions_();
  if (!Array.isArray(remainingMatchups) || remainingMatchups.length !== expectedDivisions.length)
    throw new Error("Public snapshot remaining-matchup divisions are incomplete.");

  expectedDivisions.forEach(function(division) {
    const value = remainingMatchups.filter(function(item) { return item.division === division; })[0];
    if (!value || !Array.isArray(value.players))
      throw new Error("Public snapshot remaining-matchup division is missing: " + division);
    const byPlayer = {};
    value.players.forEach(function(player) {
      const key = normalizePublicSnapshotIdentity_(player.player);
      if (!key || byPlayer[key]) throw new Error("Public snapshot remaining-matchup player is invalid.");
      byPlayer[key] = player;
    });
    if (value.playerCount !== value.players.length)
      throw new Error("Public snapshot remaining-matchup player count is invalid: " + division);

    const completedPairs = {};
    value.players.forEach(function(player) {
      const playerKey = normalizePublicSnapshotIdentity_(player.player);
      const completed = player.completedOpponents || [];
      const remaining = player.remainingOpponents || [];
      const seen = {};
      completed.concat(remaining).forEach(function(opponent) {
        const opponentKey = normalizePublicSnapshotIdentity_(opponent.player);
        if (!opponentKey || opponentKey === playerKey || !byPlayer[opponentKey] || seen[opponentKey])
          throw new Error("Public snapshot remaining-matchup opponent is invalid: " + player.player);
        seen[opponentKey] = true;
      });
      if (Object.keys(seen).length !== value.players.length - 1 ||
          Number(player.opponentsCompleted) !== completed.length ||
          Number(player.opponentsRemaining) !== remaining.length)
        throw new Error("Public snapshot remaining-matchup counts are invalid: " + player.player);
      completed.forEach(function(opponent) {
        const opponentKey = normalizePublicSnapshotIdentity_(opponent.player);
        const reverse = byPlayer[opponentKey].completedOpponents || [];
        if (!reverse.some(function(item) { return normalizePublicSnapshotIdentity_(item.player) === playerKey; }))
          throw new Error("Public snapshot remaining-matchup completion is not symmetric.");
        const pair = [playerKey, opponentKey].sort();
        completedPairs[pair[0] + "\u0000" + pair[1]] = true;
      });
      remaining.forEach(function(opponent) {
        const opponentKey = normalizePublicSnapshotIdentity_(opponent.player);
        const reverse = byPlayer[opponentKey].remainingOpponents || [];
        if (!reverse.some(function(item) { return normalizePublicSnapshotIdentity_(item.player) === playerKey; }))
          throw new Error("Public snapshot remaining-matchup remainder is not symmetric.");
      });
    });
    const total = value.players.length > 1 ? value.players.length * (value.players.length - 1) / 2 : 0;
    if (value.totalPossibleUniqueMatchups !== total ||
        value.completedUniqueMatchups !== Object.keys(completedPairs).length ||
        value.remainingUniqueMatchups !== total - Object.keys(completedPairs).length)
      throw new Error("Public snapshot remaining-matchup division totals are invalid: " + division);
  });
}

function runAuditCurrentLeagueRemainingMatchups() {
  const spreadsheet = lifGetTargetSpreadsheet_();
  const playersTable = freezePublicSnapshotTable_(readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.PLAYERS));
  const gamesTable = freezePublicSnapshotTable_(readPublicSnapshotSheet_(spreadsheet, CONFIG.SHEETS.FORM));
  const games = buildPublicSnapshotGameContext_(gamesTable, buildPublicSnapshotPlayerIndex_(playersTable));
  const remainingMatchups = buildPublicSnapshotRemainingMatchups_(playersTable, games);
  validatePublicSnapshotRemainingMatchups_(remainingMatchups);
  return {
    eventId: EVENT_ENGINE_DEFAULT_EVENT_ID,
    divisions: remainingMatchups.map(function(division) {
      return {
        division: division.division,
        players: division.playerCount,
        totalPossibleUniqueMatchups: division.totalPossibleUniqueMatchups,
        completedUniqueMatchups: division.completedUniqueMatchups,
        remainingUniqueMatchups: division.remainingUniqueMatchups
      };
    })
  };
}

function buildPublicSnapshotStandings_(playersTable, games) {
  const index = buildPublicSnapshotPlayerIndex_(playersTable); const records = {};
  Object.keys(index).forEach(function(key) {
    const player = index[key];
    if (!player.active) return;
    records[key] = {
      player: player.player, displayName: player.displayName, division: player.division,
      games: 0, wins: 0, losses: 0, draws: 0, tp: 0, op: 0, vp: 0, gameIds: {}
    };
  });
  games.filter(isPublicSnapshotCurrentLeagueGame_).forEach(function(game) {
    [[game.player1, 1], [game.player2, 2]].forEach(function(tuple) {
      const record = records[normalizePublicSnapshotIdentity_(tuple[0])];
      if (!record) return;
      const side = tuple[1]; const draw = game.winner === "Draw";
      record.games += 1;
      if (draw) record.draws += 1; else if (game.winner === record.player) record.wins += 1; else record.losses += 1;
      record.tp += side === 1 ? game.player1Tp : game.player2Tp;
      record.op += side === 1 ? game.player1Op : game.player2Op;
      record.vp += side === 1 ? game.player1Vp : game.player2Vp;
      record.gameIds[game.gameId] = true;
    });
  });
  return [CONFIG.DIVISIONS.MAIN_MAN, CONFIG.DIVISIONS.PGA, CONFIG.DIVISIONS.PGB].map(function(division) {
    const rows = Object.keys(records).map(function(key) { return records[key]; })
      .filter(function(record) { return record.division === division; });
    rows.sort(publicSnapshotPlayerSort_); const gameIds = {};
    const standings = rows.map(function(record, index) {
      Object.keys(record.gameIds).forEach(function(id) { gameIds[id] = true; });
      return {
        rank: index + 1, player: record.player, displayName: record.displayName,
        games: record.games, wins: record.wins, losses: record.losses, draws: record.draws,
        tp: record.tp, op: record.op, vp: record.vp
      };
    });
    return {
      eventId: EVENT_ENGINE_DEFAULT_EVENT_ID, division: division, divisionLabel: division,
      players: standings.length, activePlayers: standings.length,
      gamesPlayed: Object.keys(gameIds).length, standings: standings
    };
  });
}

function buildPublicSnapshotArmyLists_(readModel) {
  return (readModel && Array.isArray(readModel.lists) ? readModel.lists : []).map(function(list) {
    return {
      id: String(list.id || ""), gameId: Number(list.gameId) || 0,
      player: String(list.player || "").trim(),
      playerDisplayName: String(list.playerDisplayName || list.player || "").trim(),
      faction: String(list.faction || "").trim(), sectorial: String(list.sectorial || "").trim(),
      mission: String(list.mission || "").trim(), eventId: String(list.eventId || "").trim(),
      eventName: String(list.eventName || list.event || "").trim(),
      gameType: String(list.gameType || list.source || "").trim(),
      date: String(list.date || list.submissionDate || ""),
      submissionDate: String(list.submissionDate || list.date || ""),
      opponent: String(list.opponent || "").trim(),
      opponentDisplayName: String(list.opponentDisplayName || list.opponent || "").trim(),
      result: String(list.result || "").trim(), armyName: String(list.armyName || "").trim(),
      armyLink: String(list.armyLink || "").trim(), score: Number(list.score) || 0,
      battleReportPath: String(list.battleReportPath || "").trim(), approved: list.approved !== false
    };
  }).filter(function(list) { return list.id && list.player; });
}

function buildPublicSnapshotArmyIntelligence_(readModel) {
  if (!readModel) return {
    summary: [{ available: false, decodedLists: 0, pendingLists: 0, failedLists: 0, options: [] }],
    detail: []
  };
  const publicSummary = buildArmyIntelligencePublicSummaryProjection(readModel);
  const summary = [{
    available: true, decodedLists: Number(publicSummary.decodedLists) || 0,
    pendingLists: Number(publicSummary.pendingLists) || 0,
    failedLists: Number(publicSummary.failedLists) || 0,
    options: (publicSummary.options || []).map(String)
  }];
  const detail = (publicSummary.options || []).map(function(option) {
    const source = buildArmyIntelligencePublicFactionProjection(readModel, option);
    return {
      faction: String(source.faction || option),
      lists: (source.lists || []).map(function(list) {
        const decoded = list.decoded || {};
        return {
          sourceId: String(list.sourceId || ""), sourceType: String(list.sourceType || ""),
          player: String(list.player || ""), date: String(list.date || ""),
          event: String(list.event || ""), gameType: String(list.gameType || ""),
          mission: String(list.mission || ""), opponent: String(list.opponent || ""),
          result: String(list.result || ""), results: (list.results || []).map(String),
          faction: String(decoded.faction || list.faction || ""),
          sectorial: String(decoded.sectorial || list.sectorial || ""),
          status: String(list.status || ""), decodedAt: String(list.decodedAt || ""),
          decoded: buildPublicSnapshotDecodedArmy_(decoded)
        };
      }),
      armyLists: (source.armyLists || []).map(function(list) {
        return {
          id: String(list.id || ""), player: String(list.player || ""),
          playerDisplayName: String(list.playerDisplayName || list.player || ""),
          faction: String(list.faction || ""), sectorial: String(list.sectorial || ""),
          armyName: String(list.armyName || ""), armyLink: String(list.armyLink || ""),
          points: Number(list.points) || 0, swc: Number(list.swc) || 0,
          source: String(list.source || ""), submissionDate: String(list.submissionDate || "")
        };
      })
    };
  });
  return { summary: summary, detail: detail };
}

function buildPublicSnapshotDecodedArmy_(decoded) {
  return {
    decoderVersion: String(decoded.decoderVersion || ""), faction: String(decoded.faction || ""),
    sectorial: String(decoded.sectorial || ""), listName: String(decoded.listName || ""),
    totals: {
      combatGroups: Number(decoded.totals && decoded.totals.combatGroups) || 0,
      points: Number(decoded.totals && decoded.totals.points) || 0,
      swc: Number(decoded.totals && decoded.totals.swc) || 0
    },
    orderCounts: {
      regular: Number(decoded.orderCounts && decoded.orderCounts.regular) || 0,
      irregular: Number(decoded.orderCounts && decoded.orderCounts.irregular) || 0,
      impetuous: Number(decoded.orderCounts && decoded.orderCounts.impetuous) || 0,
      lieutenant: Number(decoded.orderCounts && decoded.orderCounts.lieutenant) || 0
    },
    combatGroups: (decoded.combatGroups || []).map(function(group) {
      return {
        combatGroup: Number(group.combatGroup) || 0,
        entries: (group.entries || []).map(function(entry) {
          return {
            combatGroup: Number(entry.combatGroup) || 0, combinedId: String(entry.combinedId || ""),
            profile: String(entry.profile || ""), unit: String(entry.unit || ""),
            troopType: String(entry.troopType || ""), points: Number(entry.points) || 0,
            swc: Number(entry.swc) || 0, structure: entry.structure == null ? null : Number(entry.structure),
            wounds: entry.wounds == null ? null : Number(entry.wounds),
            chainOfCommand: Boolean(entry.chainOfCommand), doctor: Boolean(entry.doctor),
            engineer: Boolean(entry.engineer), forwardObserver: Boolean(entry.forwardObserver),
            hacker: Boolean(entry.hacker), lieutenant: Boolean(entry.lieutenant),
            specialist: Boolean(entry.specialist), equipment: (entry.equipment || []).map(String),
            orderTypes: (entry.orderTypes || []).map(String), skills: (entry.skills || []).map(String),
            weapons: (entry.weapons || []).map(String)
          };
        })
      };
    })
  };
}

function buildPublicSnapshotSchedule_(frozen, standings, events, games) {
  const operationsRows = frozen.leagueOperationsTable.rows || [];
  const operation = operationsRows.length ? operationsRows[operationsRows.length - 1] : [];
  const requests = (frozen.schedulingTable.rows || []).filter(function(row) { return String(row[0] || "").trim(); })
    .map(function(row) {
      return {
        id: String(row[0] || ""), fromPlayer: String(row[1] || ""), toPlayer: String(row[2] || ""),
        proposedDate: String(row[3] || ""), proposedTime: String(row[4] || ""),
        location: String(row[5] || ""), status: String(row[7] || "Pending"),
        createdAt: String(row[9] || ""), updatedAt: String(row[10] || ""),
        eventId: String(row[11] || EVENT_ENGINE_DEFAULT_EVENT_ID)
      };
    });
  const leagueEvent = (events || []).filter(function(event) { return event.id === EVENT_ENGINE_DEFAULT_EVENT_ID; })[0] || null;
  const remainingMatchups = buildPublicSnapshotRemainingMatchups_(frozen.playersTable, games || []);
  return [{
    eventId: EVENT_ENGINE_DEFAULT_EVENT_ID, eventName: leagueEvent ? leagueEvent.name : "Current League",
    currentSeason: leagueEvent ? leagueEvent.name : "Current League",
    weekNumber: String(operation[0] || ""),
    missions: [
      { mission: String(operation[1] || ""), maps: [String(operation[2] || ""), String(operation[3] || "")] },
      { mission: String(operation[4] || ""), maps: [String(operation[5] || ""), String(operation[6] || "")] }
    ],
    updatedAt: String(operation[7] || ""),
    divisionProgress: (standings || []).map(function(division) {
      const possible = division.players > 1 ? division.players * (division.players - 1) / 2 : 0;
      return {
        division: division.division, players: division.players, gamesCompleted: division.gamesPlayed,
        gamesRemaining: Math.max(0, possible - division.gamesPlayed),
        completionPercentage: publicSnapshotPercentage_(division.gamesPlayed, possible)
      };
    }),
    remainingMatchups: remainingMatchups,
    requests: requests
  }];
}

function buildPublicSnapshotHallOfFameStrict_(armyListsReadModel) {
  const registry = buildPlayerRegistry();
  updateRegistryStatistics(registry);
  const displayNames = buildHallOfFameDisplayNameMap(registry);
  const games = getAllRecentGameObjects();
  const achievementsByPlayer = buildHallOfFameAchievementIndex(
    getAllHallOfFameAchievementRecords()
  );
  const armyListCounts = buildHallOfFameArmyListCountIndex(
    Array.isArray(armyListsReadModel.lists) ? armyListsReadModel.lists : []
  );
  const standings = getHallOfFameStandingsFromRegistry(registry, displayNames);
  const context = {
    registry: registry, displayNames: displayNames, games: games,
    achievementsByPlayer: achievementsByPlayer, armyListCounts: armyListCounts,
    standings: standings, seasonHistory: buildSeasonHistoryCards()
  };
  const records = getLeagueRecords(games);
  const careers = buildHallOfFameCareers(standings, context);
  return {
    leaders: {
      tournamentPoints: getHallOfFameLeaders(standings, "tp"),
      objectivePoints: getHallOfFameLeaders(standings, "op"),
      victoryPoints: getHallOfFameLeaders(standings, "vp"),
      wins: getHallOfFameLeaders(standings, "wins"),
      draws: getHallOfFameLeaders(standings, "draws"),
      games: getHallOfFameLeaders(standings, "games")
    },
    records: records,
    careerLeaders: buildHallOfFameCareerLeaders(careers),
    recordBook: buildHallOfFameRecordBook(games, standings, careers, records),
    leagueHistory: buildLeagueHistoryTimeline(standings, records),
    seasonHistory: context.seasonHistory,
    playerCareers: careers.slice(0, HALL_OF_FAME_LIMIT)
  };
}

function buildPublicSnapshotStatistics_(players, games, hallOfFame) {
  const sorted = function(field) {
    return players.slice().sort(function(left, right) { return right[field] - left[field] || left.player.localeCompare(right.player); })
      .slice(0, 10).map(function(player) {
        return {
          division: player.division, player: player.player, displayName: player.displayName,
          rank: player.rank, games: player.games, wins: player.wins, losses: player.losses,
          draws: player.draws, tp: player.tp, op: player.op, vp: player.vp
        };
      });
  };
  const result = {
    leaders: { wins: sorted("wins"), draws: sorted("draws"), games: sorted("games"),
      tournamentPoints: sorted("tp"), objectivePoints: sorted("op"), victoryPoints: sorted("vp") },
    records: buildPublicSnapshotRecords_(games), careerLeaders: {}, recordBook: [],
    leagueHistory: [], seasonHistory: [], playerCareers: []
  };
  if (hallOfFame && typeof hallOfFame === "object") {
    ["careerLeaders", "recordBook", "leagueHistory", "seasonHistory", "playerCareers"].forEach(function(key) {
      if (hallOfFame[key]) result[key] = pickPublicHallOfFameValue_(hallOfFame[key]);
    });
  }
  return [result];
}

function buildPublicSnapshotRecords_(games) {
  const highest = (games || []).slice().sort(function(left, right) {
    const a = String(left.vp || "").split(/[–-]/).reduce(function(sum, value) { return sum + (Number(value) || 0); }, 0);
    const b = String(right.vp || "").split(/[–-]/).reduce(function(sum, value) { return sum + (Number(value) || 0); }, 0);
    return b - a;
  })[0] || null;
  return { highestScoringGame: highest ? { gameId: highest.id, value: highest.vp,
    label: highest.winner + " vs " + highest.loser } : null };
}

function pickPublicHallOfFameValue_(value) {
  if (Array.isArray(value)) return value.map(pickPublicHallOfFameValue_);
  if (!value || typeof value !== "object") return value;
  const allowed = ["achievementPoints", "achievements", "achievementsEarned", "awards", "body",
    "championships", "date", "details", "displayName", "division", "draws", "finalRank", "games",
    "hallOfFameEntries", "holder", "id", "losses", "movement", "op", "player", "promotions",
    "rank", "record", "relegations", "season", "seasons", "seasonsPlayed", "specialAwards", "story",
    "timestamp", "title", "tp", "type", "value", "vp", "winPercentage", "wins"];
  const output = {};
  allowed.forEach(function(key) { if (value[key] !== undefined) output[key] = pickPublicHallOfFameValue_(value[key]); });
  return output;
}

function buildPublicSnapshotCommunity_(frozen) {
  const settings = {}; const settingsColumns = publicSnapshotColumns_(frozen.settingsTable.headers || []);
  (frozen.settingsTable.rows || []).forEach(function(row) {
    const key = publicSnapshotCell_(row, settingsColumns, ["key"]);
    if (["currentSeason", "joinCommunityFormUrl", "discordInvite", "discordServerName",
      "top40GameSubmissionFormUrl"].indexOf(key) !== -1)
      settings[key] = publicSnapshotCell_(row, settingsColumns, ["value"]);
  });
  const streams = buildPublicSnapshotRows_(frozen.streamsTable, {
    date: ["date"], division: ["division"], mission: ["mission"], player1: ["player 1"],
    player1Faction: ["player 1 faction"], player2: ["player 2"], player2Faction: ["player 2 faction"],
    youtubeUrl: ["youtube url"], featured: ["featured"], title: ["stream title"], streamer: ["streamer"],
    platform: ["platform"], description: ["description"], thumbnailUrl: ["thumbnail url"],
    active: ["active"], gameId: ["battle report id"], streamType: ["stream type"]
  }).filter(function(stream) { return stream.youtubeUrl && String(stream.active).toLowerCase() !== "false"; });
  const news = buildPublicSnapshotRows_(frozen.newsTable, {
    id: ["id"], title: ["title"], body: ["body"], timestamp: ["date", "timestamp"],
    type: ["type"], link: ["link"], relatedPlayer: ["related player"],
    relatedFaction: ["related faction"], relatedMission: ["related mission"]
  }).filter(function(item) { return item.title && item.body; });
  const timeline = buildPublicSnapshotRows_(frozen.timelineTable, {
    id: ["id"], title: ["title"], body: ["body"], timestamp: ["timestamp", "date"],
    type: ["type"], link: ["link"], relatedPlayer: ["related player"],
    relatedFaction: ["related faction"], relatedMission: ["related mission"]
  }).filter(function(item) { return item.title || item.body; });
  return [{ settings: settings, streams: streams, news: news, timeline: timeline, notifications: [] }];
}

function buildPublicSnapshotRows_(table, shape) {
  const columns = publicSnapshotColumns_(table.headers || []);
  return (table.rows || []).map(function(row) {
    const output = {};
    Object.keys(shape).forEach(function(key) { output[key] = publicSnapshotCell_(row, columns, shape[key]); });
    return output;
  });
}

function stablePublicSnapshotJson_(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stablePublicSnapshotJson_).join(",") + "]";
  return "{" + Object.keys(value).sort().map(function(key) {
    return JSON.stringify(key) + ":" + stablePublicSnapshotJson_(value[key]);
  }).join(",") + "}";
}

function sha256PublicSnapshotText_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function(value) { return (value + 256).toString(16).slice(-2); }).join("");
}

function utf8PublicSnapshotBytes_(text) {
  return Utilities.newBlob(text).getBytes().length;
}

function writePublicSnapshotFile_(folder, name, value) {
  const text = stablePublicSnapshotJson_(value);
  const file = folder.createFile(name, text, MimeType.PLAIN_TEXT);
  const reference = {
    file: name, fileId: file.getId(), byteCount: utf8PublicSnapshotBytes_(text),
    sha256: sha256PublicSnapshotText_(text)
  };
  validatePublicSnapshotFile_(reference.fileId, value.snapshotId, value.sourceCutoff, name === "snapshot.json");
  const persisted = DriveApp.getFileById(reference.fileId).getBlob().getDataAsString("UTF-8");
  if (reference.sha256 !== sha256PublicSnapshotText_(persisted) ||
      reference.byteCount !== utf8PublicSnapshotBytes_(persisted))
    throw new Error("Public snapshot read-back mismatch: " + name);
  return reference;
}

function validatePublicSnapshotFile_(fileId, snapshotId, sourceCutoff, metadata) {
  const text = DriveApp.getFileById(fileId).getBlob().getDataAsString("UTF-8");
  let value = null;
  try { value = JSON.parse(text); } catch (error) { throw new Error("Public snapshot JSON is invalid."); }
  if (!value || value.snapshotId !== snapshotId || value.sourceCutoff !== sourceCutoff)
    throw new Error("Public snapshot metadata mismatch.");
  if (!metadata && !Array.isArray(value.data)) throw new Error("Public snapshot data file is invalid.");
  assertPublicSnapshotSafe_(value, "snapshot");
}

function assertPublicSnapshotSafe_(value, path) {
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach(function(key) {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    ["armycode", "auth", "commissioner", "credential", "email", "password",
      "privatenote", "secret", "session", "token", "webhook"].forEach(function(forbidden) {
      if (normalized.indexOf(forbidden) !== -1)
        throw new Error("Public snapshot contains forbidden key at " + path + "." + key);
    });
    assertPublicSnapshotSafe_(value[key], path + "." + key);
  });
}

function validatePublicSnapshotV1_(snapshotId, sourceCutoff, datasets, files, gameContext) {
  ["players", "games", "events", "missions", "factions", "standings", "army-lists",
    "army-intelligence-summary", "army-intelligence-detail", "schedule", "statistics",
    "community"].forEach(function(name) {
    if (!files[name]) throw new Error("Required public snapshot file is missing: " + name);
    validatePublicSnapshotFile_(files[name].fileId, snapshotId, sourceCutoff, false);
  });
  validatePublicSnapshotDatasets_(datasets, gameContext);
}

function calculatePublicSnapshotLeagueRecord_(games, player) {
  return (games || []).filter(isPublicSnapshotCurrentLeagueGame_).reduce(function(record, game) {
    let side = 0;
    if (game.player1 === player) side = 1;
    else if (game.player2 === player) side = 2;
    if (!side) return record;
    const draw = game.winner === "Draw";
    record.games += 1;
    if (draw) record.draws += 1;
    else if (game.winner === player) record.wins += 1;
    else record.losses += 1;
    record.tp += side === 1 ? game.player1Tp : game.player2Tp;
    record.op += side === 1 ? game.player1Op : game.player2Op;
    record.vp += side === 1 ? game.player1Vp : game.player2Vp;
    return record;
  }, { games: 0, wins: 0, losses: 0, draws: 0, tp: 0, op: 0, vp: 0 });
}

function validatePublicSnapshotDatasets_(datasets, gameContext) {
  const gameIds = {};
  datasets.games.forEach(function(game) {
    if (gameIds[game.id]) throw new Error("Public snapshot contains duplicate Game ID: " + game.id);
    gameIds[game.id] = true;
  });
  if (!datasets.games.length || !datasets.players.length || datasets.standings.length !== 3)
    throw new Error("Public snapshot counts are not sane.");
  if (!Array.isArray(datasets.schedule) || datasets.schedule.length !== 1)
    throw new Error("Public snapshot schedule dataset is not sane.");
  validatePublicSnapshotRemainingMatchups_(datasets.schedule[0].remainingMatchups);
  [CONFIG.DIVISIONS.MAIN_MAN, CONFIG.DIVISIONS.PGA, CONFIG.DIVISIONS.PGB].forEach(function(division) {
    if (!datasets.standings.some(function(row) { return row.division === division; }))
      throw new Error("Public snapshot standings division is missing: " + division);
  });
  const game73 = datasets.games.filter(function(game) { return Number(game.id) === 73; });
  if (game73.length !== 1 || game73[0].winner !== "Lobo" || game73[0].loser !== "Nighthawkmk2" ||
      game73[0].mission !== "Dead Man's Switch" || game73[0].tp !== "5–0" ||
      game73[0].op !== "8–1" || game73[0].vp !== "262–122" ||
      game73[0].winnerArmyListId !== "3296098999" || game73[0].loserArmyListId !== "4483300877")
    throw new Error("Public snapshot Game 73 acceptance fixture failed.");
  ["3296098999", "4483300877", "4113389343"].forEach(function(id) {
    if (!datasets["army-lists"].some(function(list) { return String(list.id) === id; }))
      throw new Error("Public snapshot Army List fixture is missing: " + id);
  });
  const main = datasets.standings.filter(function(row) { return row.division === CONFIG.DIVISIONS.MAIN_MAN; })[0];
  const lobo = main && main.standings.filter(function(row) { return row.player === "Lobo"; })[0];
  const nighthawkmk2 = main && main.standings.filter(function(row) {
    return row.player === "Nighthawkmk2";
  })[0];
  [["Lobo", lobo], ["Nighthawkmk2", nighthawkmk2]].forEach(function(tuple) {
    const expected = calculatePublicSnapshotLeagueRecord_(gameContext, tuple[0]);
    const actual = tuple[1];
    if (!actual || ["games", "wins", "losses", "draws", "tp", "op", "vp"].some(function(field) {
      return actual[field] !== expected[field];
    })) throw new Error("Public snapshot standings acceptance failed: " + tuple[0]);
  });
  assertPublicSnapshotSafe_(datasets, "snapshot");
  if (stablePublicSnapshotJson_(datasets.games).toLowerCase().indexOf("armycode") !== -1)
    throw new Error("Public snapshot Games contain raw Army Codes.");
}
