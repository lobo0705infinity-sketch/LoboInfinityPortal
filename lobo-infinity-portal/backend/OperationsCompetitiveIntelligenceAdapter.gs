/*******************************************************
 * OperationsCompetitiveIntelligenceAdapter.gs
 *
 * Phase 2 subsystem adapter. Competitive Intelligence is
 * currently served by the existing league intelligence
 * endpoint, so this adapter delegates to that surface.
 *******************************************************/

const OPERATIONS_COMPETITIVE_INTELLIGENCE_ADAPTER_SCHEMA_VERSION = "competitive-intelligence-adapter-v1";

function getOperationsCompetitiveIntelligenceAdapter() {

  return {
    id: "competitiveIntelligence",
    label: "Competitive Intelligence",
    operationType: "Refresh Competitive Intelligence",
    operationClass: "Normal",
    getCurrentState: getOperationsCompetitiveIntelligenceCurrentState,
    rebuild: rebuildOperationsCompetitiveIntelligence,
    verify: verifyOperationsCompetitiveIntelligence,
    getDependencies: getOperationsCompetitiveIntelligenceDependencies,
    getAffectedCacheGroups: getOperationsCompetitiveIntelligenceAffectedCacheGroups
  };

}

function getOperationsCompetitiveIntelligenceCurrentState() {

  const sourceState =
    getOperationsCompetitiveIntelligenceSourceState();

  const sourceArtifactStateKey =
    getOperationsCompetitiveIntelligenceString(
      sourceState.artifactStateKey
    );

  const sourceHash =
    sourceArtifactStateKey ||
    getOperationsCompetitiveIntelligenceString(sourceState.sourceHash);

  const artifactStateKey =
    sourceArtifactStateKey ||
    getOperationsCompetitiveIntelligenceHash([
      OPERATIONS_COMPETITIVE_INTELLIGENCE_ADAPTER_SCHEMA_VERSION,
      sourceHash
    ].join("|"));

  const lastSuccessfulArtifactStateKey =
    typeof getOperationsEngineLatestSuccessfulArtifactStateKey === "function"
      ? getOperationsEngineLatestSuccessfulArtifactStateKey(
          "competitiveIntelligence",
          "Refresh Competitive Intelligence"
        )
      : "";

  const intelligenceAvailable =
    typeof getIntelligence === "function";

  const healthy =
    intelligenceAvailable &&
    sourceState.healthy !== false;

  const staleState =
    getOperationsCompetitiveIntelligenceStaleState(
      healthy,
      artifactStateKey,
      lastSuccessfulArtifactStateKey
    );

  return {
    subsystemId: "competitiveIntelligence",
    subsystemName: "Competitive Intelligence",
    schemaVersion: OPERATIONS_COMPETITIVE_INTELLIGENCE_ADAPTER_SCHEMA_VERSION,
    sourceHash: sourceHash,
    artifactHash:
      getOperationsCompetitiveIntelligenceHash(
        lastSuccessfulArtifactStateKey
      ),
    artifactStateKey: artifactStateKey,
    lastBuiltAt: "",
    healthy: healthy,
    stale: staleState.stale,
    staleReason: staleState.staleReason,
    details: {
      intelligenceAvailable: intelligenceAvailable,
      source: "Army Intelligence",
      sourceArtifactStateKey: sourceArtifactStateKey,
      lastSuccessfulArtifactStateKey: lastSuccessfulArtifactStateKey,
      armyIntelligenceHealthy: sourceState.healthy !== false,
      armyIntelligenceStale: sourceState.stale === true
    }
  };

}

function getOperationsCompetitiveIntelligenceSourceState() {

  if (typeof getOperationsArmyIntelligenceCurrentState !== "function")
    return {
      subsystemId: "armyIntelligence",
      subsystemName: "Army Intelligence",
      schemaVersion: "",
      sourceHash: "",
      artifactHash: "",
      artifactStateKey: "",
      lastBuiltAt: "",
      healthy: false,
      stale: true,
      staleReason: "Army Intelligence state is unavailable.",
      details: {}
    };

  return getOperationsArmyIntelligenceCurrentState();

}

function rebuildOperationsCompetitiveIntelligence() {

  if (typeof getIntelligence !== "function")
    return {
      success: false,
      error: "getIntelligence is not available."
    };

  const output =
    getIntelligence();

  return {
    success: true,
    result: {
      contentLength:
        output && typeof output.getContent === "function"
          ? output.getContent().length
          : 0
    }
  };

}

