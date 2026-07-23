/*******************************************************
 * ArmyIntelligenceApi.gs
 *
 * Disposable decoded army-list snapshots. Source game and
 * community army-list records remain authoritative.
 *******************************************************/

const ARMY_INTELLIGENCE_SHEET_NAME = "Army List Intelligence";

const ARMY_INTELLIGENCE_HEADERS = [
  "Snapshot Key",
  "Source Type",
  "Source ID",
  "Source Player",
  "Player",
  "Opponent",
  "Faction",
  "Sectorial",
  "Game Type",
  "Event",
  "Mission",
  "Date",
  "Result",
  "Army Code Hash",
  "Army Code",
  "Decode Status",
  "Decoded At",
  "Decode Error",
  "Decoded JSON"
];

const ARMY_INTELLIGENCE_COLUMNS = {
  SNAPSHOT_KEY: 0,
  SOURCE_TYPE: 1,
  SOURCE_ID: 2,
  SOURCE_PLAYER: 3,
  PLAYER: 4,
  OPPONENT: 5,
  FACTION: 6,
  SECTORIAL: 7,
  GAME_TYPE: 8,
  EVENT: 9,
  MISSION: 10,
  DATE: 11,
  RESULT: 12,
  ARMY_CODE_HASH: 13,
  ARMY_CODE: 14,
  DECODE_STATUS: 15,
  DECODED_AT: 16,
  DECODE_ERROR: 17,
  DECODED_JSON: 18
};

function getArmyIntelligence(e) {

  const sources =
    buildArmyIntelligenceSources();

  const snapshots =
    getArmyIntelligenceSnapshotMap();

  const lists =
    sources.map(function(source) {
      const snapshot =
        snapshots[source.snapshotKey] ||
        createPendingArmyIntelligenceSnapshot(source);

      return mergeArmyIntelligenceSourceAndSnapshot(source, snapshot);
    });

  return jsonOutput({
    success: true,
    lists: lists,
    summary: buildArmyIntelligenceSummary(lists)
  });

}

function refreshArmyIntelligence(e) {

  const parameters =
    getApiParameters(e);

  const sources =
    buildArmyIntelligenceSources();

  ensureArmyIntelligenceSheet();

  const snapshotsJson =
    getApiParameter(parameters, "snapshots");

  if (!snapshotsJson) {
    return jsonOutput({
      success: true,
      status: "Ready",
      sourceCount: sources.length,
      pendingCount: countPendingArmyIntelligenceSources(sources),
      message: "Army Intelligence source inventory refreshed. Run the decoder worker to update snapshots."
    });
  }

  const snapshots =
    JSON.parse(snapshotsJson);

  if (!Array.isArray(snapshots)) {
    return jsonOutput({
      success: false,
      error: "snapshots must be a JSON array."
    });
  }

  const sourceByKey = {};
  sources.forEach(function(source) {
    sourceByKey[source.snapshotKey] = source;
  });

  const rows =
    snapshots
      .map(function(snapshot) {
        const source =
          sourceByKey[getArmyIntelligenceString(snapshot.snapshotKey)];

        if (!source)
          return null;

        return buildArmyIntelligenceSnapshotRow(source, snapshot);
      })
      .filter(function(row) {
        return row !== null;
      });

  upsertArmyIntelligenceRows(rows);
  invalidatePortalCacheGroup("armyIntelligence");

  return jsonOutput({
    success: true,
    status: "Refreshed",
    updated: rows.length,
    sourceCount: sources.length
  });

}

function buildArmyIntelligenceSources() {

  const sources = [];

  appendArmyIntelligenceRecentGameSources(sources);
  appendArmyIntelligenceTeamTournamentSources(sources);

  const seen = {};

  return sources.filter(function(source) {
    if (!source.armyCode)
      return false;

    if (seen[source.snapshotKey])
      return false;

    seen[source.snapshotKey] = true;
    return true;
  });

}

