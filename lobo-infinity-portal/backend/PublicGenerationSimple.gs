/*******************************************************
 * Simplified hourly-snapshot proof.
 *
 * Builds six explicit public domain datasets from one
 * frozen canonical read. It never publishes or promotes.
 *******************************************************/

const PUBLIC_GENERATION_SIMPLE_SCHEMA_VERSION = 2;
const PUBLIC_GENERATION_SIMPLE_ACTIVE_PROPERTY =
  "PUBLIC_GENERATION_SIMPLE_ACTIVE_BUILD";
const PUBLIC_GENERATION_SIMPLE_LATEST_PROPERTY =
  "PUBLIC_GENERATION_SIMPLE_LATEST_BUILD";

function runBuildSimplePublicGenerationCandidate() {
  const result = buildSimplePublicGenerationCandidate_();
  Logger.log("PUBLIC_GENERATION_SIMPLE_CANDIDATE " + JSON.stringify(result));
  return result;
}

function buildSimplePublicGenerationCandidate_() {
  const started = Date.now();
  const generation = formatPublicGenerationId_(new Date(started));
  const reservation = reserveSimplePublicGenerationBuild_(generation, started);
  let record = reservation.record;
  try {
    const storage = createPublicGenerationStorage_(generation);
    record.storage = storage.references;
    record.status = "building";
    writePublicGenerationBuildRecord_(storage, record);

    const frozen = captureSimplePublicGenerationInput_(generation);
    const canonicalReads = frozen.canonicalReadCount;
    delete frozen.canonicalReadCount;
    const frozenText = stablePublicGenerationJson_(frozen);
    const inputHash = sha256PublicGenerationText_(frozenText);
    const inputBytes = utf8PublicGenerationByteCount_(frozenText);
    const frozenFile = createImmutablePublicGenerationFile_(
      storage.internalFolder, "simple-frozen-input.json", frozenText
    );
    validatePersistedPublicGenerationText_(frozenFile, frozenText, inputHash, inputBytes);

    record.sourceCutoff = frozen.sourceCutoff;
    record.inputHash = inputHash;
    record.inputBytes = inputBytes;
    record.canonicalReads = canonicalReads;
    record.artifacts = {
      frozenInput: buildPublicGenerationFileReference_(frozenFile, inputHash, inputBytes)
    };
    record.completedStages = ["reserved", "frozen-input"];
    writePublicGenerationBuildRecord_(storage, record);

    const playerIdentityIndex = buildSimplePublicPlayerIdentityIndex_(frozen);
    const gameContext = buildSimplePublicGameContext_(frozen, playerIdentityIndex);
    const publicEvents = buildSimplePublicEvents_(frozen, gameContext);
    const publicPlayers = buildSimplePublicPlayers_(frozen, publicEvents, gameContext);
    const publicGames = buildSimplePublicGames_(frozen, publicPlayers, publicEvents, gameContext);
    const publicMissions = buildSimplePublicMissions_(gameContext);
    const publicFactions = buildSimplePublicFactions_(gameContext, publicPlayers);
    const publicStandings = buildSimplePublicStandings_(frozen, publicPlayers, gameContext);
    const datasets = {
      players: publicPlayers,
      games: publicGames,
      events: publicEvents,
      missions: publicMissions,
      factions: publicFactions,
      standings: publicStandings
    };
    Object.keys(datasets).forEach(function(section) {
      record.artifacts[section] = writeSimplePublicGenerationArtifact_(
        storage.candidateFolder, record, section, datasets[section]
      );
    });
    validateSimplePublicGenerationSemantics_(record, frozen, datasets, gameContext);

    const manifest = buildSimplePublicGenerationManifest_(record);
    const manifestText = stablePublicGenerationJson_(manifest);
    const manifestHash = sha256PublicGenerationText_(manifestText);
    const manifestBytes = utf8PublicGenerationByteCount_(manifestText);
    const manifestFile = createImmutablePublicGenerationFile_(
      storage.candidateFolder, "manifest.json", manifestText
    );
    validatePersistedPublicGenerationText_(manifestFile, manifestText, manifestHash, manifestBytes);
    record.artifacts.manifest = buildPublicGenerationFileReference_(
      manifestFile, manifestHash, manifestBytes
    );
    validatePublicGenerationCandidateIsolation_([
      record.artifacts.players.fileId,
      record.artifacts.games.fileId,
      record.artifacts.events.fileId,
      record.artifacts.missions.fileId,
      record.artifacts.factions.fileId,
      record.artifacts.standings.fileId,
      record.artifacts.manifest.fileId
    ]);
    record.status = "validated";
    record.completedAt = new Date().toISOString();
    record.completedStages = ["reserved", "frozen-input", "public-datasets", "validation"];
    record.published = false;
    record.livePointer = false;
    record.metrics = {
      elapsedMs: Date.now() - started,
      lockHoldMs: reservation.lockHoldMs,
      canonicalReads: canonicalReads,
      driveWrites: 9,
      frozenGamePasses: 1,
      totalPublicBytes: record.artifacts.players.byteCount +
        record.artifacts.games.byteCount + record.artifacts.events.byteCount +
        record.artifacts.missions.byteCount + record.artifacts.factions.byteCount +
        record.artifacts.standings.byteCount
    };
    writePublicGenerationBuildRecord_(storage, record);
    completeSimplePublicGenerationBuild_(record);
    return simplePublicGenerationStatus_(record, true);
  }
  catch (error) {
    record.status = "failed";
    record.lastError = String(error && error.message ? error.message : error).slice(0, 500);
    failSimplePublicGenerationBuild_(record);
    const result = simplePublicGenerationStatus_(record, false);
    result.error = record.lastError;
    Logger.log("PUBLIC_GENERATION_SIMPLE_CANDIDATE_FAILED " + JSON.stringify(result));
    return result;
  }
}

