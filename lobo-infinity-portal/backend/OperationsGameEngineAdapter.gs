/*******************************************************
 * OperationsGameEngineAdapter.gs
 *
 * Phase 2 subsystem adapter. This file exposes Game Engine
 * state, rebuild, verification, dependency, and cache contracts.
 * It does not enqueue, schedule, or execute operations.
 *******************************************************/

const OPERATIONS_GAME_ENGINE_ADAPTER_SCHEMA_VERSION = "game-engine-adapter-v1";

function getOperationsGameEngineAdapter() {

  return {
    id: "gameEngine",
    label: "Game Engine",
    operationType: "Rebuild Game Engine",
    operationClass: "High",
    getCurrentState: getOperationsGameEngineCurrentState,
    rebuild: rebuildOperationsGameEngine,
    verify: verifyOperationsGameEngine,
    getDependencies: getOperationsGameEngineDependencies,
    getAffectedCacheGroups: getOperationsGameEngineAffectedCacheGroups
  };

}

function getOperationsGameEngineCurrentState() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  const formSheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.FORM);

  const engineSheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.ENGINE);

  const analyticsSheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.GAME_ANALYTICS);

  const healthy =
    !!formSheet &&
    !!engineSheet &&
    !!analyticsSheet &&
    typeof rebuildGameEngine === "function";

  const formRows =
    getOperationsGameEngineDataRows(formSheet);

  const engineRows =
    getOperationsGameEngineDataRows(engineSheet);

  const analyticsState =
    getOperationsGameEngineAnalyticsState(analyticsSheet);

  const sourceHash =
    getOperationsGameEngineSheetHash(formSheet);

  const artifactHash =
    getOperationsGameEngineHash([
      getOperationsGameEngineSheetHash(engineSheet),
      getOperationsGameEngineSheetHash(analyticsSheet)
    ].join("|"));

  const staleState =
    getOperationsGameEngineStaleState(
      healthy,
      formRows,
      analyticsState
    );

  return {
    subsystemId: "gameEngine",
    subsystemName: "Game Engine",
    schemaVersion: OPERATIONS_GAME_ENGINE_ADAPTER_SCHEMA_VERSION,
    sourceHash: sourceHash,
    artifactHash: artifactHash,
    artifactStateKey:
      getOperationsGameEngineHash([
        OPERATIONS_GAME_ENGINE_ADAPTER_SCHEMA_VERSION,
        sourceHash
      ].join("|")),
    lastBuiltAt: "",
    healthy: healthy,
    stale: staleState.stale,
    staleReason: staleState.staleReason,
    details: {
      formRows: formRows,
      engineRows: engineRows,
      analyticsRows: analyticsState.analyticsRows,
      blankArmyCodeRows: analyticsState.blankArmyCodeRows.length,
      rebuildAvailable: typeof rebuildGameEngine === "function"
    }
  };

}

function rebuildOperationsGameEngine() {

  if (typeof rebuildGameEngine !== "function")
    return {
      success: false,
      error: "rebuildGameEngine is not available."
    };

  const result =
    rebuildGameEngine();

  return {
    success: true,
    result: result || {}
  };

}

function verifyOperationsGameEngine() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  const sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.GAME_ANALYTICS);

  if (!sheet)
    return {
      success: false,
      errors: ["Game Analytics sheet is missing."],
      warnings: [],
      metrics: {}
    };

  const analyticsState =
    getOperationsGameEngineAnalyticsState(sheet);

  const errors = [];

  if (analyticsState.missingHeaders.indexOf("Winner Army Code") !== -1)
    errors.push("Winner Army Code header is missing.");

  if (analyticsState.missingHeaders.indexOf("Loser Army Code") !== -1)
    errors.push("Loser Army Code header is missing.");

  if (analyticsState.blankArmyCodeRows.length > 0)
    errors.push(
      analyticsState.blankArmyCodeRows.length +
      " Game Analytics rows have blank Winner/Loser Army Code fields."
    );

  return {
    success: errors.length === 0,
    errors: errors,
    warnings: [],
    metrics: {
      analyticsRows: analyticsState.analyticsRows,
      blankArmyCodeRows: analyticsState.blankArmyCodeRows.length
    }
  };

}