function appendArmyIntelligenceRecentGameSources(sources) {

  const games =
    typeof getAllRecentGameObjects === "function"
      ? getAllRecentGameObjects()
      : [];

  const casualGames =
    typeof getAllRecentGameObjectsForEvent === "function"
      ? getAllRecentGameObjectsForEvent("all", "casual")
      : [];

  const seenGames = {};

  games
    .concat(casualGames)
    .filter(function(game) {
      const key =
        [
          getArmyIntelligenceString(game.id),
          getArmyIntelligenceString(game.gameType)
        ].join(":");

      if (seenGames[key])
        return false;

      seenGames[key] = true;
      return true;
    })
    .forEach(function(game) {
      appendArmyIntelligenceParticipantSource(sources, {
        armyCode: game.winnerArmyCode,
        date: game.date,
        event: game.eventName || game.eventId || "",
        faction: game.winnerFaction,
        gameType: formatArmyIntelligenceGameType(game.gameType),
        mission: game.mission,
        opponent: game.loserDisplayName || game.loser,
        player: game.winnerDisplayName || game.winner,
        result:
          getArmyIntelligenceString(game.gameResult).toLowerCase() === "draw"
            ? "Draw"
            : "Win",
        sectorial: game.winnerFaction,
        sourceId: game.id,
        sourcePlayer: "winner",
        sourceType: game.gameType === "casual" ? "casual" : "league"
      });

      appendArmyIntelligenceParticipantSource(sources, {
        armyCode: game.loserArmyCode,
        date: game.date,
        event: game.eventName || game.eventId || "",
        faction: game.loserFaction,
        gameType: formatArmyIntelligenceGameType(game.gameType),
        mission: game.mission,
        opponent: game.winnerDisplayName || game.winner,
        player: game.loserDisplayName || game.loser,
        result:
          getArmyIntelligenceString(game.gameResult).toLowerCase() === "draw"
            ? "Draw"
            : "Loss",
        sectorial: game.loserFaction,
        sourceId: game.id,
        sourcePlayer: "loser",
        sourceType: game.gameType === "casual" ? "casual" : "league"
      });
    });

}

function appendArmyIntelligenceTeamTournamentSources(sources) {

  const spreadsheet =
    SpreadsheetApp.getActive();

  const sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.TEAM_TOURNAMENT_RESULTS);

  if (!sheet || sheet.getLastRow() < 2)
    return;

  const rows =
    getArmyIntelligenceObjectsFromSheet(sheet);

  rows.forEach(function(row, index) {
    appendArmyIntelligenceParticipantSource(sources, {
      armyCode: row["Player 1 Army Code"],
      date: row["Created At"] || row["Updated At"],
      event: row["Event ID"],
      faction: row["Winning Faction"],
      gameType: "Tournament",
      mission: row["Mission"],
      opponent: row["Opponent"],
      player: row["Player"],
      result: getArmyIntelligenceTournamentResult(row, row["Player"]),
      sectorial: row["Winning Faction"],
      sourceId: row["Result ID"] || index + 1,
      sourcePlayer: "player1",
      sourceType: "tournament"
    });

    appendArmyIntelligenceParticipantSource(sources, {
      armyCode: row["Player 2 Army Code"],
      date: row["Created At"] || row["Updated At"],
      event: row["Event ID"],
      faction: "",
      gameType: "Tournament",
      mission: row["Mission"],
      opponent: row["Player"],
      player: row["Opponent"],
      result: getArmyIntelligenceTournamentResult(row, row["Opponent"]),
      sectorial: "",
      sourceId: row["Result ID"] || index + 1,
      sourcePlayer: "player2",
      sourceType: "tournament"
    });
  });

}