function reserveSimplePublicGenerationBuild_(generation, started) {
  const lockStarted = Date.now();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("Simple generation reservation lock is busy.");
  try {
    const properties = PropertiesService.getScriptProperties();
    const active = properties.getProperty(PUBLIC_GENERATION_SIMPLE_ACTIVE_PROPERTY);
    if (active) throw new Error("A simplified public generation build is already active.");
    const record = {
      schemaVersion: PUBLIC_GENERATION_SIMPLE_SCHEMA_VERSION,
      buildType: "simple-public-generation",
      generation: generation,
      status: "reserved",
      startedAt: new Date(started).toISOString(),
      completedStages: ["reserved"],
      published: false,
      livePointer: false
    };
    properties.setProperty(PUBLIC_GENERATION_SIMPLE_ACTIVE_PROPERTY, JSON.stringify(record));
    return { record: record, lockHoldMs: Date.now() - lockStarted };
  }
  finally { lock.releaseLock(); }
}

function captureSimplePublicGenerationInput_(generation) {
  const spreadsheet = lifGetTargetSpreadsheet_();
  const gamesTable = readPublicGenerationSheet_(spreadsheet, CONFIG.SHEETS.FORM);
  const playersTable = readPublicGenerationSheet_(spreadsheet, CONFIG.SHEETS.PLAYERS);
  const eventsTable = readPublicGenerationSheet_(spreadsheet, CONFIG.SHEETS.EVENTS);
  const participantsTable = readPublicGenerationSheet_(spreadsheet, CONFIG.SHEETS.EVENT_PARTICIPANTS);
  const availabilityTable = readPublicGenerationSheet_(spreadsheet, CONFIG.SHEETS.SEASON_AVAILABILITY);
  return {
    schemaVersion: PUBLIC_GENERATION_SIMPLE_SCHEMA_VERSION,
    generation: generation,
    sourceCutoff: new Date().toISOString(),
    canonicalReadCount: 5,
    gamesTable: freezeSimplePublicGenerationTable_(gamesTable),
    playersTable: freezeSimplePublicGenerationTable_(playersTable),
    eventsTable: freezeSimplePublicGenerationTable_(eventsTable),
    participantsTable: freezeSimplePublicGenerationTable_(participantsTable),
    availabilityTable: freezeSimplePublicGenerationTable_(availabilityTable)
  };
}

function freezeSimplePublicGenerationTable_(table) {
  return {
    headers: (table.headers || []).map(normalizePublicGenerationValue_),
    rows: (table.rows || []).map(function(row) {
      return row.map(normalizePublicGenerationValue_);
    })
  };
}

function simplePublicGenerationColumns_(headers) {
  const output = {};
  (headers || []).forEach(function(header, index) {
    output[String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "")] = index;
  });
  return output;
}

function simplePublicGenerationValue_(row, columns, labels) {
  for (let index = 0; index < labels.length; index += 1) {
    const key = String(labels[index]).toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (columns[key] !== undefined) return String(row[columns[key]] || "").trim();
  }
  return "";
}

function normalizeSimplePublicPlayerIdentity_(value) {
  return typeof getCommunityPlayerKey === "function"
    ? getCommunityPlayerKey(value)
    : String(value || "").trim().toLowerCase();
}

function buildSimplePublicPlayerIdentityIndex_(frozen) {
  const columns = getPlayerRegistryColumns(frozen.playersTable.headers || []);
  const index = {};
  (frozen.playersTable.rows || []).forEach(function(row) {
    const player = String(row[columns.player] || "").trim();
    if (!player) return;
    const key = normalizeSimplePublicPlayerIdentity_(player);
    if (index[key] && index[key].player !== player)
      throw new Error("Frozen Player Registry contains a normalized identity collision: " + player);
    index[key] = {
      player: player,
      displayName: String(columns.displayName >= 0 ? row[columns.displayName] || player : player).trim()
    };
  });
  return index;
}

function resolveSimplePublicPlayerIdentity_(identityIndex, rawIdentity, gameId) {
  const resolved = identityIndex[normalizeSimplePublicPlayerIdentity_(rawIdentity)];
  if (!resolved)
    throw new Error("Frozen Game player does not resolve to the Player Registry for Game " +
      gameId + ": " + String(rawIdentity || "").trim());
  return resolved;
}

function buildSimplePublicGameContext_(frozen, playerIdentityIndex) {
  const identityIndex = playerIdentityIndex || buildSimplePublicPlayerIdentityIndex_(frozen);
  return (frozen.gamesTable.rows || []).map(function(row, index) {
    const game = sanitizePublicGenerationGame_(row, index + 2);
    if (!game.player1 || !game.player2) return null;
    const rawPlayer1 = game.player1;
    const rawPlayer2 = game.player2;
    const player1 = resolveSimplePublicPlayerIdentity_(identityIndex, rawPlayer1, game.gameId);
    const player2 = resolveSimplePublicPlayerIdentity_(identityIndex, rawPlayer2, game.gameId);
    const winnerKey = normalizeSimplePublicPlayerIdentity_(game.winner);
    game.player1 = player1.player;
    game.player1DisplayName = player1.displayName;
    game.player2 = player2.player;
    game.player2DisplayName = player2.displayName;
    if (winnerKey !== "draw") {
      if (winnerKey === normalizeSimplePublicPlayerIdentity_(rawPlayer1)) game.winner = player1.player;
      else if (winnerKey === normalizeSimplePublicPlayerIdentity_(rawPlayer2)) game.winner = player2.player;
      else throw new Error("Frozen Game winner does not match either participant for Game " + game.gameId);
    }
    game.eventId = String(game.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID).trim();
    game.bestMoment = String(row[FORM.MOMENT] || "");
    game.firstTurn = String(row[FORM.FIRSTTURN] || "");
    return game;
  }).filter(Boolean);
}

