/*******************************************************
 * ArmyIntelligenceApi.gs
 *
 * Disposable decoded army-list snapshots. Source game and
 * community army-list records remain authoritative.
 *******************************************************/

const ARMY_INTELLIGENCE_READ_MODEL_KEY = "armyIntelligence:v4";
const ARMY_INTELLIGENCE_READ_MODEL_CHUNK_SIZE = 45000;
const ARMY_INTELLIGENCE_WORKER_TOKEN_HASH =
  "05aae22c06c0b29ebbd95a271cea53e5e9df46783288e0afd2e85083391647f4";
const ARMY_INTELLIGENCE_READ_MODEL_HEADERS = [
  "Key",
  "Generated At",
  "Chunk Index",
  "Payload JSON Chunk"
];

function getArmyIntelligenceSources() {

  return jsonOutput({
    success: true,
    sources: buildArmyIntelligenceSources()
  });

}

function requireArmyIntelligenceWorkerOrPermission(e, handler) {

  if (isAuthorizedArmyIntelligenceWorkerRequest(e))
    return handler({
      authenticated: true,
      machine: true,
      user: {
        enabled: true,
        role: "Commissioner"
      }
    });

  return requireApiPermission(e, "manageCache", handler);

}

function isAuthorizedArmyIntelligenceWorkerRequest(e) {

  const parameters = getApiParameters(e);
  const token = getApiParameter(parameters, "workerToken");

  if (!token)
    return false;

  const storedHash =
    getArmyIntelligenceString(ARMY_INTELLIGENCE_WORKER_TOKEN_HASH);

  if (!storedHash)
    return false;

  return constantTimeArmyIntelligenceStringEqual(
    getArmyIntelligenceHash(token),
    storedHash
  );

}

function constantTimeArmyIntelligenceStringEqual(left, right) {

  const leftText = getArmyIntelligenceString(left);
  const rightText = getArmyIntelligenceString(right);
  const length = Math.max(leftText.length, rightText.length);
  let difference = leftText.length ^ rightText.length;

  for (let index = 0; index < length; index++)
    difference |=
      (leftText.charCodeAt(index % (leftText.length || 1)) || 0) ^
      (rightText.charCodeAt(index % (rightText.length || 1)) || 0);

  return difference === 0;

}

function refreshArmyIntelligence(e) {

  const parameters =
    getApiParameters(e);

  const snapshotsJson =
    getApiParameter(parameters, "snapshots");

  if (!snapshotsJson)
    return jsonOutput({
      success: true,
      sourceCount: buildArmyIntelligenceSources().length,
      status: "Ready",
      updated: 0
    });

  const snapshots =
    JSON.parse(snapshotsJson);

  if (!Array.isArray(snapshots))
    throw new Error("snapshots must be a JSON array.");

  const authoritativeSources =
    buildArmyIntelligenceSources();

  const sourcesByKey = {};

  authoritativeSources.forEach(function(source) {
    sourcesByKey[source.snapshotKey] = source;
  });

  const rows =
    snapshots.map(function(snapshot) {
      const source =
        sourcesByKey[
          getArmyIntelligenceString(snapshot && snapshot.snapshotKey)
        ];

      if (!source)
        throw new Error("Army Intelligence snapshot source is not authoritative.");

      validateArmyIntelligenceRefreshSnapshot(source, snapshot);

      return buildPersistedArmyIntelligenceSnapshotRow(source, snapshot);
    });

  upsertPersistedArmyIntelligenceSnapshotRows(rows);
  rebuildArmyIntelligenceReadModelPayloadAndPersist();
  invalidatePortalCacheGroup("armyIntelligence");

  return jsonOutput({
    success: true,
    sourceCount: authoritativeSources.length,
    status: "Refreshed",
    updated: rows.length
  });

}