function appendArmyIntelligenceParticipantSource(sources, source) {

  const armyCode =
    getArmyIntelligenceString(source.armyCode);

  if (!armyCode)
    return;

  const armyCodeHash =
    getArmyIntelligenceHash(armyCode);

  const sourceType =
    getArmyIntelligenceString(source.sourceType);

  const sourceId =
    getArmyIntelligenceString(source.sourceId);

  const sourcePlayer =
    getArmyIntelligenceString(source.sourcePlayer);

  const player =
    getArmyIntelligenceString(source.player);

  const snapshotKey =
    [
      sourceType,
      sourceId,
      sourcePlayer,
      normalizeArmyIntelligenceKeyPart(player),
      armyCodeHash
    ].join(":");

  sources.push({
    armyCode: armyCode,
    armyCodeHash: armyCodeHash,
    date: getArmyIntelligenceString(source.date),
    event: getArmyIntelligenceString(source.event),
    faction: getArmyIntelligenceString(source.faction),
    gameType: getArmyIntelligenceString(source.gameType),
    mission: getArmyIntelligenceString(source.mission),
    opponent: getArmyIntelligenceString(source.opponent),
    player: player,
    result: getArmyIntelligenceString(source.result),
    sectorial: getArmyIntelligenceString(source.sectorial),
    snapshotKey: snapshotKey,
    sourceId: sourceId,
    sourcePlayer: sourcePlayer,
    sourceType: sourceType
  });

}

function getArmyIntelligenceSnapshotMap() {

  const sheet =
    ensureArmyIntelligenceSheet();

  const rows =
    getArmyIntelligenceObjectsFromSheet(sheet);

  const snapshots = {};

  rows.forEach(function(row) {
    const snapshotKey =
      getArmyIntelligenceString(row["Snapshot Key"]);

    if (!snapshotKey)
      return;

    snapshots[snapshotKey] = {
      armyCodeHash: getArmyIntelligenceString(row["Army Code Hash"]),
      decodedAt: getArmyIntelligenceString(row["Decoded At"]),
      decodedJson: getArmyIntelligenceString(row["Decoded JSON"]),
      error: getArmyIntelligenceString(row["Decode Error"]),
      snapshotKey: snapshotKey,
      status: getArmyIntelligenceString(row["Decode Status"]) || "pending"
    };
  });

  return snapshots;

}

function createPendingArmyIntelligenceSnapshot(source) {

  return {
    armyCodeHash: source.armyCodeHash,
    decodedAt: "",
    decodedJson: "",
    error: "",
    snapshotKey: source.snapshotKey,
    status: "pending"
  };

}

function mergeArmyIntelligenceSourceAndSnapshot(source, snapshot) {

  const decoded =
    parseArmyIntelligenceSnapshotJson(snapshot.decodedJson);

  return {
    armyCodeHash: source.armyCodeHash,
    date: source.date,
    decodedAt: snapshot.decodedAt,
    decoded: decoded,
    error: snapshot.error,
    event: source.event,
    faction: decoded && decoded.faction ? decoded.faction : source.faction,
    gameType: source.gameType,
    mission: source.mission,
    opponent: source.opponent,
    player: source.player,
    result: source.result,
    sectorial: decoded && decoded.sectorial ? decoded.sectorial : source.sectorial,
    snapshotKey: source.snapshotKey,
    sourceId: source.sourceId,
    sourcePlayer: source.sourcePlayer,
    sourceType: source.sourceType,
    status: snapshot.status || "pending"
  };

}