function buildSimplePublicGames_(frozen, players, events, gameContext) {
  const eventNames = {};
  events.forEach(function(event) { eventNames[event.id] = event.name; });
  return (gameContext || buildSimplePublicGameContext_(frozen)).map(function(source) {
    const winnerIsPlayer1 = source.winner === source.player1;
    const draw = source.winner === "Draw";
    const loser = draw ? "Draw" : winnerIsPlayer1 ? source.player2 : source.player1;
    const winnerDisplayName = winnerIsPlayer1
      ? source.player1DisplayName : source.player2DisplayName;
    const loserDisplayName = winnerIsPlayer1
      ? source.player2DisplayName : source.player1DisplayName;
    const winnerFaction = draw ? source.player1Faction : winnerIsPlayer1 ? source.player1Faction : source.player2Faction;
    const loserFaction = draw ? source.player2Faction : winnerIsPlayer1 ? source.player2Faction : source.player1Faction;
    const winnerArmyListId = draw ? source.player1ArmyListId : winnerIsPlayer1 ? source.player1ArmyListId : source.player2ArmyListId;
    const loserArmyListId = draw ? source.player2ArmyListId : winnerIsPlayer1 ? source.player2ArmyListId : source.player1ArmyListId;
    const game = {
      id: source.gameId,
      eventId: source.eventId,
      eventName: eventNames[source.eventId] || "",
      gameType: source.gameType,
      date: source.date,
      division: source.division,
      winner: source.winner,
      winnerDisplayName: draw ? "Draw" : winnerDisplayName,
      loser: loser,
      loserDisplayName: draw ? "Draw" : loserDisplayName,
      winnerFaction: winnerFaction,
      loserFaction: loserFaction,
      mission: source.mission,
      tp: (winnerIsPlayer1 || draw ? source.player1Tp : source.player2Tp) + "–" +
        (winnerIsPlayer1 || draw ? source.player2Tp : source.player1Tp),
      op: (winnerIsPlayer1 || draw ? source.player1Op : source.player2Op) + "–" +
        (winnerIsPlayer1 || draw ? source.player2Op : source.player1Op),
      vp: (winnerIsPlayer1 || draw ? source.player1Vp : source.player2Vp) + "–" +
        (winnerIsPlayer1 || draw ? source.player2Vp : source.player1Vp),
      bestMoment: source.bestMoment,
      firstTurn: source.firstTurn,
      winnerArmyListId: winnerArmyListId,
      loserArmyListId: loserArmyListId
    };
    return game;
  });
}

function buildSimplePublicPlayers_(frozen, events, gameContext) {
  const registryColumns = getPlayerRegistryColumns(frozen.playersTable.headers || []);
  const records = {};
  (frozen.playersTable.rows || []).forEach(function(row) {
    const player = String(row[registryColumns.player] || "").trim();
    if (!player) return;
    records[player.toLowerCase()] = {
      player: player,
      displayName: String(registryColumns.displayName >= 0 ? row[registryColumns.displayName] || player : player),
      division: String(row[registryColumns.division] || ""),
      active: String(row[registryColumns.active] || "").toLowerCase() === "true",
      results: [], factionCounts: {}, missionCounts: {}, opponentCounts: {}
    };
  });
  (gameContext || buildSimplePublicGameContext_(frozen)).forEach(function(game) {
    addSimplePublicPlayerGame_(records, game, game.player1, game.player2, 1);
    addSimplePublicPlayerGame_(records, game, game.player2, game.player1, 2);
  });
  const availability = buildSimplePublicAvailabilityMap_(frozen.availabilityTable);
  const registrations = buildSimplePublicRegistrationMap_(frozen.participantsTable, events || []);
  const divisions = {};
  Object.keys(records).forEach(function(key) {
    const division = records[key].division || "Community";
    if (!divisions[division]) divisions[division] = [];
    divisions[division].push(records[key]);
  });
  Object.keys(divisions).forEach(function(division) {
    divisions[division].sort(compareSimplePublicPlayerRecords_);
    divisions[division].forEach(function(record, index) { record.rank = index + 1; });
  });
  return Object.keys(records).sort().map(function(key) {
    return finalizeSimplePublicPlayer_(
      records[key], availability[key] || {}, registrations[key] || [], frozen.sourceCutoff
    );
  });
}

function addSimplePublicPlayerGame_(records, game, player, opponent, side) {
  const key = String(player).toLowerCase();
  if (!records[key]) return;
  const record = records[key];
  const draw = game.winner === "Draw";
  const won = game.winner === player;
  const faction = side === 1 ? game.player1Faction : game.player2Faction;
  const tp = side === 1 ? game.player1Tp : game.player2Tp;
  const op = side === 1 ? game.player1Op : game.player2Op;
  const vp = side === 1 ? game.player1Vp : game.player2Vp;
  const opponentVp = side === 1 ? game.player2Vp : game.player1Vp;
  const date = game.date;
  record.results.push({
    won: won, draw: draw, date: date, gameType: game.gameType,
    tp: tp, op: op, vp: vp, opponentVp: opponentVp,
    faction: faction, mission: game.mission
  });
  record.factionCounts[faction] = (record.factionCounts[faction] || 0) + 1;
  record.missionCounts[game.mission] = (record.missionCounts[game.mission] || 0) + 1;
  const opponentKey = String(opponent);
  if (!record.opponentCounts[opponentKey]) record.opponentCounts[opponentKey] = { games: 0, losses: 0 };
  record.opponentCounts[opponentKey].games += 1;
  if (!won && !draw) record.opponentCounts[opponentKey].losses += 1;
}

function compareSimplePublicPlayerRecords_(left, right) {
  function totals(record) {
    return record.results.reduce(function(out, game) {
      out.tp += game.tp; out.op += game.op; out.vp += game.vp; return out;
    }, { tp: 0, op: 0, vp: 0 });
  }
  const a = totals(left); const b = totals(right);
  return b.tp - a.tp || b.op - a.op || b.vp - a.vp || left.player.localeCompare(right.player);
}

function mostFrequentSimplePublicValue_(counts) {
  return Object.keys(counts || {}).sort(function(left, right) {
    return counts[right] - counts[left] || left.localeCompare(right);
  })[0] || "";
}

