/*******************************************************
 * ArmyIntelligenceApi.gs
 *
 * Disposable decoded army-list snapshots. Source game and
 * community army-list records remain authoritative.
 *******************************************************/

const ARMY_INTELLIGENCE_READ_MODEL_KEY = "armyIntelligence:v4";
const ARMY_INTELLIGENCE_READ_MODEL_CHUNK_SIZE = 45000;
const ARMY_INTELLIGENCE_READ_MODEL_HEADERS = [
  "Key",
  "Generated At",
  "Chunk Index",
  "Payload JSON Chunk"
];

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

  return buildArmyIntelligenceSources()
    .map(function(source) {
      const snapshot =
        buildLegacyArmyIntelligenceSnapshot(source);

      if (!snapshot) {
        Logger.log(
          JSON.stringify({
            armyListId: source.armyListId,
            condition: "Boolean(snapshot)",
            conditionResult: Boolean(snapshot),
            variables: {
              snapshot: snapshot
            }
          })
        );

        return mergeArmyIntelligenceSourceAndSnapshot(
          source,
          {
            armyCodeHash: source.armyCodeHash,
            decodedAt: "",
            decodedJson: "",
            error: "Army Code could not be decoded.",
            snapshotKey: source.snapshotKey,
            status: "failed"
          },
          knownArmyListCounts
        );
      }

      return mergeArmyIntelligenceSourceAndSnapshot(
        source,
        {
          armyCodeHash: source.armyCodeHash,
          decodedAt: snapshot.decodedAt,
          decodedJson: JSON.stringify(snapshot.decoded),
          error: snapshot.error,
          snapshotKey: source.snapshotKey,
          status: snapshot.status
        },
        knownArmyListCounts
      );
    });

}

function getDeterministicArmyIntelligenceLists() {

  let lists =
    mapDeterministicArmyIntelligenceRows(
      readPersistedDeterministicArmyIntelligenceRows()
    );

  if (lists.length === 0)
    lists =
      mapDeterministicArmyIntelligenceRows(
        buildCurrentDeterministicArmyIntelligenceRows()
      );

  if (lists.length === 0)
    lists =
      mapDeterministicArmyIntelligenceRows(
        buildApprovedArmyListIntelligenceRows()
      );

  return lists;

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

  const rows = [
    ARMY_INTELLIGENCE_HEADERS
  ];

  getArmyListObjects()
    .filter(function(list) {
      return list.approved && list.armyCode;
    })
    .forEach(function(list) {

      const decoded =
        buildArmyDiagnosticDecode(
          decodeArmyCode(list.armyCode)
        );

      if (!decoded.success)
        return;

      rows.push(
        buildArmyIntelligenceRow(
          list,
          buildArmyDiagnosticSnapshot(
            list,
            decoded
          )
        )
      );

    });

  return rows;

}