function validateArmyIntelligenceRefreshSnapshot(source, snapshot) {

  if (!snapshot || typeof snapshot !== "object")
    throw new Error("Invalid Army Intelligence snapshot.");

  const expected = {
    armyCodeHash: getArmyIntelligenceString(source.armyCodeHash),
    armyListId: getArmyIntelligenceString(source.armyListId),
    snapshotKey: getArmyIntelligenceString(source.snapshotKey),
    sourceId: getArmyIntelligenceString(source.sourceId),
    sourcePlayer: getArmyIntelligenceString(source.sourcePlayer),
    sourceType: getArmyIntelligenceString(source.sourceType)
  };

  Object.keys(expected).forEach(function(key) {
    if (getArmyIntelligenceString(snapshot[key]) !== expected[key])
      throw new Error("Army Intelligence snapshot identity mismatch: " + key + ".");
  });

  const status =
    getArmyIntelligenceString(snapshot.status);

  if (status !== "decoded" && status !== "failed")
    throw new Error("Invalid Army Intelligence snapshot status.");

  if (status === "decoded") {
    if (!snapshot.decoded || typeof snapshot.decoded !== "object")
      throw new Error("Decoded Army Intelligence snapshot is missing its payload.");

    const decoderVersion =
      getArmyIntelligenceString(snapshot.decoded.decoderVersion);

    if (!decoderVersion || decoderVersion !== getArmyIntelligenceString(snapshot.decoderVersion))
      throw new Error("Army Intelligence decoder version mismatch.");

    if (getArmyIntelligenceHash(snapshot.decoded.armyCode) !== expected.armyCodeHash)
      throw new Error("Army Intelligence snapshot Army Code mismatch.");
  }

}

function buildPersistedArmyIntelligenceSnapshotRow(source, snapshot) {

  const decoded =
    snapshot.decoded || null;

  const totals =
    decoded && decoded.totals
      ? decoded.totals
      : {};

  const entries =
    getPersistedArmyIntelligenceDecodedEntries(decoded);

  const envelope = {
    armyCodeHash: source.armyCodeHash,
    armyListId: source.armyListId || "",
    decoded: decoded,
    decodedAt: snapshot.decodedAt || new Date().toISOString(),
    decoderVersion: snapshot.decoderVersion || "",
    error: snapshot.error || "",
    snapshotKey: source.snapshotKey,
    sourceId: source.sourceId,
    sourcePlayer: source.sourcePlayer,
    sourceType: source.sourceType,
    status: snapshot.status
  };

  return [
    getPersistedArmyIntelligenceStorageKey(source),
    envelope.decodedAt,
    envelope.decoderVersion,
    source.player,
    decoded && decoded.faction ? decoded.faction : source.faction,
    decoded && decoded.sectorial ? decoded.sectorial : source.sectorial,
    decoded && decoded.listName ? decoded.listName : source.mission,
    Number(totals.points) || 0,
    Number(totals.swc) || 0,
    entries.length,
    JSON.stringify(envelope)
  ];

}

function getPersistedArmyIntelligenceStorageKey(source) {

  const armyListId =
    getArmyIntelligenceString(source.armyListId);

  return armyListId
    ? "army-list:" + armyListId
    : "army-code:" + getArmyIntelligenceString(source.armyCodeHash);

}

function getPersistedArmyIntelligenceDecodedEntries(decoded) {

  const entries = [];

  ((decoded && decoded.combatGroups) || []).forEach(function(group) {
    (group.entries || []).forEach(function(entry) {
      entries.push(entry);
    });
  });

  return entries;

}

function upsertPersistedArmyIntelligenceSnapshotRows(rows) {

  if (rows.length === 0)
    return;

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.ARMY_INTELLIGENCE);

  if (!sheet)
    sheet = spreadsheet.insertSheet(CONFIG.SHEETS.ARMY_INTELLIGENCE);

  if (sheet.getLastRow() === 0)
    sheet.appendRow(ARMY_INTELLIGENCE_HEADERS);

  const keys = {};

  if (sheet.getLastRow() > 1)
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getValues()
      .forEach(function(row, index) {
        const key = getArmyIntelligenceString(row[0]);
        if (key)
          keys[key] = index + 2;
      });

  rows.forEach(function(row) {
    const key = getArmyIntelligenceString(row[0]);

    if (keys[key])
      sheet.getRange(keys[key], 1, 1, ARMY_INTELLIGENCE_HEADERS.length).setValues([row]);
    else {
      sheet.appendRow(row);
      keys[key] = sheet.getLastRow();
    }
  });

}

function getArmyIntelligence(e) {

  const readModel =
    readArmyIntelligenceReadModelPayload();

  if (readModel)
    return jsonOutput(readModel);

  return jsonOutput(
    rebuildArmyIntelligenceReadModelPayloadAndPersist()
  );

}