function finalizeSimplePublicPlayer_(record, availability, registrations, sourceCutoff) {
  const results = record.results;
  const games = results.length;
  const wins = results.filter(function(result) { return result.won; }).length;
  const draws = results.filter(function(result) { return result.draw; }).length;
  const losses = games - wins - draws;
  const sums = results.reduce(function(out, game) {
    out.tp += game.tp; out.op += game.op; out.vp += game.vp; return out;
  }, { tp: 0, op: 0, vp: 0 });
  const favoriteFaction = mostFrequentSimplePublicValue_(record.factionCounts);
  const favoriteMission = mostFrequentSimplePublicValue_(record.missionCounts);
  const rival = mostFrequentSimplePublicValue_(Object.keys(record.opponentCounts).reduce(function(out, key) {
    out[key] = record.opponentCounts[key].games; return out;
  }, {}));
  const nemesis = Object.keys(record.opponentCounts).sort(function(left, right) {
    return record.opponentCounts[right].losses - record.opponentCounts[left].losses || left.localeCompare(right);
  })[0] || "";
  let streak = 0;
  results.slice().sort(function(a, b) { return String(b.date).localeCompare(String(a.date)); }).some(function(result) {
    if (!result.won) return true;
    streak += 1; return false;
  });
  const summaries = {};
  ["League", "Tournament", "Casual"].forEach(function(type) {
    const subset = results.filter(function(result) { return String(result.gameType).toLowerCase() === type.toLowerCase(); });
    const typeWins = subset.filter(function(result) { return result.won; }).length;
    const typeDraws = subset.filter(function(result) { return result.draw; }).length;
    summaries[type.toLowerCase()] = {
      games: subset.length, wins: typeWins, losses: subset.length - typeWins - typeDraws,
      draws: typeDraws, winPercentage: subset.length ? Math.round(typeWins * 1000 / subset.length) / 10 : 0
    };
  });
  const armyMetrics = buildSimplePublicMetricGroup_(results, "faction", favoriteFaction);
  const missionMetrics = buildSimplePublicMetricGroup_(results, "mission", favoriteMission);
  return {
    player: record.player,
    displayName: record.displayName,
    division: record.division,
    divisionLabel: record.division,
    rank: record.rank || 0,
    games: games, wins: wins, losses: losses, draws: draws,
    tp: sums.tp, op: sums.op, vp: sums.vp,
    faction: favoriteFaction,
    favoriteFaction: favoriteFaction,
    favoriteArmy: favoriteFaction,
    lastActive: results.reduce(function(value, result) { return String(result.date) > value ? String(result.date) : value; }, ""),
    statusBadges: record.active ? ["League Player"] : games ? ["Casual Player"] : ["New Player"],
    city: availability.city || "",
    homeStore: availability.homeStore || "",
    availability: availability.availability || {},
    favoriteMission: favoriteMission,
    bestMission: favoriteMission,
    bestFaction: favoriteFaction,
    rival: rival,
    nemesis: nemesis,
    careerSummary: {
      totalGames: games,
      winPercentage: games ? Math.round(wins * 1000 / games) / 10 : 0,
      currentWinStreak: streak,
      longestWinStreak: calculateSimplePublicLongestWinStreak_(results),
      gamesThisMonth: calculateSimplePublicGamesThisMonth_(results, sourceCutoff),
      records: summaries,
      armies: armyMetrics,
      missions: missionMetrics,
      quickStats: {
        highestVpGame: results.reduce(function(value, result) { return Math.max(value, result.vp); }, 0),
        biggestVictory: results.reduce(function(value, result) {
          return Math.max(value, result.vp - result.opponentVp);
        }, 0),
        mostPlayedArmy: favoriteFaction,
        mostPlayedArmyParentFaction: "",
        mostPlayedMission: favoriteMission
      }
    },
    registeredEvents: registrations
  };
}

function buildSimplePublicMetric_(label, results) {
  const wins = results.filter(function(result) { return result.won; }).length;
  const draws = results.filter(function(result) { return result.draw; }).length;
  return {
    label: label,
    games: results.length,
    wins: wins,
    losses: results.length - wins - draws,
    draws: draws,
    winPercentage: results.length ? Math.round(wins * 1000 / results.length) / 10 : 0,
    lastPlayed: results.reduce(function(value, result) {
      return String(result.date) > value ? String(result.date) : value;
    }, "")
  };
}

function buildSimplePublicMetricGroup_(results, field, favoriteLabel) {
  const grouped = {};
  results.forEach(function(result) {
    const label = String(result[field] || "");
    if (!label) return;
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(result);
  });
  const labels = Object.keys(grouped);
  const favorite = buildSimplePublicMetric_(favoriteLabel, grouped[favoriteLabel] || []);
  const bestLabel = labels.sort(function(left, right) {
    const leftMetric = buildSimplePublicMetric_(left, grouped[left]);
    const rightMetric = buildSimplePublicMetric_(right, grouped[right]);
    return rightMetric.winPercentage - leftMetric.winPercentage ||
      rightMetric.games - leftMetric.games || left.localeCompare(right);
  })[0] || "";
  const recentLabel = Object.keys(grouped).sort(function(left, right) {
    return buildSimplePublicMetric_(right, grouped[right]).lastPlayed.localeCompare(
      buildSimplePublicMetric_(left, grouped[left]).lastPlayed
    ) || left.localeCompare(right);
  })[0] || "";
  return {
    favorite: favorite,
    best: buildSimplePublicMetric_(bestLabel, grouped[bestLabel] || []),
    mostRecent: buildSimplePublicMetric_(recentLabel, grouped[recentLabel] || [])
  };
}

function calculateSimplePublicLongestWinStreak_(results) {
  let longest = 0; let current = 0;
  results.slice().sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function(result) {
    current = result.won ? current + 1 : 0; longest = Math.max(longest, current);
  });
  return longest;
}

