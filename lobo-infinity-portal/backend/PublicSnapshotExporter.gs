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
const PUBLIC_SNAPSHOT_V1_PROOF_ID = "20260830T222502Z";
const PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY = "LOBO_SNAPSHOT_PUBLISH_TOKEN";
const PUBLIC_SNAPSHOT_PUBLISH_URL = "https://lobo-infinity-portal.vercel.app/api/public-snapshot-publish";
const PUBLIC_SNAPSHOT_PUBLIC_FILES = [
  "snapshot.json", "players.json", "games.json", "events.json",
  "missions.json", "factions.json", "standings.json"
];

function runBuildPublicSnapshotV1() {
  const result = buildPublicSnapshotV1_();
  Logger.log("PUBLIC_SNAPSHOT_V1 " + JSON.stringify(result));
  return result;
}

function runPublishPublicSnapshotV1Proof(publicationToken) {
  const properties = PropertiesService.getScriptProperties();
  const suppliedToken = String(publicationToken || "").trim();
  if (suppliedToken) properties.setProperty(PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY, suppliedToken);
  const token = suppliedToken || String(properties.getProperty(PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY) || "").trim();
  if (!token) throw new Error("Missing LOBO_SNAPSHOT_PUBLISH_TOKEN Script Property.");

  const rootId = String(properties.getProperty(PUBLIC_SNAPSHOT_V1_ROOT_PROPERTY) || "").trim();
  if (!rootId) throw new Error("Public Snapshot V1 root folder is not configured.");
  const matches = DriveApp.getFolderById(rootId).getFoldersByName(PUBLIC_SNAPSHOT_V1_PROOF_ID);
  if (!matches.hasNext()) throw new Error("Validated proof snapshot not found: " + PUBLIC_SNAPSHOT_V1_PROOF_ID);
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
  if (metadata.snapshotId !== PUBLIC_SNAPSHOT_V1_PROOF_ID || metadata.status !== "validated" ||
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
      files: files
    })
  });
  const statusCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText() || "{}");
  if (statusCode < 200 || statusCode >= 300 || result.success !== true)
    throw new Error("Public snapshot publication failed (HTTP " + statusCode + "): " + String(result.error || "Unknown error"));
  const proof = {
    success: true,
    snapshotId: result.snapshotId,
    sourceCutoff: result.sourceCutoff,
    filesUploaded: result.uploaded,
    files: result.files,
    publishedToBlob: true,
    livePointer: false
  };
  Logger.log("PUBLIC_SNAPSHOT_V1_PUBLICATION " + JSON.stringify(proof));
  return proof;
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
    const events = buildPublicSnapshotEvents_(frozen.eventsTable, games);
    const players = buildPublicSnapshotPlayers_(frozen.playersTable, games);
    const publicGames = buildPublicSnapshotGames_(games, events);
    const missions = buildPublicSnapshotMissions_(games);
    const factions = buildPublicSnapshotFactions_(games, players);
    const standings = buildPublicSnapshotStandings_(frozen.playersTable, games);
    const datasets = {
      players: players, games: publicGames, events: events,
      missions: missions, factions: factions, standings: standings
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
        missions: "missions.json", factions: "factions.json", standings: "standings.json"
      }
    };
    files.snapshot = writePublicSnapshotFile_(folder, "snapshot.json", metadata);
    totalBytes += files.snapshot.byteCount;
    validatePublicSnapshotFile_(files.snapshot.fileId, snapshotId, frozen.sourceCutoff, true);
    return {
      success: true, snapshotId: snapshotId, sourceCutoff: frozen.sourceCutoff,
      status: "validated", published: false, livePointer: false,
      elapsedMs: Date.now() - started, canonicalReads: 3, driveWrites: 7,
      totalBytes: totalBytes, maxLockHoldMs: 0,
      records: {
        players: players.length, games: publicGames.length, events: events.length,
        missions: missions.length, factions: factions.length, standings: standings.length
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
  return {
    snapshotId: snapshotId,
    sourceCutoff: new Date().toISOString(),
    gamesTable: freezePublicSnapshotTable_(gamesTable),
    playersTable: freezePublicSnapshotTable_(playersTable),
    eventsTable: freezePublicSnapshotTable_(eventsTable)
  };
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

function buildPublicSnapshotEvents_(table, games) {
  const columns = publicSnapshotColumns_(table.headers || []);
  return (table.rows || []).map(function(row) {
    const id = publicSnapshotCell_(row, columns, ["id", "event id"]);
    if (!id) return null;
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
      completedGames: games.filter(function(game) { return game.eventId === id; }).length
    };
  }).filter(Boolean);
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
  ["players", "games", "events", "missions", "factions", "standings"].forEach(function(name) {
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