function requestOperationsGameEngineSelfHealing(state, trigger) {

  const currentState =
    state ||
    getOperationsGameEngineCurrentState();

  if (!currentState.stale)
    return {
      success: true,
      enqueued: false,
      status: "Healthy",
      message: "Game Engine is not stale."
    };

  if (!currentState.healthy)
    return {
      success: true,
      enqueued: false,
      status: "Unhealthy",
      message:
        "Game Engine is stale but cannot be queued because dependencies are unavailable."
    };

  if (typeof enqueueOperation !== "function")
    return {
      success: false,
      enqueued: false,
      status: "Unavailable",
      error: "enqueueOperation is not available."
    };

  return enqueueOperation({
    owningSubsystem: "gameEngine",
    operationType: "Rebuild Game Engine",
    operationClass: "High",
    artifactStateKey: currentState.artifactStateKey,
    priority: 90,
    dependencyOperationId: "",
    trigger:
      getOperationsGameEngineString(trigger) ||
      "Game Engine stale state detected"
  });

}

function getOperationsGameEngineDependencies() {

  return [];

}

function getOperationsGameEngineAffectedCacheGroups() {

  return [
    "dashboard",
    "standings",
    "players",
    "analytics",
    "armyIntelligence",
    "operations"
  ];

}

function getOperationsGameEngineSheetHash(sheet) {

  if (!sheet)
    return "";

  return getOperationsGameEngineHash(
    JSON.stringify(
      sheet
        .getDataRange()
        .getValues()
    )
  );

}

function getOperationsGameEngineHash(value) {

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      getOperationsGameEngineString(value),
      Utilities.Charset.UTF_8
    );

  return digest.map(function(byte) {
    const value =
      byte < 0 ? byte + 256 : byte;

    return ("0" + value.toString(16)).slice(-2);
  }).join("");

}

function getOperationsGameEngineDataRows(sheet) {

  if (!sheet)
    return 0;

  return Math.max(0, sheet.getLastRow() - 1);

}

function getOperationsGameEngineAnalyticsState(sheet) {

  if (!sheet)
    return {
      analyticsRows: 0,
      blankArmyCodeRows: [],
      missingHeaders: [
        "Winner Army Code",
        "Loser Army Code"
      ]
    };

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length < 1)
    return {
      analyticsRows: 0,
      blankArmyCodeRows: [],
      missingHeaders: [
        "Winner Army Code",
        "Loser Army Code"
      ]
    };

  const headers =
    values[0].map(getOperationsGameEngineString);

  const winnerColumn =
    headers.indexOf("Winner Army Code");

  const loserColumn =
    headers.indexOf("Loser Army Code");

  const missingHeaders = [];

  if (winnerColumn === -1)
    missingHeaders.push("Winner Army Code");

  if (loserColumn === -1)
    missingHeaders.push("Loser Army Code");

  const blankRows = [];

  if (
    winnerColumn !== -1 &&
    loserColumn !== -1
  ) {
    values
      .slice(1)
      .forEach(function(row, index) {
        const hasAnyGameData =
          row.some(function(value) {
            return getOperationsGameEngineString(value) !== "";
          });

        if (
          hasAnyGameData &&
          (
            !getOperationsGameEngineString(row[winnerColumn]) ||
            !getOperationsGameEngineString(row[loserColumn])
          )
        )
          blankRows.push(index + 2);
      });
  }

  return {
    analyticsRows: Math.max(0, values.length - 1),
    blankArmyCodeRows: blankRows,
    missingHeaders: missingHeaders
  };

}

function getOperationsGameEngineStaleState(healthy, formRows, analyticsState) {

  if (!healthy)
    return {
      stale: true,
      staleReason: "Game Engine dependencies are unavailable."
    };

  if (analyticsState.missingHeaders.length > 0)
    return {
      stale: true,
      staleReason:
        "Game Analytics is missing required headers: " +
        analyticsState.missingHeaders.join(", ") +
        "."
    };

  if (analyticsState.analyticsRows < formRows)
    return {
      stale: true,
      staleReason: "Game Analytics has fewer rows than Form Responses."
    };

  if (analyticsState.blankArmyCodeRows.length > 0)
    return {
      stale: true,
      staleReason:
        analyticsState.blankArmyCodeRows.length +
        " Game Analytics rows are missing Winner/Loser Army Code fields."
    };

  return {
    stale: false,
    staleReason: ""
  };

}

function getOperationsGameEngineString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