function calculateSimplePublicGamesThisMonth_(results, sourceCutoff) {
  const month = String(sourceCutoff || "").slice(0, 7);
  return results.filter(function(result) { return String(result.date).slice(0, 7) === month; }).length;
}

function buildSimplePublicAvailabilityMap_(table) {
  const columns = simplePublicGenerationColumns_(table.headers || []); const output = {};
  (table.rows || []).forEach(function(row) {
    const player = simplePublicGenerationValue_(row, columns, ["player", "player name"]);
    if (!player) return;
    output[player.toLowerCase()] = {
      city: simplePublicGenerationValue_(row, columns, ["city"]),
      homeStore: simplePublicGenerationValue_(row, columns, ["home store", "preferred store"]),
      availability: {}
    };
  });
  return output;
}

function buildSimplePublicRegistrationMap_(table, events) {
  const columns = simplePublicGenerationColumns_(table.headers || []); const output = {};
  const eventNames = {};
  (events || []).forEach(function(event) { eventNames[event.id] = event.name; });
  (table.rows || []).forEach(function(row) {
    const player = simplePublicGenerationValue_(row, columns, ["player", "player id", "player name"]);
    if (!player) return;
    const item = {
      eventId: simplePublicGenerationValue_(row, columns, ["event id"]),
      eventName: simplePublicGenerationValue_(row, columns, ["event name"]) ||
        eventNames[simplePublicGenerationValue_(row, columns, ["event id"])] || "",
      eventType: simplePublicGenerationValue_(row, columns, ["event type"]),
      preferredTeam: simplePublicGenerationValue_(row, columns, ["preferred team"]),
      registeredAt: simplePublicGenerationValue_(row, columns, ["registered at", "created at"]),
      status: simplePublicGenerationValue_(row, columns, ["status"]),
      team: simplePublicGenerationValue_(row, columns, ["team", "team name"]),
      updatedAt: simplePublicGenerationValue_(row, columns, ["updated at"])
    };
    if (!output[player.toLowerCase()]) output[player.toLowerCase()] = [];
    output[player.toLowerCase()].push(item);
  });
  return output;
}

function buildSimplePublicEvents_(frozen, gameContext) {
  const columns = simplePublicGenerationColumns_(frozen.eventsTable.headers || []);
  const games = gameContext || buildSimplePublicGameContext_(frozen);
  return (frozen.eventsTable.rows || []).map(function(row) {
    const id = simplePublicGenerationValue_(row, columns, ["id", "event id"]);
    if (!id) return null;
    const eventGames = games.filter(function(game) { return game.eventId === id; });
    const registeredCount = (frozen.participantsTable.rows || []).filter(function(participant) {
      const participantColumns = simplePublicGenerationColumns_(frozen.participantsTable.headers || []);
      return simplePublicGenerationValue_(participant, participantColumns, ["event id"]) === id;
    }).length;
    const registration = parsePublicGenerationJson_(
      simplePublicGenerationValue_(row, columns, ["registration"]), {}
    ) || {};
    return {
      id: id,
      name: simplePublicGenerationValue_(row, columns, ["name"]),
      description: simplePublicGenerationValue_(row, columns, ["description"]),
      type: simplePublicGenerationValue_(row, columns, ["type"]),
      lifecycleStage: simplePublicGenerationValue_(row, columns, ["lifecycle stage", "lifecyclestage"]),
      status: simplePublicGenerationValue_(row, columns, ["status"]),
      startDate: simplePublicGenerationValue_(row, columns, ["start date", "startdate"]),
      endDate: simplePublicGenerationValue_(row, columns, ["end date", "enddate"]),
      rules: simplePublicGenerationValue_(row, columns, ["rules"]),
      scoringModel: simplePublicGenerationValue_(row, columns, ["scoring model", "scoringmodel"]),
      standingsModel: simplePublicGenerationValue_(row, columns, ["standings model", "standingsmodel"]),
      registrationOpen: registration.registrationOpen === true,
      registrationWindow: String(registration.registrationWindow || ""),
      capacity: Number(registration.capacity) || 0,
      registeredCount: registeredCount,
      waitlistCount: 0,
      completedGames: eventGames.length,
      completionPercentage: 0,
      currentRound: simplePublicGenerationValue_(row, columns, ["current round", "currentround"]),
      gamesRemaining: 0,
      registeredPlayers: registeredCount,
      registrationStatus: String(registration.status || ""),
      teams: 0,
      navigation: [],
      news: [],
      timeline: []
    };
  }).filter(Boolean);
}

function simplePublicPercentage_(value, total) {
  return total ? Math.round(value * 1000 / total) / 10 : 0;
}

function simplePublicAverage_(value, total) {
  return total ? Math.round(value * 10 / total) / 10 : 0;
}

function simplePublicMostFrequent_(counts) {
  return Object.keys(counts || {}).sort(function(left, right) {
    return counts[right] - counts[left] || left.localeCompare(right);
  })[0] || "";
}

function simplePublicGameReferences_(games) {
  return games.slice().sort(function(left, right) {
    return String(right.date).localeCompare(String(left.date)) || right.gameId - left.gameId;
  }).slice(0, 10).map(function(game) { return { id: game.gameId }; });
}