function buildDeterministicArmyIntelligenceList(row) {

  const armyListId =
    getArmyIntelligenceString(row[0]);

  if (!armyListId)
    return null;

  const snapshot =
    parseDeterministicArmyIntelligenceSnapshot(row[10]);

  const faction =
    getArmyIntelligenceString(row[4]);

  const sectorial =
    getArmyIntelligenceString(row[5]) || faction;

  const decoded =
    buildDeterministicArmyIntelligenceDecodedList(row, snapshot);

  return {
    armyCode: getArmyIntelligenceString(row[2]),
    armyCodeHash: armyListId,
    date: getArmyIntelligenceString(row[1]),
    decoded: decoded,
    decodedAt: getArmyIntelligenceString(row[1]),
    error: "",
    event: "",
    faction: faction,
    gameType: "League",
    knownArmyLists: 1,
    mission: "",
    opponent: "",
    player: getArmyIntelligenceString(row[3]),
    result: "",
    sectorial: sectorial,
    snapshotKey: armyListId,
    sourceId: armyListId,
    sourcePlayer: getArmyIntelligenceString(row[3]),
    sourceType: "league",
    status: decoded ? "decoded" : "failed"
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

  const sources = [];
  const armyListsById =
    getArmyIntelligenceSourceListLookup();
  const armyListsByPlayerAndFaction =
    getArmyIntelligencePlayerFactionListLookup(armyListsById);

  appendArmyIntelligenceRecentGameSources(
    sources,
    armyListsById,
    armyListsByPlayerAndFaction
  );
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

function appendArmyIntelligenceRecentGameSources(
  sources,
  armyListsById,
  armyListsByPlayerAndFaction
) {

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
        armyCode:
          getArmyIntelligenceGameArmyCode(
            game.winnerArmyCode,
            game.winnerArmyListId,
            armyListsById,
            game.winnerDisplayName || game.winner,
            game.winnerFaction,
            armyListsByPlayerAndFaction
          ),
        armyListId: game.winnerArmyListId,
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
        armyCode:
          getArmyIntelligenceGameArmyCode(
            game.loserArmyCode,
            game.loserArmyListId,
            armyListsById,
            game.loserDisplayName || game.loser,
            game.loserFaction,
            armyListsByPlayerAndFaction
          ),
        armyListId: game.loserArmyListId,
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

function getArmyIntelligenceGameArmyCode(
  value,
  armyListId,
  armyListsById,
  player,
  faction,
  armyListsByPlayerAndFaction
) {

  const direct =
    getArmyIntelligenceString(value);

  if (direct)
    return direct;

  const id =
    getArmyIntelligenceString(armyListId);

  if (!id || !armyListsById || !armyListsById[id])
    return getArmyIntelligencePlayerFactionArmyCode(
      player,
      faction,
      armyListsByPlayerAndFaction
    );

  return getArmyIntelligenceString(
    armyListsById[id].armyCode
  );

}

function getArmyIntelligencePlayerFactionArmyCode(
  player,
  faction,
  armyListsByPlayerAndFaction
) {

  const key =
    getArmyIntelligencePlayerFactionKey(
      player,
      faction
    );

  if (
    !key ||
    !armyListsByPlayerAndFaction ||
    !armyListsByPlayerAndFaction[key]
  )
    return "";

  return getArmyIntelligenceString(
    armyListsByPlayerAndFaction[key].armyCode
  );

}

function getArmyIntelligencePlayerFactionListLookup(armyListsById) {

  const lookup = {};

  Object.keys(armyListsById || {})
    .forEach(function(id) {
      const list =
        armyListsById[id];

      if (!list || !list.armyCode)
        return;

      [
        list.player,
        list.playerDisplayName
      ].forEach(function(player) {
        const key =
          getArmyIntelligencePlayerFactionKey(
            player,
            list.faction
          );

        if (key)
          lookup[key] = list;
      });
    });

  return lookup;

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

function buildLegacyArmyIntelligenceSnapshot(source) {

  const decoded =
    buildArmyDiagnosticDecode(
      decodeArmyCode(source.armyCode)
    );

  if (!decoded.success) {
    Logger.log(
      JSON.stringify({
        armyListId: source.armyListId,
        returnStatement: "return null after !decoded.success",
        condition: "!decoded.success",
        conditionResult: !decoded.success,
        variables: {
          decodedSuccess: decoded.success
        }
      })
    );

    return null;
  }

  return {
    decoded: buildLegacyArmyIntelligenceDecodedList(decoded),
    decodedAt: new Date().toISOString(),
    error: "",
    snapshotKey: source.snapshotKey,
    status: "decoded"
  };

}

function buildLegacyArmyIntelligenceDecodedList(decoded) {

  const shared =
    decoded.sharedDecode || {};

  const entries =
    (decoded.profiles || []).map(function(unit) {
      return buildDeterministicArmyIntelligenceDecodedEntry(unit);
    });

  return {
    armyCode: getArmyIntelligenceString(shared.raw || ""),
    combatGroups:
      buildLegacyArmyIntelligenceCombatGroups(entries),
    decoderVersion: decoded.decoderVersion,
    faction: shared.faction || "",
    listName: shared.armyName || "",
    orderCounts: {
      impetuous: 0,
      irregular: 0,
      lieutenant: 0,
      regular: decoded.unitCount || 0,
      tacticalAwareness: 0
    },
    sectorial: shared.sectorial || shared.faction || "",
    totals: {
      combatGroups: shared.combatGroups || 0,
      points: decoded.points || 0,
      swc: decoded.swc || 0
    },
    units: entries
  };

}

function buildLegacyArmyIntelligenceCombatGroups(entries) {

  const groups = {};

  entries.forEach(function(entry) {
    const group =
      Number(entry.combatGroup) || 1;

    if (!groups[group])
      groups[group] = [];

    groups[group].push(entry);
  });

  return Object.keys(groups)
    .sort()
    .map(function(group) {
      return {
        combatGroup: Number(group),
        entries: groups[group]
      };
    });

}

function appendArmyIntelligenceTeamTournamentSources(sources) {

  const spreadsheet =
    lifGetTargetSpreadsheet_();

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
    armyListId: getArmyIntelligenceString(source.armyListId),
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
