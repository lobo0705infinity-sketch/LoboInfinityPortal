function coordinateCanonicalRebuild(command) {
  const input = command || {};
  const state = canonicalRebuildBegin_(input);

  try {
    canonicalRebuildInvoke_(state.functionName, input.logMissing === true);
    return canonicalRebuildComplete_(state);
  } catch (error) {
    canonicalRebuildFail_(state, error);
    canonicalRebuildRecordFailure_(input, state, error);

    if (error && (typeof error === "object" || typeof error === "function"))
      error.canonicalRebuildState = state;

    throw error;
  }
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