function buildSimplePublicMissions_(gameContext) {
  const groups = {};
  (gameContext || []).forEach(function(game) {
    if (!game.mission) return;
    if (!groups[game.mission]) groups[game.mission] = [];
    groups[game.mission].push(game);
  });
  return Object.keys(groups).sort().map(function(mission) {
    const games = groups[mission];
    const divisions = {}; const factionGames = {}; const factionWins = {};
    let tp = 0; let op = 0; let vp = 0; let firstTurnWins = 0;
    games.forEach(function(game) {
      divisions[game.division] = (divisions[game.division] || 0) + 1;
      [game.player1Faction, game.player2Faction].forEach(function(faction) {
        if (faction) factionGames[faction] = (factionGames[faction] || 0) + 1;
      });
      const winnerFaction = game.winner === game.player1 ? game.player1Faction :
        game.winner === game.player2 ? game.player2Faction : "";
      if (winnerFaction) factionWins[winnerFaction] = (factionWins[winnerFaction] || 0) + 1;
      tp += game.player1Tp + game.player2Tp;
      op += game.player1Op + game.player2Op;
      vp += game.player1Vp + game.player2Vp;
      const firstTurnPlayer = game.firstTurn === "Player 1" ? game.player1 :
        game.firstTurn === "Player 2" ? game.player2 : game.firstTurn;
      if (firstTurnPlayer && firstTurnPlayer === game.winner) firstTurnWins += 1;
    });
    const mostSuccessfulFaction = Object.keys(factionGames).sort(function(left, right) {
      const leftRate = factionWins[left] / factionGames[left];
      const rightRate = factionWins[right] / factionGames[right];
      return rightRate - leftRate || factionGames[right] - factionGames[left] || left.localeCompare(right);
    })[0] || "";
    return {
      mission: mission,
      games: games.length,
      averageTP: simplePublicAverage_(tp, games.length * 2),
      averageOP: simplePublicAverage_(op, games.length * 2),
      averageVP: simplePublicAverage_(vp, games.length * 2),
      firstTurnWinRate: simplePublicPercentage_(firstTurnWins, games.length),
      mostSuccessfulFaction: mostSuccessfulFaction,
      mostPlayedFaction: simplePublicMostFrequent_(factionGames),
      lastPlayed: games.reduce(function(value, game) { return String(game.date) > value ? String(game.date) : value; }, ""),
      divisionBreakdown: Object.keys(divisions).sort().map(function(division) {
        return { division: division, games: divisions[division] };
      }),
      recentGames: simplePublicGameReferences_(games),
      bestMoments: games.filter(function(game) { return game.bestMoment; }).map(function(game) {
        return { gameId: game.gameId, date: game.date, mission: game.mission, moment: game.bestMoment };
      })
    };
  });
}

function addSimplePublicFactionResult_(groups, game, side) {
  const faction = side === 1 ? game.player1Faction : game.player2Faction;
  if (!faction) return;
  if (!groups[faction]) groups[faction] = [];
  const player = side === 1 ? game.player1 : game.player2;
  const opponentFaction = side === 1 ? game.player2Faction : game.player1Faction;
  groups[faction].push({
    game: game, player: player, opponentFaction: opponentFaction,
    won: game.winner === player, draw: game.winner === "Draw",
    tp: side === 1 ? game.player1Tp : game.player2Tp,
    op: side === 1 ? game.player1Op : game.player2Op,
    vp: side === 1 ? game.player1Vp : game.player2Vp
  });
}

function summarizeSimplePublicFactionResults_(results) {
  const wins = results.filter(function(result) { return result.won; }).length;
  const draws = results.filter(function(result) { return result.draw; }).length;
  const sums = results.reduce(function(out, result) {
    out.tp += result.tp; out.op += result.op; out.vp += result.vp; return out;
  }, { tp: 0, op: 0, vp: 0 });
  return {
    games: results.length, wins: wins, losses: results.length - wins - draws, draws: draws,
    winRate: simplePublicPercentage_(wins, results.length),
    averageTP: simplePublicAverage_(sums.tp, results.length),
    averageOP: simplePublicAverage_(sums.op, results.length),
    averageVP: simplePublicAverage_(sums.vp, results.length)
  };
}

function buildSimplePublicFactions_(gameContext, players) {
  const groups = {}; const displayNames = {};
  (players || []).forEach(function(player) { displayNames[player.player.toLowerCase()] = player.displayName; });
  (gameContext || []).forEach(function(game) {
    addSimplePublicFactionResult_(groups, game, 1);
    addSimplePublicFactionResult_(groups, game, 2);
  });
  return Object.keys(groups).sort().map(function(name) {
    const results = groups[name]; const summary = summarizeSimplePublicFactionResults_(results);
    const divisions = {}; const missions = {}; const playersByName = {}; const matchups = {};
    results.forEach(function(result) {
      const game = result.game;
      divisions[game.division] = (divisions[game.division] || 0) + 1;
      missions[game.mission] = (missions[game.mission] || 0) + 1;
      if (!playersByName[result.player]) playersByName[result.player] = [];
      playersByName[result.player].push(result);
      if (!matchups[result.opponentFaction]) matchups[result.opponentFaction] = [];
      matchups[result.opponentFaction].push(result);
    });
    const topPlayer = Object.keys(playersByName).sort(function(left, right) {
      const a = summarizeSimplePublicFactionResults_(playersByName[left]);
      const b = summarizeSimplePublicFactionResults_(playersByName[right]);
      return b.wins - a.wins || b.games - a.games || left.localeCompare(right);
    })[0] || "";
    const matchupRows = Object.keys(matchups).filter(Boolean).sort().map(function(opponent) {
      const row = summarizeSimplePublicFactionResults_(matchups[opponent]);
      row.opponent = opponent; return row;
    });
    const bestOpponent = matchupRows.slice().sort(function(left, right) {
      return right.winRate - left.winRate || right.games - left.games || left.opponent.localeCompare(right.opponent);
    })[0];
    return {
      name: name,
      games: summary.games, wins: summary.wins, losses: summary.losses, draws: summary.draws,
      winRate: summary.winRate, averageTP: summary.averageTP,
      averageOP: summary.averageOP, averageVP: summary.averageVP,
      topPlayer: topPlayer,
      topPlayerDisplayName: displayNames[topPlayer.toLowerCase()] || topPlayer,
      lastPlayed: results.reduce(function(value, result) {
        return String(result.game.date) > value ? String(result.game.date) : value;
      }, ""),
      mostPlayedMission: simplePublicMostFrequent_(missions),
      divisionBreakdown: Object.keys(divisions).sort().map(function(division) {
        return { division: division, games: divisions[division] };
      }),
      recentGames: simplePublicGameReferences_(results.map(function(result) { return result.game; })),
      bestMoments: results.filter(function(result) { return result.game.bestMoment; }).map(function(result) {
        return { gameId: result.game.gameId, date: result.game.date,
          mission: result.game.mission, moment: result.game.bestMoment };
      }),
      matchups: matchupRows,
      matchupSummary: {
        opponents: matchupRows.length,
        games: summary.games, wins: summary.wins, losses: summary.losses, draws: summary.draws,
        winRate: summary.winRate,
        bestOpponent: bestOpponent ? bestOpponent.opponent : ""
      }
    };
  });
}