function rebuildArmyIntelligenceReadModel() {

  const payload =
    rebuildArmyIntelligenceReadModelPayloadAndPersist();

  return {
    lists: payload.lists.length
  };

}

function rebuildArmyIntelligenceReadModelPayloadAndPersist() {

  const payload =
    rebuildArmyIntelligenceReadModelPayload();

  const rows =
    buildArmyIntelligenceReadModelRowsFromPayload(
      payload
    );

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  if (!spreadsheet.getSheetByName(CONFIG.SHEETS.ARMY_INTELLIGENCE_READ_MODEL))
    spreadsheet.insertSheet(CONFIG.SHEETS.ARMY_INTELLIGENCE_READ_MODEL);

  writeSheet(
    CONFIG.SHEETS.ARMY_INTELLIGENCE_READ_MODEL,
    rows
  );

  return payload;

}

function rebuildArmyIntelligenceReadModelPayload() {

  const knownArmyListRegistry =
    buildKnownArmyListRegistry();

  const responseLists =
    buildArmyIntelligenceListsFromCanonicalSources(
      knownArmyListRegistry.counts
    );

  return {
    success: true,
    armyLists: knownArmyListRegistry.lists,
    lists: responseLists,
    summary: buildArmyIntelligenceSummary(responseLists)
  };

}

function buildArmyIntelligenceReadModelRows(armyIntelligenceRows) {

  const payload =
    buildArmyIntelligenceReadModelPayloadFromRows(
      armyIntelligenceRows
    );

  return buildArmyIntelligenceReadModelRowsFromPayload(payload);

}

function buildArmyIntelligenceReadModelRowsFromPayload(payload) {

  const generatedAt =
    new Date().toISOString();

  const json =
    JSON.stringify(payload);

  const rows = [
    ARMY_INTELLIGENCE_READ_MODEL_HEADERS
  ];

  for (
    let offset = 0, index = 1;
    offset < json.length;
    offset += ARMY_INTELLIGENCE_READ_MODEL_CHUNK_SIZE, index += 1
  )
    rows.push([
      ARMY_INTELLIGENCE_READ_MODEL_KEY,
      generatedAt,
      index,
      json.slice(
        offset,
        offset + ARMY_INTELLIGENCE_READ_MODEL_CHUNK_SIZE
      )
    ]);

  if (rows.length === 1)
    rows.push([
      ARMY_INTELLIGENCE_READ_MODEL_KEY,
      generatedAt,
      1,
      json
    ]);

  return rows;

}

function buildArmyIntelligenceReadModelPayloadFromRows(armyIntelligenceRows) {

  const responseLists =
    mapDeterministicArmyIntelligenceRows(
      armyIntelligenceRows
    );

  const armyLists =
    buildArmyIntelligenceArmyListsFromReadModelLists(
      responseLists
    );

  return {
    success: true,
    armyLists: armyLists,
    lists: responseLists,
    summary: buildArmyIntelligenceSummary(responseLists)
  };

}

function buildArmyIntelligenceArmyListsFromReadModelLists(lists) {

  return lists.map(function(list) {

    const decoded =
      list.decoded || {};

    const totals =
      decoded.totals || {};

    return {
      id: Number(list.sourceId) || 0,
      armyCode: getArmyIntelligenceString(list.armyCode),
      armyLink: "",
      armyName: getArmyIntelligenceString(decoded.listName),
      faction: getArmyIntelligenceString(list.faction),
      player: getArmyIntelligenceString(list.player),
      playerDisplayName: getArmyIntelligenceString(list.player),
      points: Number(totals.points) || 0,
      sectorial: getArmyIntelligenceString(list.sectorial),
      source: "League",
      submissionDate: getArmyIntelligenceString(list.date),
      swc: Number(totals.swc) || 0
    };

  });

}

function readArmyIntelligenceReadModelPayload() {

  const sheet =
    lifGetTargetSpreadsheet_()
      .getSheetByName(CONFIG.SHEETS.ARMY_INTELLIGENCE_READ_MODEL);

  if (!sheet || sheet.getLastRow() < 2)
    return null;

  const rows =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        ARMY_INTELLIGENCE_READ_MODEL_HEADERS.length
      )
      .getValues()
      .filter(function(row) {
        return row[0] === ARMY_INTELLIGENCE_READ_MODEL_KEY;
      })
      .sort(function(left, right) {
        return Number(left[2]) - Number(right[2]);
      });

  if (rows.length === 0)
    return null;

  const json =
    rows.map(function(row) {
      return getArmyIntelligenceString(row[3]);
    }).join("");

  if (!json)
    return null;

  const payload =
    JSON.parse(json);

  payload.success = true;

  return normalizeArmyIntelligenceReadModelRoleFlags(payload);

}