function buildArmyIntelligenceSummary(lists) {

  const decoded =
    lists.filter(function(list) {
      return list.status === "decoded" && list.decoded;
    });

  const totals =
    decoded.reduce(function(accumulator, list) {
      const decodedList =
        list.decoded || {};

      const orderCounts =
        decodedList.orderCounts || {};

      accumulator.points += Number(decodedList.totals && decodedList.totals.points) || 0;
      accumulator.swc += Number(decodedList.totals && decodedList.totals.swc) || 0;
      accumulator.combatGroups += Number(decodedList.totals && decodedList.totals.combatGroups) || 0;
      accumulator.regularOrders += Number(orderCounts.regular) || 0;
      accumulator.irregularOrders += Number(orderCounts.irregular) || 0;

      collectArmyIntelligenceUnits(accumulator, list);

      return accumulator;
    }, {
      combatGroups: 0,
      doctorsEngineers: {},
      factions: {},
      hackers: {},
      irregularOrders: 0,
      lieutenants: {},
      points: 0,
      regularOrders: 0,
      sectorials: {},
      specialists: {},
      swc: 0,
      units: {}
    });

  decoded.forEach(function(list) {
    incrementArmyIntelligenceCount(totals.factions, list.faction || "Unknown");
    incrementArmyIntelligenceCount(totals.sectorials, list.sectorial || "Unknown");
  });

  const decodedCount =
    decoded.length;

  return {
    averageCombatGroups: averageArmyIntelligenceValue(totals.combatGroups, decodedCount),
    averageIrregularOrders: averageArmyIntelligenceValue(totals.irregularOrders, decodedCount),
    averagePoints: averageArmyIntelligenceValue(totals.points, decodedCount),
    averageRegularOrders: averageArmyIntelligenceValue(totals.regularOrders, decodedCount),
    averageSwc: averageArmyIntelligenceValue(totals.swc, decodedCount),
    decodedLists: decodedCount,
    failedLists:
      lists.filter(function(list) {
        return list.status === "failed";
      }).length,
    factions: mapArmyIntelligenceCounts(totals.factions),
    hackers: mapArmyIntelligenceCounts(totals.hackers),
    lieutenants: mapArmyIntelligenceCounts(totals.lieutenants),
    pendingLists:
      lists.filter(function(list) {
        return list.status === "pending";
      }).length,
    sectorials: mapArmyIntelligenceCounts(totals.sectorials),
    specialists: mapArmyIntelligenceCounts(totals.specialists),
    doctorsEngineers: mapArmyIntelligenceCounts(totals.doctorsEngineers),
    totalLists: lists.length,
    units: mapArmyIntelligenceCounts(totals.units)
  };

}

function collectArmyIntelligenceUnits(accumulator, list) {

  const decoded =
    list.decoded || {};

  const groups =
    decoded.combatGroups || [];

  groups.forEach(function(group) {
    (group.entries || []).forEach(function(entry) {
      const label =
        getArmyIntelligenceString(entry.unit) ||
        getArmyIntelligenceString(entry.profile) ||
        "Unknown";

      incrementArmyIntelligenceCount(accumulator.units, label);

      if (entry.lieutenant)
        incrementArmyIntelligenceCount(accumulator.lieutenants, label);

      if (entry.hacker)
        incrementArmyIntelligenceCount(accumulator.hackers, label);

      if (entry.specialist)
        incrementArmyIntelligenceCount(accumulator.specialists, label);

      if (entry.doctor || entry.engineer)
        incrementArmyIntelligenceCount(accumulator.doctorsEngineers, label);
    });
  });

}

