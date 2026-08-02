/*******************************************************
 * OperationsArmyIntelligenceAdapter.gs
 *
 * Phase 2 subsystem adapter. This file exposes Army
 * Intelligence contracts and delegates to existing functions.
 * It does not enqueue, schedule, or execute operations.
 *******************************************************/

const OPERATIONS_ARMY_INTELLIGENCE_ADAPTER_SCHEMA_VERSION = "army-intelligence-adapter-v1";

function getOperationsArmyIntelligenceAdapter() {

  return {
    id: "armyIntelligence",
    label: "Army Intelligence",
    operationType: "Refresh Army Intelligence",
    operationClass: "Normal",
    getCurrentState: getOperationsArmyIntelligenceCurrentState,
    rebuild: rebuildOperationsArmyIntelligence,
    verify: verifyOperationsArmyIntelligence,
    getDependencies: getOperationsArmyIntelligenceDependencies,
    getAffectedCacheGroups: getOperationsArmyIntelligenceAffectedCacheGroups
  };

}

function getOperationsArmyIntelligenceCurrentState() {

  const sources =
    typeof buildArmyIntelligenceSources === "function"
      ? buildArmyIntelligenceSources()
      : [];

  const snapshotRows =
    getOperationsArmyIntelligenceSnapshotRows();

  const decodedCount =
    snapshotRows.filter(function(row) {
      return getOperationsArmyIntelligenceString(row["Decode Status"]) === "decoded";
    }).length;

  const failedCount =
    snapshotRows.filter(function(row) {
      return getOperationsArmyIntelligenceString(row["Decode Status"]) === "failed";
    }).length;

  const healthy =
    typeof buildArmyIntelligenceSources === "function" &&
    typeof refreshArmyIntelligence === "function";

  const sourceHash =
    getOperationsArmyIntelligenceHash(JSON.stringify(sources));

  const artifactHash =
    getOperationsArmyIntelligenceHash(JSON.stringify(snapshotRows));

  const staleState =
    getOperationsArmyIntelligenceStaleState(
      healthy,
      sources,
      snapshotRows
    );

  return {
    subsystemId: "armyIntelligence",
    subsystemName: "Army Intelligence",
    schemaVersion: OPERATIONS_ARMY_INTELLIGENCE_ADAPTER_SCHEMA_VERSION,
    sourceHash: sourceHash,
    artifactHash: artifactHash,
    artifactStateKey:
      getOperationsArmyIntelligenceHash([
        OPERATIONS_ARMY_INTELLIGENCE_ADAPTER_SCHEMA_VERSION,
        sourceHash
      ].join("|")),
    lastBuiltAt: getOperationsArmyIntelligenceLatestDecodedAt(snapshotRows),
    healthy: healthy,
    stale: staleState.stale,
    staleReason: staleState.staleReason,
    details: {
      sourceCount: sources.length,
      snapshotCount: snapshotRows.length,
      decodedCount: decodedCount,
      failedCount: failedCount,
      missingSnapshotCount: staleState.missingSnapshotCount,
      pendingSnapshotCount: staleState.pendingSnapshotCount,
      refreshAvailable: typeof refreshArmyIntelligence === "function"
    }
  };

}

function rebuildOperationsArmyIntelligence(context) {

  if (typeof refreshArmyIntelligence !== "function")
    return {
      success: false,
      error: "refreshArmyIntelligence is not available."
    };

  return refreshArmyIntelligence(
    context && context.event
      ? context.event
      : {}
  );

}

function verifyOperationsArmyIntelligence() {

  const sources =
    typeof buildArmyIntelligenceSources === "function"
      ? buildArmyIntelligenceSources()
      : [];

  const snapshotRows =
    getOperationsArmyIntelligenceSnapshotRows();

  const decodedCount =
    snapshotRows.filter(function(row) {
      return getOperationsArmyIntelligenceString(row["Decode Status"]) === "decoded";
    }).length;

  const failedCount =
    snapshotRows.filter(function(row) {
      return getOperationsArmyIntelligenceString(row["Decode Status"]) === "failed";
    }).length;

  const errors = [];

  if (typeof buildArmyIntelligenceSources !== "function")
    errors.push("buildArmyIntelligenceSources is not available.");

  if (typeof refreshArmyIntelligence !== "function")
    errors.push("refreshArmyIntelligence is not available.");

  return {
    success: errors.length === 0,
    errors: errors,
    warnings: [],
    metrics: {
      sourceCount: sources.length,
      snapshotCount: snapshotRows.length,
      decodedCount: decodedCount,
      failedCount: failedCount,
      pendingCount: Math.max(0, sources.length - decodedCount - failedCount)
    }
  };

}