function normalizeArmyIntelligenceReadModelRoleFlags(payload) {

  (payload.lists || []).forEach(function(list) {

    ((list.decoded || {}).combatGroups || []).forEach(function(group) {

      (group.entries || []).forEach(function(entry) {

        entry.hacker =
          hasArmyIntelligenceProfileToken(
            getArmyIntelligenceStringArray(entry.skills),
            /\bhacker\b/i
          );

      });

    });

  });

  return payload;

}

function buildArmyIntelligenceListsFromCanonicalSources(knownArmyListCounts) {

  const snapshots =
    getPersistedArmyIntelligenceSnapshotLookup();

  return buildArmyIntelligenceSources()
    .map(function(source) {
      const snapshot =
        findPersistedArmyIntelligenceSnapshot(source, snapshots);

      return mergeArmyIntelligenceSourceAndSnapshot(
        source,
        snapshot
          ? {
              decodedAt: snapshot.decodedAt,
              decodedJson: snapshot.decoded
                ? JSON.stringify(snapshot.decoded)
                : "",
              error: snapshot.error || "",
              status: snapshot.status
            }
          : {
              decodedAt: "",
              decodedJson: "",
              error: "Persisted Army Intelligence snapshot is missing.",
              status: "pending"
            },
        knownArmyListCounts
      );
    });

}

function getDeterministicArmyIntelligenceLists() {

  return (
    mapDeterministicArmyIntelligenceRows(
      readPersistedDeterministicArmyIntelligenceRows()
    )
  );

}

function mapDeterministicArmyIntelligenceRows(rows) {

  if (rows.length < 2)
    return [];

  return rows
    .slice(1)
    .map(buildDeterministicArmyIntelligenceList)
    .filter(function(list) {
      return list && list.status === "decoded";
    });

}

function readPersistedDeterministicArmyIntelligenceRows() {

  const sheet =
    lifGetTargetSpreadsheet_()
      .getSheetByName(CONFIG.SHEETS.ARMY_INTELLIGENCE);

  if (!sheet)
    return [];

  return sheet
    .getDataRange()
    .getValues();

}

function buildCurrentDeterministicArmyIntelligenceRows() {

  const sheet =
    lifGetTargetSpreadsheet_()
      .getSheetByName(CONFIG.SHEETS.ENGINE);

  if (!sheet)
    return [];

  const gameEngineRows =
    sheet
      .getDataRange()
      .getValues();

  if (gameEngineRows.length < 2)
    return [];

  return buildArmyIntelligenceForGameEngineRows(
    gameEngineRows
  );

}

function buildApprovedArmyListIntelligenceRows() {

  return readPersistedDeterministicArmyIntelligenceRows();

}

function buildDeterministicArmyIntelligenceList(row) {

  const armyListId =
    getArmyIntelligenceString(row[0]);

  if (!armyListId)
    return null;

  const snapshot =
    parseDeterministicArmyIntelligenceSnapshot(row[10]);

  const identity =
    snapshot && snapshot.armyCodeHash
      ? snapshot
      : {};

  const faction =
    getArmyIntelligenceString(row[4]);

  const sectorial =
    getArmyIntelligenceString(row[5]) || faction;

  const decoded =
    buildDeterministicArmyIntelligenceDecodedList(row, snapshot);

  return {
    armyCode:
      getArmyIntelligenceString(
        snapshot && snapshot.decoded && snapshot.decoded.armyCode
      ),
    armyCodeHash:
      getArmyIntelligenceString(identity.armyCodeHash) || armyListId,
    date: getArmyIntelligenceString(row[1]),
    decoded: decoded,
    decodedAt: getArmyIntelligenceString(row[1]),
    error: getArmyIntelligenceString(identity.error),
    event: "",
    faction: faction,
    gameType: "League",
    knownArmyLists: 1,
    mission: "",
    opponent: "",
    player: getArmyIntelligenceString(row[3]),
    result: "",
    sectorial: sectorial,
    snapshotKey:
      getArmyIntelligenceString(identity.snapshotKey) || armyListId,
    sourceId:
      getArmyIntelligenceString(identity.armyListId) || armyListId,
    sourcePlayer:
      getArmyIntelligenceString(identity.sourcePlayer) || getArmyIntelligenceString(row[3]),
    sourceType:
      getArmyIntelligenceString(identity.sourceType) || "league",
    status:
      getArmyIntelligenceString(identity.status) || (decoded ? "decoded" : "failed")
  };

}