function upsertArmyIntelligenceRows(rows) {

  if (rows.length === 0)
    return;

  const sheet =
    ensureArmyIntelligenceSheet();

  const currentRows =
    getArmyIntelligenceObjectsFromSheet(sheet);

  const rowNumbersByKey = {};

  currentRows.forEach(function(row, index) {
    const key =
      getArmyIntelligenceString(row["Snapshot Key"]);

    if (key)
      rowNumbersByKey[key] = index + 2;
  });

  rows.forEach(function(row) {
    const key =
      row[ARMY_INTELLIGENCE_COLUMNS.SNAPSHOT_KEY];

    if (rowNumbersByKey[key]) {
      sheet
        .getRange(rowNumbersByKey[key], 1, 1, ARMY_INTELLIGENCE_HEADERS.length)
        .setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  });

}

function buildArmyIntelligenceSnapshotRow(source, snapshot) {

  const decoded =
    snapshot.decoded || null;

  return [
    source.snapshotKey,
    source.sourceType,
    source.sourceId,
    source.sourcePlayer,
    source.player,
    source.opponent,
    source.faction,
    source.sectorial,
    source.gameType,
    source.event,
    source.mission,
    source.date,
    source.result,
    source.armyCodeHash,
    source.armyCode,
    getArmyIntelligenceString(snapshot.status) || (decoded ? "decoded" : "failed"),
    getArmyIntelligenceString(snapshot.decodedAt) || new Date().toISOString(),
    getArmyIntelligenceString(snapshot.error),
    decoded ? JSON.stringify(decoded) : ""
  ];

}

function ensureArmyIntelligenceSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(ARMY_INTELLIGENCE_SHEET_NAME);

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(ARMY_INTELLIGENCE_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ARMY_INTELLIGENCE_HEADERS);
  } else {
    const headerRange =
      sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), ARMY_INTELLIGENCE_HEADERS.length));

    const headers =
      headerRange.getValues()[0].map(getArmyIntelligenceString);

    const missing =
      ARMY_INTELLIGENCE_HEADERS.filter(function(header) {
        return headers.indexOf(header) === -1;
      });

    if (missing.length > 0) {
      sheet
        .getRange(1, headers.filter(function(header) { return header !== ""; }).length + 1, 1, missing.length)
        .setValues([missing]);
    }
  }

  return sheet;

}

function getArmyIntelligenceObjectsFromSheet(sheet) {

  if (!sheet || sheet.getLastRow() < 2)
    return [];

  const values =
    sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();

  const headers =
    values[0].map(getArmyIntelligenceString);

  return values.slice(1).map(function(row) {
    const record = {};

    headers.forEach(function(header, index) {
      if (header)
        record[header] = row[index];
    });

    return record;
  });

}

function parseArmyIntelligenceSnapshotJson(value) {

  const raw =
    getArmyIntelligenceString(value);

  if (!raw)
    return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }

}

function countPendingArmyIntelligenceSources(sources) {

  const snapshots =
    getArmyIntelligenceSnapshotMap();

  return sources.filter(function(source) {
    const snapshot =
      snapshots[source.snapshotKey];

    return !snapshot || snapshot.status !== "decoded";
  }).length;

}

function getArmyIntelligenceHash(value) {

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      getArmyIntelligenceString(value),
      Utilities.Charset.UTF_8
    );

  return digest.map(function(byte) {
    const value =
      byte < 0 ? byte + 256 : byte;

    return ("0" + value.toString(16)).slice(-2);
  }).join("");

}

function getArmyIntelligenceTournamentResult(row, player) {

  const winner =
    getArmyIntelligenceString(row["Winner"]);

  if (!winner)
    return "";

  if (winner.toLowerCase() === "draw")
    return "Draw";

  return normalizeArmyIntelligenceKeyPart(winner) === normalizeArmyIntelligenceKeyPart(player)
    ? "Win"
    : "Loss";

}

function formatArmyIntelligenceGameType(value) {

  const normalized =
    getArmyIntelligenceString(value).toLowerCase();

  if (normalized === "casual")
    return "Casual";

  if (normalized === "tournament")
    return "Tournament";

  return "League";

}

function incrementArmyIntelligenceCount(counts, key) {

  const label =
    getArmyIntelligenceString(key) || "Unknown";

  counts[label] =
    (counts[label] || 0) + 1;

}

function mapArmyIntelligenceCounts(counts) {

  return Object.keys(counts)
    .map(function(name) {
      return {
        count: counts[name],
        name: name
      };
    })
    .sort(function(left, right) {
      return right.count - left.count || left.name.localeCompare(right.name);
    });

}

function averageArmyIntelligenceValue(total, count) {

  if (!count)
    return 0;

  return Math.round((total / count) * 10) / 10;

}

function normalizeArmyIntelligenceKeyPart(value) {

  return getArmyIntelligenceString(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");

}

function getArmyIntelligenceString(value) {

  if (value === null || typeof value === "undefined")
    return "";

  return String(value).trim();

}
