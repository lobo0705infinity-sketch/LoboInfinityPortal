const CANONICAL_REBUILD_OBLIGATION_PROPERTY = "CANONICAL_GAME_ENGINE_REBUILD_OBLIGATION_V1";

function coordinateCanonicalRebuild(command) {
  const input = command || {};
  const obligation = input.rebuildObligation || markCanonicalRebuildRequired_({
    reason: "coordinator",
    targetRow: input.targetRow,
    workflow: input.workflow
  });
  const state = canonicalRebuildBegin_(input);
  state.rebuildGeneration = Number(obligation && obligation.generation) || 0;

  try {
    canonicalRebuildInvoke_(state.functionName, input.logMissing === true);
    canonicalRebuildComplete_(state);
    completeCanonicalRebuildObligation_(state.rebuildGeneration);
    return state;
  } catch (error) {
    canonicalRebuildFail_(state, error);
    failCanonicalRebuildObligation_(state.rebuildGeneration, state.functionName, error);
    canonicalRebuildRecordFailure_(input, state, error);

    if (error && (typeof error === "object" || typeof error === "function"))
      error.canonicalRebuildState = state;

    throw error;
  }
}

function markCanonicalRebuildRequired_(context) {
  return withCanonicalRebuildObligationLock_(function() {
    const current = getCanonicalRebuildObligation_();
    const input = context || {};
    const now = new Date().toISOString();
    const next = {
      required: true,
      generation: Number(current.generation || 0) + 1,
      markedAt: now,
      lastAttemptAt: current.lastAttemptAt || "",
      lastFailureAt: current.lastFailureAt || "",
      lastFailureStage: current.lastFailureStage || "",
      lastFailureMessage: current.lastFailureMessage || "",
      lastSuccessAt: current.lastSuccessAt || "",
      reason: canonicalRebuildSafeString_(input.reason || "canonical-mutation"),
      targetRow: Number(input.targetRow) || 0,
      workflow: canonicalRebuildSafeString_(input.workflow)
    };
    setCanonicalRebuildObligation_(next);
    return next;
  });
}

function recoverPendingCanonicalRebuildBestEffort_() {
  const obligation = getCanonicalRebuildObligation_();

  if (obligation.required !== true)
    return { attempted: false, required: false, success: true };

  const generation = Number(obligation.generation) || 0;
  recordCanonicalRebuildAttempt_(generation);

  try {
    const functionName = canonicalRebuildFunctionName_();
    canonicalRebuildInvoke_(functionName, true);
    const completed = completeCanonicalRebuildObligation_(generation);

    if (typeof markCanonicalRebuildRecoveryProjectionsDirty_ === "function")
      markCanonicalRebuildRecoveryProjectionsDirty_();

    return {
      attempted: true,
      cleared: completed.cleared === true,
      functionName: functionName,
      generation: generation,
      required: completed.required === true,
      success: true
    };
  }
  catch (error) {
    failCanonicalRebuildObligation_(generation, canonicalRebuildFunctionName_(), error);
    return {
      attempted: true,
      error: canonicalRebuildSafeString_(error && error.message ? error.message : error),
      generation: generation,
      required: true,
      success: false
    };
  }
}

function requestCanonicalRebuildRecovery(e) {
  const parameters = getApiParameters(e);
  const obligation = markCanonicalRebuildRequired_({
    reason: getApiParameter(parameters, "reason") || "authorized-recovery-request",
    targetRow: getApiParameter(parameters, "targetRow"),
    workflow: getApiParameter(parameters, "workflow")
  });
  return jsonOutput({
    generation: obligation.generation,
    required: true,
    success: true
  });
}

function getCanonicalRebuildObligation_() {
  const raw = PropertiesService
    .getScriptProperties()
    .getProperty(CANONICAL_REBUILD_OBLIGATION_PROPERTY);

  if (!raw)
    return { required: false, generation: 0 };

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? parsed
      : { required: false, generation: 0 };
  }
  catch (error) {
    return { required: true, generation: 0, lastFailureMessage: "Invalid rebuild obligation state." };
  }
}

function setCanonicalRebuildObligation_(state) {
  PropertiesService
    .getScriptProperties()
    .setProperty(CANONICAL_REBUILD_OBLIGATION_PROPERTY, JSON.stringify(state));
}

function recordCanonicalRebuildAttempt_(generation) {
  return withCanonicalRebuildObligationLock_(function() {
    const current = getCanonicalRebuildObligation_();
    if (current.required !== true || Number(current.generation) !== Number(generation))
      return current;
    current.lastAttemptAt = new Date().toISOString();
    setCanonicalRebuildObligation_(current);
    return current;
  });
}