function parseDeterministicArmyIntelligenceSnapshot(value) {

  const text =
    getArmyIntelligenceString(value);

  if (!text)
    return null;

  try {
    return JSON.parse(text);
  }
  catch (err) {
    return null;
  }

}

function buildDeterministicArmyIntelligenceDecodedList(row, snapshot) {

  if (!snapshot)
    return null;

  if (snapshot.status === "decoded" && snapshot.decoded)
    return snapshot.decoded;

  const units =
    Array.isArray(snapshot.units)
      ? snapshot.units
      : [];

  const entries =
    units.map(function(unit) {
      return buildDeterministicArmyIntelligenceDecodedEntry(unit);
    });

  return {
    combatGroups: [
      {
        combatGroup: 1,
        entries: entries
      }
    ],
    decoderVersion:
      getArmyIntelligenceString(snapshot.decoderVersion) ||
      getArmyIntelligenceString(row[2]),
    faction: getArmyIntelligenceString(row[4]),
    listName: getArmyIntelligenceString(row[6]) || "Army List " + getArmyIntelligenceString(row[0]),
    orderCounts: {
      impetuous: 0,
      irregular: 0,
      lieutenant: 0,
      regular: Number(row[9]) || entries.length
    },
    sectorial: getArmyIntelligenceString(row[5]) || getArmyIntelligenceString(row[4]),
    totals: {
      combatGroups: 1,
      points: Number(row[7]) || Number(snapshot.points) || 0,
      swc: Number(row[8]) || Number(snapshot.swc) || 0
    }
  };

}

function buildDeterministicArmyIntelligenceDecodedEntry(unit) {

  const profile =
    getArmyIntelligenceString(unit && unit.decodedProfile) ||
    getArmyIntelligenceString(unit && unit.profile) ||
    "Unknown Profile";

  const equipment =
    getArmyIntelligenceStringArray(unit && unit.equipment);

  const skills =
    getArmyIntelligenceStringArray(unit && unit.skills);

  const weapons =
    getArmyIntelligenceStringArray(unit && unit.weapons);

  const chainOfCommand =
    Boolean(unit && unit.chainOfCommand) ||
    hasArmyIntelligenceProfileToken(skills, /chain\s+of\s+command/i);

  const doctor =
    Boolean(unit && unit.doctor) ||
    hasArmyIntelligenceProfileToken(skills, /\bdoctor\b/i);

  const engineer =
    Boolean(unit && unit.engineer) ||
    hasArmyIntelligenceProfileToken(skills, /\bengineer\b/i);

  const forwardObserver =
    Boolean(unit && unit.forwardObserver) ||
    hasArmyIntelligenceProfileToken(skills, /forward\s+observer/i);

  const hacker =
    hasArmyIntelligenceProfileToken(skills, /\bhacker\b/i);

  const lieutenant =
    Boolean(unit && unit.lieutenant) ||
    hasArmyIntelligenceProfileToken(skills.concat([profile]), /\blieutenant\b/i);

  return {
    combatGroup: Number(unit && unit.combatGroup) || 1,
    chainOfCommand: chainOfCommand,
    combinedId: profile,
    doctor: doctor,
    engineer: engineer,
    equipment: equipment,
    forwardObserver: forwardObserver,
    hacker: hacker,
    lieutenant: lieutenant,
    orderTypes: [],
    points: Number(unit && unit.points) || 0,
    profile: profile,
    skills: skills,
    specialist:
      Boolean(unit && unit.specialist) ||
      chainOfCommand ||
      doctor ||
      engineer ||
      forwardObserver ||
      hacker ||
      hasArmyIntelligenceProfileToken(skills, /\bparamedic\b/i),
    structure: null,
    swc: Number(unit && unit.swc) || 0,
    troopType: getArmyIntelligenceString(unit && unit.troopType),
    unit: getArmyIntelligenceString(unit && unit.unit) || profile,
    weapons: weapons,
    wounds: null
  };

}

