/*******************************************************
 * Prepared public detail and community projection.
 *******************************************************/

const PUBLIC_DETAIL_PROJECTION_FILE_PROPERTY = "PUBLIC_DETAIL_PROJECTION_FILE_ID";
const PUBLIC_DETAIL_PROJECTION_DIRTY_PROPERTY = "PUBLIC_DETAIL_PROJECTION_DIRTY";
const PUBLIC_DETAIL_PLAYER_CHUNKS = ["players:0", "players:1", "players:2", "players:3", "players:4", "players:5", "players:6", "players:7", "players:8"];
const PUBLIC_DETAIL_PROJECTION_SECTIONS = ["games", "factions", "missions"].concat(PUBLIC_DETAIL_PLAYER_CHUNKS);

function refreshPublicDetailProjection(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    const section = getApiParameter(getApiParameters(e), "section") || "games";
    const artifact = publishPublicDetailProjectionSection_(section);
    return jsonOutput({
      success: true,
      section: section,
      generatedAt: artifact.generatedAt,
      fileId: getPublicDetailProjectionFileId_()
    });
  });
}

function markPublicDetailProjectionDirty_(sections) {
  try {
    let requested = Array.isArray(sections) && sections.length
      ? sections
      : PUBLIC_DETAIL_PROJECTION_SECTIONS;
    if (requested.indexOf("players") !== -1)
      requested = requested.filter(function(value) { return value !== "players"; }).concat(PUBLIC_DETAIL_PLAYER_CHUNKS);
    const properties = PropertiesService.getScriptProperties();
    const existing = JSON.parse(properties.getProperty(PUBLIC_DETAIL_PROJECTION_DIRTY_PROPERTY) || "[]");
    const dirty = existing.concat(requested).filter(function(value, index, values) {
      return PUBLIC_DETAIL_PROJECTION_SECTIONS.indexOf(value) !== -1 && values.indexOf(value) === index;
    });
    properties.setProperty(PUBLIC_DETAIL_PROJECTION_DIRTY_PROPERTY, JSON.stringify(dirty));
  }
  catch (error) {
    console.error("PUBLIC_DETAIL_DIRTY_MARK_FAILED " + String(error));
  }
}

function publishDirtyPublicDetailProjectionBestEffort_() {
  const properties = PropertiesService.getScriptProperties();
  const dirty = JSON.parse(properties.getProperty(PUBLIC_DETAIL_PROJECTION_DIRTY_PROPERTY) || "[]");
  if (!dirty.length) return { refreshed: false, success: true };
  try {
    const section = dirty.shift();
    const artifact = publishPublicDetailProjectionSection_(section);
    if (dirty.length) properties.setProperty(PUBLIC_DETAIL_PROJECTION_DIRTY_PROPERTY, JSON.stringify(dirty));
    else properties.deleteProperty(PUBLIC_DETAIL_PROJECTION_DIRTY_PROPERTY);
    return { refreshed: true, generatedAt: artifact.generatedAt, section: section, remaining: dirty.length, success: true };
  }
  catch (error) {
    console.error("PUBLIC_DETAIL_REFRESH_FAILED " + String(error));
    return { refreshed: false, success: false, error: String(error && error.message || error) };
  }
}

function publishPublicDetailProjectionSection_(section) {
  if (PUBLIC_DETAIL_PROJECTION_SECTIONS.indexOf(section) === -1)
    throw new Error("Invalid public detail projection section.");

  const file = getOrCreatePublicDetailProjectionFile_();
  let artifact = {};
  try { artifact = JSON.parse(file.getBlob().getDataAsString() || "{}"); }
  catch (error) { artifact = {}; }
  artifact.schemaVersion = 1;
  artifact.generatedAt = new Date().toISOString();

  if (section === "games") {
    artifact.games = JSON.parse(getRecentGames({ parameter: { eventId: "all", gameType: "all" } }).getContent()).games || [];
    artifact.streams = JSON.parse(getStreams().getContent()).streams || [];
    artifact.news = JSON.parse(getCommissionerNews().getContent()).news || [];
  }
  if (section.indexOf("players:") === 0) {
    artifact.players = artifact.players || {};
    const chunkIndex = Number(section.split(":")[1]);
    const profiles = buildPublicDetailPlayerProfilesChunk_(chunkIndex, 5);
    Object.keys(profiles).forEach(function(name) { artifact.players[name] = profiles[name]; });
  }
  if (section === "factions") artifact.factions = buildPublicDetailFactionProfiles_();
  if (section === "missions") artifact.missions = buildPublicDetailMissionProfiles_();

  validatePublicDetailProjectionSection_(artifact, section);
  file.setContent(JSON.stringify(artifact));
  file.setDescription("Prepared public detail/community data. Canonical data remains in Apps Script and the Game Engine.");
  return artifact;
}