function isSimplePublicCurrentLeagueGame_(game) {
  const eventId = String(game.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID).trim();
  const gameType = typeof normalizeGameType === "function" ? normalizeGameType(game.gameType) :
    String(game.gameType || "league").trim().toLowerCase() || "league";
  return eventId === EVENT_ENGINE_DEFAULT_EVENT_ID && gameType === "league";
}

function buildSimplePublicStandings_(frozen, players, gameContext) {
  const registryColumns = getPlayerRegistryColumns(frozen.playersTable.headers || []);
  const displayNames = {}; const records = {};
  (players || []).forEach(function(player) { displayNames[player.player.toLowerCase()] = player.displayName; });
  (frozen.playersTable.rows || []).forEach(function(row) {
    const player = String(row[registryColumns.player] || "").trim();
    const active = String(row[registryColumns.active] || "").toLowerCase() === "true";
    if (!player || !active) return;
    records[player.toLowerCase()] = {
      player: player, displayName: displayNames[player.toLowerCase()] || player,
      division: String(row[registryColumns.division] || ""),
      active: true,
      games: 0, wins: 0, losses: 0, draws: 0, tp: 0, op: 0, vp: 0, gameIds: {}
    };
  });
  (gameContext || []).filter(isSimplePublicCurrentLeagueGame_).forEach(function(game) {
    [[game.player1, 1], [game.player2, 2]].forEach(function(tuple) {
      const record = records[String(tuple[0]).toLowerCase()];
      if (!record) return;
      const side = tuple[1]; const draw = game.winner === "Draw";
      record.games += 1;
      if (draw) record.draws += 1; else if (game.winner === record.player) record.wins += 1;
      else record.losses += 1;
      record.tp += side === 1 ? game.player1Tp : game.player2Tp;
      record.op += side === 1 ? game.player1Op : game.player2Op;
      record.vp += side === 1 ? game.player1Vp : game.player2Vp;
      record.gameIds[game.gameId] = true;
    });
  });
  const divisions = [CONFIG.DIVISIONS.MAIN_MAN, CONFIG.DIVISIONS.PGA, CONFIG.DIVISIONS.PGB];
  return divisions.map(function(division) {
    const members = Object.keys(records).map(function(key) { return records[key]; })
      .filter(function(record) { return record.division === division; });
    members.sort(function(left, right) {
      return right.tp - left.tp || right.op - left.op || right.vp - left.vp ||
        left.player.localeCompare(right.player);
    });
    const gameIds = {};
    const standings = members.map(function(record, index) {
      Object.keys(record.gameIds).forEach(function(id) { gameIds[id] = true; });
      return { rank: index + 1, player: record.player, displayName: record.displayName,
        games: record.games, wins: record.wins, losses: record.losses, draws: record.draws,
        tp: record.tp, op: record.op, vp: record.vp };
    });
    return {
      eventId: EVENT_ENGINE_DEFAULT_EVENT_ID,
      division: division, divisionLabel: division,
      players: standings.length,
      activePlayers: members.filter(function(record) { return record.active; }).length,
      gamesPlayed: Object.keys(gameIds).length,
      standings: standings
    };
  });
}

function writeSimplePublicGenerationArtifact_(folder, record, section, rows) {
  const artifact = {
    schemaVersion: PUBLIC_GENERATION_SIMPLE_SCHEMA_VERSION,
    generation: record.generation,
    sourceGeneration: record.generation,
    sourceCutoff: record.sourceCutoff,
    section: section,
    count: rows.length,
    data: rows
  };
  assertNoForbiddenPublicGenerationKeys_(artifact, section);
  const text = stablePublicGenerationJson_(artifact);
  const hash = sha256PublicGenerationText_(text);
  const bytes = utf8PublicGenerationByteCount_(text);
  const file = createImmutablePublicGenerationFile_(folder, section + ".json", text);
  validatePersistedPublicGenerationText_(file, text, hash, bytes);
  return {
    fileId: file.getId(), artifact: section + ".json", contentHash: hash,
    byteCount: bytes, sourceGeneration: record.generation, required: true, readBack: true
  };
}

function buildSimplePublicGenerationManifest_(record) {
  const sections = {};
  ["players", "games", "events", "missions", "factions", "standings"].forEach(function(section) {
    const ref = record.artifacts[section];
    sections[section] = {
      artifact: ref.artifact, fileId: ref.fileId, contentHash: ref.contentHash,
      byteCount: ref.byteCount, sourceGeneration: record.generation, required: true
    };
  });
  return {
    schemaVersion: PUBLIC_GENERATION_SIMPLE_SCHEMA_VERSION,
    generation: record.generation,
    sourceCutoff: record.sourceCutoff,
    generatedAt: new Date().toISOString(),
    status: "candidate",
    published: false,
    livePointer: false,
    sections: sections
  };
}