function buildDeterministicArmyIntelligenceArmyLists(lists) {

  const listsById =
    getArmyIntelligenceSourceListLookup();

  return lists.map(function(list) {
    const source =
      listsById[list.sourceId] || {};

    return {
      id: Number(list.sourceId) || 0,
      armyCode: getArmyIntelligenceString(source.armyCode),
      armyLink: getArmyIntelligenceString(source.armyLink),
      armyName:
        getArmyIntelligenceString(source.armyName) ||
        getArmyIntelligenceString(list.decoded && list.decoded.listName),
      faction:
        getArmyIntelligenceString(source.faction) ||
        getArmyIntelligenceString(list.faction),
      player:
        getArmyIntelligenceString(source.player) ||
        getArmyIntelligenceString(list.player),
      playerDisplayName:
        getArmyIntelligenceString(source.playerDisplayName) ||
        getArmyIntelligenceString(source.player) ||
        getArmyIntelligenceString(list.player),
      points:
        Number(source.points) ||
        Number(list.decoded && list.decoded.totals && list.decoded.totals.points) ||
        0,
      sectorial:
        getArmyIntelligenceString(source.sectorial) ||
        getArmyIntelligenceString(list.sectorial),
      source: "League",
      submissionDate:
        getArmyIntelligenceString(source.submissionDate) ||
        getArmyIntelligenceString(list.date),
      swc:
        Number(source.swc) ||
        Number(list.decoded && list.decoded.totals && list.decoded.totals.swc) ||
        0
    };
  });

}

function buildArmyIntelligenceSources() {

  const armyListsById =
    getArmyIntelligenceSourceListLookup();
  const armyListsByPlayerAndFaction =
    CanonicalArmyCodeResolver.buildPlayerFactionLookup(
      armyListsById,
      getArmyIntelligencePlayerFactionKey
    );

  const games =
    typeof getAllRecentGameObjects === "function"
      ? getAllRecentGameObjects()
      : [];

  const casualGames =
    typeof getAllRecentGameObjectsForEvent === "function"
      ? getAllRecentGameObjectsForEvent("all", "casual")
      : [];

  return CanonicalSourceDiscovery.discover({
    deduplicateGames: true,
    formatGameType: formatArmyIntelligenceGameType,
    games: games.concat(casualGames),
    hashArmyCode: getArmyIntelligenceHash,
    includeArmyListId: true,
    normalizeAll: true,
    normalizeKey: normalizeArmyIntelligenceKeyPart,
    normalizeString: getArmyIntelligenceString,
    resolveArmyCode: function(game, side, player, faction) {
      return CanonicalArmyCodeResolver.resolveWithFallback({
        armyListId: side === "winner" ? game.winnerArmyListId : game.loserArmyListId,
        directCode: CanonicalArmyCodeResolver.resolveGameSideCode(
          game,
          side,
          getArmyIntelligenceString
        ),
        faction: faction,
        getPlayerFactionKey: getArmyIntelligencePlayerFactionKey,
        listsById: armyListsById,
        normalizeString: getArmyIntelligenceString,
        player: player,
        playerFactionLookup: armyListsByPlayerAndFaction
      });
    },
    resolveEventName: function(game) {
      return game.eventName || game.eventId || "";
    },
    tournamentResult: function() {
      return "";
    },
    tournamentResults: []
  });

}

function getPersistedArmyIntelligenceSnapshotLookup() {

  const lookup = {
    byArmyCodeHash: {},
    byArmyListId: {}
  };

  const rows =
    readPersistedDeterministicArmyIntelligenceRows();

  if (rows.length < 2)
    return lookup;

  rows.slice(1).forEach(function(row) {
    const snapshot =
      parseDeterministicArmyIntelligenceSnapshot(row[10]);

    if (!snapshot || !snapshot.armyCodeHash)
      return;

    const armyCodeHash =
      getArmyIntelligenceString(snapshot.armyCodeHash);

    const armyListId =
      getArmyIntelligenceString(snapshot.armyListId);

    if (armyCodeHash)
      lookup.byArmyCodeHash[armyCodeHash] = snapshot;

    if (armyListId)
      lookup.byArmyListId[armyListId] = snapshot;
  });

  return lookup;

}