function requestOperationsArmyIntelligenceSelfHealing(
  state,
  gameEngineState,
  context,
  trigger
) {

  const currentState =
    state ||
    getOperationsArmyIntelligenceCurrentState();

  const currentGameEngineState =
    gameEngineState || {};

  const requestContext =
    context || {};

  if (!currentState.stale)
    return {
      success: true,
      enqueued: false,
      status: "Current",
      message: "Army Intelligence is not stale."
    };

  if (!currentGameEngineState.healthy)
    return {
      success: true,
      enqueued: false,
      status: "Blocked",
      message: "Game Engine is not healthy."
    };

  if (
    requestContext.gameEngineQueue &&
    requestContext.gameEngineQueue.blocked
  )
    return {
      success: true,
      enqueued: false,
      status: "Blocked",
      message:
        "Game Engine rebuild " +
        requestContext.gameEngineQueue.operationId +
        " is " +
        requestContext.gameEngineQueue.status +
        "."
    };

  const gameEngineArtifactStateKey =
    getOperationsArmyIntelligenceString(
      currentGameEngineState.artifactStateKey
    );

  if (!gameEngineArtifactStateKey)
    return {
      success: true,
      enqueued: false,
      status: "Blocked",
      message: "Game Engine artifact state key is unavailable."
    };

  if (
    getOperationsArmyIntelligenceString(
      requestContext.lastSuccessfulArtifactStateKey
    ) === gameEngineArtifactStateKey
  )
    return {
      success: true,
      enqueued: false,
      status: "Current",
      message:
        "Army Intelligence already refreshed this Game Engine artifact state."
    };

  if (typeof enqueueOperation !== "function")
    return {
      success: false,
      enqueued: false,
      status: "Unavailable",
      error: "enqueueOperation is not available."
    };

  return enqueueOperation({
    owningSubsystem: "armyIntelligence",
    operationType: "Refresh Army Intelligence",
    operationClass: "Normal",
    artifactStateKey: gameEngineArtifactStateKey,
    priority: 60,
    dependencyOperationId: "",
    trigger:
      getOperationsArmyIntelligenceString(trigger) ||
      "Game Engine artifact changed"
  });

}

function getOperationsArmyIntelligenceDependencies() {

  return ["gameEngine"];

}

function getOperationsArmyIntelligenceAffectedCacheGroups() {

  return [
    "armyIntelligence",
    "analytics",
    "operations"
  ];

}

function getOperationsArmyIntelligenceSnapshotRows() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(ARMY_INTELLIGENCE_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2)
    return [];

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values
      .shift()
      .map(getOperationsArmyIntelligenceString);

  return values.map(function(row) {
    const record = {};

    ARMY_INTELLIGENCE_HEADERS.forEach(function(header) {
      const column =
        headers.indexOf(header);

      record[header] =
        column === -1
          ? ""
          : row[column];
    });

    return record;
  });

}

function getOperationsArmyIntelligenceLatestDecodedAt(rows) {

  return rows
    .map(function(row) {
      return getOperationsArmyIntelligenceString(row["Decoded At"]);
    })
    .filter(function(value) {
      return value !== "";
    })
    .sort()
    .pop() || "";

}

function getOperationsArmyIntelligenceStaleState(
  healthy,
  sources,
  snapshotRows
) {

  if (!healthy)
    return {
      stale: true,
      staleReason: "Army Intelligence dependencies are unavailable.",
      missingSnapshotCount: 0,
      pendingSnapshotCount: 0
    };

  const snapshotsByKey = {};

  snapshotRows.forEach(function(row) {
    const snapshotKey =
      getOperationsArmyIntelligenceString(row["Snapshot Key"]);

    if (snapshotKey)
      snapshotsByKey[snapshotKey] = row;
  });

  let missingSnapshotCount = 0;
  let pendingSnapshotCount = 0;

  sources.forEach(function(source) {
    const snapshot =
      snapshotsByKey[getOperationsArmyIntelligenceString(source.snapshotKey)];

    if (!snapshot) {
      missingSnapshotCount += 1;
      return;
    }

    const status =
      getOperationsArmyIntelligenceString(snapshot["Decode Status"]);

    if (
      status !== "decoded" &&
      status !== "failed"
    )
      pendingSnapshotCount += 1;
  });

  if (missingSnapshotCount > 0)
    return {
      stale: true,
      staleReason:
        missingSnapshotCount +
        " Army Intelligence source rows do not have snapshots.",
      missingSnapshotCount: missingSnapshotCount,
      pendingSnapshotCount: pendingSnapshotCount
    };

  if (pendingSnapshotCount > 0)
    return {
      stale: true,
      staleReason:
        pendingSnapshotCount +
        " Army Intelligence snapshots are pending decode.",
      missingSnapshotCount: missingSnapshotCount,
      pendingSnapshotCount: pendingSnapshotCount
    };

  return {
    stale: false,
    staleReason: "",
    missingSnapshotCount: 0,
    pendingSnapshotCount: 0
  };

}

function getOperationsArmyIntelligenceHash(value) {

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      getOperationsArmyIntelligenceString(value),
      Utilities.Charset.UTF_8
    );

  return digest.map(function(byte) {
    const value =
      byte < 0 ? byte + 256 : byte;

    return ("0" + value.toString(16)).slice(-2);
  }).join("");

}

function getOperationsArmyIntelligenceString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