function verifyOperationsCompetitiveIntelligence() {

  const errors = [];

  if (typeof getIntelligence !== "function")
    errors.push("getIntelligence is not available.");

  return {
    success: errors.length === 0,
    errors: errors,
    warnings: [],
    metrics: {
      intelligenceAvailable: typeof getIntelligence === "function"
    }
  };

}

function requestOperationsCompetitiveIntelligenceSelfHealing(
  state,
  armyIntelligenceState,
  context,
  trigger
) {

  const currentState =
    state ||
    getOperationsCompetitiveIntelligenceCurrentState();

  const currentArmyIntelligenceState =
    armyIntelligenceState || {};

  const requestContext =
    context || {};

  if (!currentState.stale)
    return {
      success: true,
      enqueued: false,
      status: "Current",
      message: "Competitive Intelligence is not stale."
    };

  if (!currentArmyIntelligenceState.healthy)
    return {
      success: true,
      enqueued: false,
      status: "Blocked",
      message: "Army Intelligence is not healthy."
    };

  if (
    requestContext.armyIntelligenceQueue &&
    requestContext.armyIntelligenceQueue.blocked
  )
    return {
      success: true,
      enqueued: false,
      status: "Blocked",
      message:
        "Army Intelligence refresh " +
        requestContext.armyIntelligenceQueue.operationId +
        " is " +
        requestContext.armyIntelligenceQueue.status +
        "."
    };

  const armyIntelligenceArtifactStateKey =
    getOperationsCompetitiveIntelligenceString(
      currentArmyIntelligenceState.artifactStateKey
    );

  if (!armyIntelligenceArtifactStateKey)
    return {
      success: true,
      enqueued: false,
      status: "Blocked",
      message: "Army Intelligence artifact state key is unavailable."
    };

  if (
    getOperationsCompetitiveIntelligenceString(
      requestContext.lastSuccessfulArtifactStateKey
    ) === armyIntelligenceArtifactStateKey
  )
    return {
      success: true,
      enqueued: false,
      status: "Current",
      message:
        "Competitive Intelligence already refreshed this Army Intelligence artifact state."
    };

  if (typeof enqueueOperation !== "function")
    return {
      success: false,
      enqueued: false,
      status: "Unavailable",
      error: "enqueueOperation is not available."
    };

  return enqueueOperation({
    owningSubsystem: "competitiveIntelligence",
    operationType: "Refresh Competitive Intelligence",
    operationClass: "Normal",
    artifactStateKey: armyIntelligenceArtifactStateKey,
    priority: 40,
    dependencyOperationId: "",
    trigger:
      getOperationsCompetitiveIntelligenceString(trigger) ||
      "Army Intelligence artifact changed"
  });

}

function getOperationsCompetitiveIntelligenceDependencies() {

  return [
    "gameEngine",
    "armyIntelligence"
  ];

}

function getOperationsCompetitiveIntelligenceAffectedCacheGroups() {

  return [
    "analytics",
    "dashboard",
    "operations"
  ];

}

function getOperationsCompetitiveIntelligenceStaleState(
  healthy,
  artifactStateKey,
  lastSuccessfulArtifactStateKey
) {

  if (!healthy)
    return {
      stale: true,
      staleReason: "Competitive Intelligence dependencies are unavailable."
    };

  if (!artifactStateKey)
    return {
      stale: true,
      staleReason: "Army Intelligence artifact state key is unavailable."
    };

  if (
    getOperationsCompetitiveIntelligenceString(lastSuccessfulArtifactStateKey) !==
    getOperationsCompetitiveIntelligenceString(artifactStateKey)
  )
    return {
      stale: true,
      staleReason:
        "Competitive Intelligence has not refreshed the current Army Intelligence artifact state."
    };

  return {
    stale: false,
    staleReason: ""
  };

}

function getOperationsCompetitiveIntelligenceSheetHash(sheet) {

  if (!sheet)
    return "";

  return getOperationsCompetitiveIntelligenceHash(
    JSON.stringify(
      sheet
        .getDataRange()
        .getValues()
    )
  );

}

function getOperationsCompetitiveIntelligenceHash(value) {

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      getOperationsCompetitiveIntelligenceString(value),
      Utilities.Charset.UTF_8
    );

  return digest.map(function(byte) {
    const value =
      byte < 0 ? byte + 256 : byte;

    return ("0" + value.toString(16)).slice(-2);
  }).join("");

}

function getOperationsCompetitiveIntelligenceString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