function findPersistedArmyIntelligenceSnapshot(source, lookup) {

  const armyListId =
    getArmyIntelligenceString(source.armyListId);

  const armyCodeHash =
    getArmyIntelligenceString(source.armyCodeHash);

  const snapshot =
    (armyListId && lookup.byArmyListId[armyListId]) ||
    (armyCodeHash && lookup.byArmyCodeHash[armyCodeHash]) ||
    null;

  if (!snapshot)
    return null;

  if (getArmyIntelligenceString(snapshot.armyCodeHash) !== armyCodeHash)
    return null;

  if (
    armyListId &&
    getArmyIntelligenceString(snapshot.armyListId) &&
    getArmyIntelligenceString(snapshot.armyListId) !== armyListId
  )
    return null;

  return snapshot;

}

function getArmyIntelligencePlayerFactionKey(player, faction) {

  const playerKey =
    normalizeArmyIntelligenceKeyPart(player);

  const factionKey =
    normalizeArmyIntelligenceKeyPart(
      canonicalizeArmyParentFaction(faction)
    );

  return playerKey && factionKey
    ? playerKey + ":" + factionKey
    : "";

}

function syncLegacyArmyIntelligenceSnapshotsForCurrentSources() {

  const sources =
    buildArmyIntelligenceSources();

  return {
    sourceCount: sources.length,
    updated: 0
  };

}

function mergeArmyIntelligenceSourceAndSnapshot(source, snapshot, knownArmyListCounts) {

  const decoded =
    parseArmyIntelligenceSnapshotJson(snapshot.decodedJson);

  const faction =
    decoded && decoded.faction ? decoded.faction : source.faction;

  return {
    armyCode: source.armyCode,
    armyCodeHash: source.armyCodeHash,
    date: source.date,
    decodedAt: snapshot.decodedAt,
    decoded: decoded,
    error: snapshot.error,
    event: source.event,
    faction: faction,
    gameType: source.gameType,
    knownArmyLists: getKnownArmyListCount(
      knownArmyListCounts,
      faction
    ),
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

function buildKnownArmyListRegistry() {

  const counts = {};
  const lists = [];

  if (typeof getArmyListObjects !== "function")
    return {
      counts: counts,
      lists: lists
    };

  getArmyListObjects().forEach(function(list) {
    const faction =
      canonicalizeArmyParentFaction(
        list.faction ||
        (list.validation && list.validation.faction) ||
        ""
      );

    if (!faction)
      return;

    counts[faction] =
      (counts[faction] || 0) + 1;

    lists.push({
      id: list.id,
      armyCode: list.armyCode,
      armyLink: list.armyLink,
      armyName:
        list.armyName ||
        (list.validation && list.validation.armyName) ||
        "",
      faction: faction,
      player: list.player,
      playerDisplayName: list.playerDisplayName || list.player,
      points:
        Number(list.validation && list.validation.points) || 0,
      sectorial:
        list.sectorial ||
        (list.validation && list.validation.sectorial) ||
        "",
      source: "Community Library",
      submissionDate: list.submissionDate,
      swc:
        Number(list.validation && list.validation.swc) || 0
    });
  });

  return {
    counts: counts,
    lists: lists
  };

}

function getKnownArmyListCount(counts, faction) {

  const key =
    canonicalizeArmyParentFaction(faction);

  return counts[key] || 0;

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
        getArmyIntelligenceProfileAggregationLabel(entry) ||
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

function getArmyIntelligenceProfileAggregationLabel(entry) {

  return (
    getArmyIntelligenceString(entry && entry.profile) ||
    getArmyIntelligenceString(entry && entry.unit)
  );

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

function getArmyIntelligenceStringArray(value) {

  if (Array.isArray(value))
    return value
      .map(function(item) {
        return getArmyIntelligenceString(item);
      })
      .filter(Boolean);

  const text =
    getArmyIntelligenceString(value);

  if (!text)
    return [];

  return text
    .split(/\s*,\s*/)
    .map(function(item) {
      return item.trim();
    })
    .filter(Boolean);

}

function hasArmyIntelligenceProfileToken(values, pattern) {

  return getArmyIntelligenceStringArray(values).some(function(value) {
    return pattern.test(value);
  });

}