function validateSimplePublicGenerationSemantics_(record, frozen, datasets, gameContext) {
  if (!record.sourceCutoff || record.inputHash !== sha256PublicGenerationText_(stablePublicGenerationJson_(frozen)))
    throw new Error("Simple generation frozen input validation failed.");
  [["Player", datasets.players, "player"], ["Game", datasets.games, "id"],
    ["Event", datasets.events, "id"], ["Mission", datasets.missions, "mission"],
    ["Faction", datasets.factions, "name"], ["Standings division", datasets.standings, "division"]]
    .forEach(function(tuple) {
      const seen = {};
      tuple[1].forEach(function(value) {
        const id = String(value[tuple[2]]);
        if (!id || seen[id]) throw new Error(tuple[0] + " identities are not unique.");
        seen[id] = true;
      });
    });
  const game73 = datasets.games.filter(function(game) { return Number(game.id) === 73; });
  if (game73.length !== 1 || game73[0].winner !== "Lobo" || game73[0].loser !== "Nighthawkmk2" ||
      game73[0].mission !== "Dead Man's Switch" || game73[0].tp !== "5–0" ||
      game73[0].op !== "8–1" || game73[0].vp !== "262–122" ||
      game73[0].winnerArmyListId !== "3296098999" || game73[0].loserArmyListId !== "4483300877")
    throw new Error("Simple generation Game 73 fixture failed.");
  ["Lobo", "Nighthawkmk2", "Vision", "Igor Your Humble Servant"].forEach(function(name) {
    if (!datasets.players.some(function(player) { return player.player === name; }))
      throw new Error("Representative public player is missing: " + name);
  });
  [EVENT_ENGINE_DEFAULT_EVENT_ID, TOP40_PUBLIC_EVENT_ID,
    EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID].forEach(function(id) {
    if (!datasets.events.some(function(event) { return event.id === id; }))
      throw new Error("Expected public event is missing: " + id);
  });
  const playerIds = {}; const eventIds = {}; const missionIds = {}; const factionIds = {};
  datasets.players.forEach(function(player) { playerIds[player.player] = true; });
  datasets.events.forEach(function(event) { eventIds[event.id] = true; });
  datasets.missions.forEach(function(mission) { missionIds[mission.mission] = true; });
  datasets.factions.forEach(function(faction) { factionIds[faction.name] = true; });
  datasets.games.forEach(function(game) {
    if (!playerIds[game.winner] || (game.loser !== "Draw" && !playerIds[game.loser]))
      throw new Error("Public Game player cross-reference failed: " + game.id);
    if (!eventIds[game.eventId] || !missionIds[game.mission] ||
        !factionIds[game.winnerFaction] || !factionIds[game.loserFaction])
      throw new Error("Public Game domain cross-reference failed: " + game.id);
  });
  datasets.standings.forEach(function(division) {
    division.standings.forEach(function(row) {
      if (!playerIds[row.player]) throw new Error("Public Standings player cross-reference failed: " + row.player);
    });
  });
  const mainMan = datasets.standings.filter(function(item) {
    return item.division === CONFIG.DIVISIONS.MAIN_MAN;
  })[0];
  const lobo = mainMan && mainMan.standings.filter(function(row) { return row.player === "Lobo"; })[0];
  const nighthawkmk2 = mainMan && mainMan.standings.filter(function(row) {
    return row.player === "Nighthawkmk2";
  })[0];
  if (!lobo || !nighthawkmk2) throw new Error("Game 73 standings players are missing.");
  const frozenGame73 = (gameContext || []).filter(function(game) {
    return game.gameId === 73 && isSimplePublicCurrentLeagueGame_(game);
  })[0];
  if (!frozenGame73 || !missionIds["Dead Man's Switch"] ||
      !factionIds["Corregidor Jurisdictional Command"] || !factionIds.Shindenbutai)
    throw new Error("Game 73 cross-domain validation failed.");
  if (lobo.games < 1 || lobo.wins < 1 || nighthawkmk2.games < 1 || nighthawkmk2.losses < 1)
    throw new Error("Game 73 standings result was not represented.");
  assertNoForbiddenPublicGenerationKeys_(datasets, "simple");
  if (stablePublicGenerationJson_(datasets.games).toLowerCase().indexOf("armycode") !== -1)
    throw new Error("Public Games contain an Army Code field.");
  ["players", "games", "events", "missions", "factions", "standings"].forEach(function(section) {
    const ref = record.artifacts[section];
    const text = DriveApp.getFileById(ref.fileId).getBlob().getDataAsString("UTF-8");
    validatePersistedPublicGenerationText_(
      DriveApp.getFileById(ref.fileId), text, ref.contentHash, ref.byteCount
    );
    const artifact = parsePublicGenerationJson_(text, null);
    if (!artifact || artifact.generation !== record.generation || artifact.sourceCutoff !== record.sourceCutoff)
      throw new Error("Simple generation artifact provenance failed: " + section);
  });
}

function completeSimplePublicGenerationBuild_(record) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("Simple generation completion lock is busy.");
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(PUBLIC_GENERATION_SIMPLE_LATEST_PROPERTY, JSON.stringify(record));
    properties.deleteProperty(PUBLIC_GENERATION_SIMPLE_ACTIVE_PROPERTY);
  }
  finally { lock.releaseLock(); }
}

function failSimplePublicGenerationBuild_(record) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(PUBLIC_GENERATION_SIMPLE_LATEST_PROPERTY, JSON.stringify(record));
    properties.deleteProperty(PUBLIC_GENERATION_SIMPLE_ACTIVE_PROPERTY);
  }
  finally { lock.releaseLock(); }
}

function simplePublicGenerationStatus_(record, success) {
  const artifacts = {};
  ["players", "games", "events", "missions", "factions", "standings"].forEach(function(section) {
    if (!record.artifacts || !record.artifacts[section]) return;
    const ref = record.artifacts[section];
    artifacts[section] = {
      artifact: ref.artifact, byteCount: ref.byteCount, contentHash: ref.contentHash,
      readBack: ref.readBack === true, security: "passed"
    };
  });
  return {
    success: success,
    generation: record.generation || "",
    sourceCutoff: record.sourceCutoff || "",
    inputHash: record.inputHash || "",
    status: record.status || "failed",
    completedStages: record.completedStages || [],
    artifacts: artifacts,
    metrics: record.metrics || {},
    published: false,
    livePointer: false
  };
}