function completeCanonicalRebuildObligation_(generation) {
  return withCanonicalRebuildObligationLock_(function() {
    const current = getCanonicalRebuildObligation_();
    const now = new Date().toISOString();

    if (current.required === true && Number(current.generation) === Number(generation)) {
      current.required = false;
      current.cleared = true;
      current.lastSuccessAt = now;
      current.lastFailureAt = "";
      current.lastFailureStage = "";
      current.lastFailureMessage = "";
      setCanonicalRebuildObligation_(current);
      return current;
    }

    return {
      cleared: false,
      generation: Number(current.generation) || 0,
      required: current.required === true
    };
  });
}

function failCanonicalRebuildObligation_(generation, stage, error) {
  return withCanonicalRebuildObligationLock_(function() {
    const current = getCanonicalRebuildObligation_();
    if (Number(current.generation) !== Number(generation))
      return current;
    current.required = true;
    current.lastAttemptAt = new Date().toISOString();
    current.lastFailureAt = current.lastAttemptAt;
    current.lastFailureStage = canonicalRebuildSafeString_(stage || "rebuild");
    current.lastFailureMessage = canonicalRebuildSafeString_(
      error && error.message ? error.message : error
    ).slice(0, 500);
    setCanonicalRebuildObligation_(current);
    return current;
  });
}

function withCanonicalRebuildObligationLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return callback();
  }
  finally {
    lock.releaseLock();
  }
}

function canonicalRebuildSafeString_(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function retryCanonicalRebuild(command) {
  const input = command || {};
  const previousState = input.previousState || null;

  if (!previousState || previousState.eligibleForRetry !== true)
    return previousState || {
      status: "Retry Not Eligible",
      eligibleForRetry: false,
      attempt: 0,
      lifecycle: []
    };

  const retryCommand = {};
  Object.keys(input).forEach(function(key) {
    retryCommand[key] = input[key];
  });
  retryCommand.previousState = previousState;

  return coordinateCanonicalRebuild(retryCommand);
}

function canonicalRebuildBegin_(command) {
  const previousState = command.previousState || null;
  const lifecycle = previousState && Array.isArray(previousState.lifecycle)
    ? previousState.lifecycle.slice()
    : ["Received", "Validated", "Canonical Commit"];

  lifecycle.push("Rebuild Started");

  return {
    status: "Rebuild Started",
    functionName: canonicalRebuildFunctionName_(),
    attempt: previousState ? Number(previousState.attempt || 0) + 1 : 1,
    startedAt: new Date().toISOString(),
    completedAt: "",
    failedAt: "",
    errorMessage: "",
    errorStack: "",
    eligibleForRetry: false,
    lifecycle: lifecycle
  };
}

function canonicalRebuildComplete_(state) {
  state.status = "Rebuild Complete";
  state.completedAt = new Date().toISOString();
  state.eligibleForRetry = false;
  state.lifecycle.push("Rebuild Complete");
  return state;
}

function canonicalRebuildFail_(state, error) {
  state.status = "Rebuild Failed";
  state.failedAt = new Date().toISOString();
  state.errorMessage = error && error.message ? String(error.message) : String(error);
  state.errorStack = error && error.stack ? String(error.stack) : "";
  state.eligibleForRetry = true;
  state.lifecycle.push("Rebuild Failed");
  return state;
}

function canonicalRebuildRecordFailure_(command, state) {
  if (!command.importLog)
    return;

  lifWriteImportLog_(
    command.importLog,
    command.responseKey,
    command.workflow,
    command.targetRow,
    "Rebuild Failed",
    JSON.stringify({
      timestamp: state.failedAt,
      functionName: state.functionName,
      message: state.errorMessage,
      stack: state.errorStack
    })
  );
}

function canonicalRebuildInvoke_(functionName, logMissing) {
  if (functionName === "rebuildEverything")
    rebuildEverything();
  else if (functionName === "rebuildGameEngine")
    rebuildGameEngine();
  else if (logMissing)
    Logger.log("Import complete. Deterministic rebuild function is not present in this Apps Script runtime.");
}

function canonicalRebuildFunctionName_() {
  if (typeof rebuildEverything === "function")
    return "rebuildEverything";

  if (typeof rebuildGameEngine === "function")
    return "rebuildGameEngine";

  return "none";
}