function buildPublicDetailPlayerProfilesChunk_(chunkIndex, chunkSize) {
  const divisions = JSON.parse(getPlayers({ parameter: {} }).getContent()).divisions || [];
  const names = [];
  divisions.forEach(function(division) {
    (division.standings || []).forEach(function(row) {
      if (row.player && names.indexOf(row.player) === -1) names.push(row.player);
    });
  });
  const profiles = {};
  names.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize).forEach(function(name) {
    const value = JSON.parse(getPlayer({ parameter: { name: name } }).getContent());
    if (value.success && value.player && value.player.name) {
      if (value.player.availability) {
        delete value.player.availability.notes;
        delete value.player.availability.discordHandle;
        delete value.player.availability.preferredTimes;
      }
      delete value.player.discordHandle;
      profiles[value.player.name] = value;
    }
  });
  return profiles;
}

function buildPublicDetailFactionProfiles_() {
  const summaries = buildFactionApiSummaries();
  const leagueGames = getLeagueData();
  const recentGames = getAllRecentGameObjects();
  const armyLists = getArmyListObjects();
  const profiles = {};
  summaries.forEach(function(faction) {
    const factionGames = getFactionEngineGames(faction.name, leagueGames);
    const factionRecentGames = getFactionRecentGames(faction.name, recentGames);
    const matchups = getFactionMatchups(faction.name, recentGames);
    profiles[faction.name] = { success: true, faction: {
      name: faction.name,
      games: faction.games,
      wins: faction.wins,
      losses: faction.losses,
      draws: faction.draws || 0,
      winRate: faction.winRate,
      averageTP: faction.averageTP,
      averageOP: faction.averageOP,
      averageVP: faction.averageVP,
      topPlayer: faction.topPlayer,
      topPlayerDisplayName: getPlayerDisplayName(faction.topPlayer),
      lastPlayed: faction.lastPlayed,
      mostPlayedMission: getFactionMostPlayedMission(factionGames),
      divisionBreakdown: getFactionDivisionBreakdownCounts(factionGames),
      recentGames: factionRecentGames,
      bestMoments: getFactionBestMoments(factionRecentGames),
      matchups: matchups.rows,
      matchupSummary: matchups.overall,
      armyLists: getFactionArmyLists(faction.name, armyLists)
    }};
  });
  return profiles;
}

function buildPublicDetailMissionProfiles_() {
  const summaries = buildMissionApiSummaries("event-current-league", "league");
  const recentGames = getAllRecentGameObjects();
  const leagueGames = getLeagueData();
  const profiles = {};
  summaries.forEach(function(mission) {
    const missionGames = getMissionRecentGames(mission.mission, recentGames);
    profiles[mission.mission] = { success: true, mission: {
      mission: mission.mission,
      games: mission.games,
      averageTP: mission.averageTP,
      averageOP: mission.averageOP,
      averageVP: mission.averageVP,
      firstTurnWinRate: mission.firstTurnWinRate,
      mostSuccessfulFaction: mission.mostSuccessfulFaction,
      lastPlayed: mission.lastPlayed,
      mostPlayedFaction: getMissionMostPlayedFaction(mission.mission, leagueGames),
      recentGames: missionGames,
      bestMoments: getMissionBestMoments(missionGames),
      divisionBreakdown: getMissionDivisionBreakdown(missionGames)
    }};
  });
  return profiles;
}

function validatePublicDetailProjectionSection_(artifact, section) {
  if (!artifact || !artifact.generatedAt) throw new Error("Public detail projection is invalid.");
  if (section === "games" && (!Array.isArray(artifact.games) || !Array.isArray(artifact.streams) || !Array.isArray(artifact.news)))
    throw new Error("Public game/community projection is invalid.");
  const value = section.indexOf("players:") === 0 ? artifact.players : artifact[section];
  if (section !== "games" && (!value || Array.isArray(value)))
    throw new Error("Public profile projection is invalid.");
}

function getOrCreatePublicDetailProjectionFile_() {
  const properties = PropertiesService.getScriptProperties();
  const existing = properties.getProperty(PUBLIC_DETAIL_PROJECTION_FILE_PROPERTY);
  if (existing) {
    try { return DriveApp.getFileById(existing); }
    catch (error) { properties.deleteProperty(PUBLIC_DETAIL_PROJECTION_FILE_PROPERTY); }
  }
  const file = DriveApp.createFile("Lobo Infinity Portal - Public Detail Projection.json", "{}", MimeType.PLAIN_TEXT);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  properties.setProperty(PUBLIC_DETAIL_PROJECTION_FILE_PROPERTY, file.getId());
  return file;
}

function getPublicDetailProjectionFileId_() {
  return PropertiesService.getScriptProperties().getProperty(PUBLIC_DETAIL_PROJECTION_FILE_PROPERTY) || "";
}

function savePublicDetailStream_(e) {
  const output = saveOperationsStream(e);
  markPublicDetailProjectionDirty_(["games"]);
  return output;
}

function deletePublicDetailStream_(e) {
  const output = deleteOperationsStream(e);
  markPublicDetailProjectionDirty_(["games"]);
  return output;
}

function savePublicDetailNews_(e) {
  const output = saveOperationsNews(e);
  markPublicDetailProjectionDirty_(["games"]);
  return output;
}

function deletePublicDetailNews_(e) {
  const output = deleteOperationsNews(e);
  markPublicDetailProjectionDirty_(["games"]);
  return output;
}
