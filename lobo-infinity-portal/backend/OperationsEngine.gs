/*******************************************************
 * OperationsEngine.gs
 *
 * Operations Queue, Operation Log, passive subsystem state,
 * one-at-a-time queue execution, and explicit queue requests.
 * This file does not infer stale work; subsystem adapters own
 * any allowed self-healing request.
 *******************************************************/

const OPERATIONS_ENGINE_QUEUE_SHEET_NAME = "Operations Queue";
const OPERATIONS_ENGINE_LOG_SHEET_NAME = "Operations Log";

const OPERATIONS_ENGINE_OPERATION_CLASSES = [
  "Immediate",
  "High",
  "Normal",
  "Background"
];

const OPERATIONS_ENGINE_QUEUE_IDENTITY_FIELDS = [
  "Owning Subsystem",
  "Operation Type",
  "Artifact State Key"
];

const OPERATIONS_ENGINE_QUEUE_HEADERS = [
  "Operation ID",
  "Operation Type",
  "Operation Class",
  "Owning Subsystem",
  "Artifact State Key",
  "Status",
  "Priority",
  "Dependency Operation ID",
  "Retry Count",
  "Primary Trigger",
  "Trigger Count",
  "Triggers JSON",
  "Latest Trigger At",
  "Queue Position",
  "Created At",
  "Started At",
  "Completed At",
  "Updated At",
  "Error Message",
  "Verification Result JSON"
];

const OPERATIONS_ENGINE_LOG_HEADERS = [
  "Log ID",
  "Operation ID",
  "Operation Type",
  "Operation Class",
  "Owning Subsystem",
  "Artifact State Key",
  "Event Type",
  "Trigger",
  "Triggered At",
  "Merged Operation ID",
  "Status",
  "Success",
  "Started At",
  "Completed At",
  "Duration Ms",
  "Rows Processed",
  "Cache Invalidations JSON",
  "Downstream Operations JSON",
  "Verification Result JSON",
  "Retry Count",
  "Error Message",
  "Created At"
];

const OPERATIONS_ENGINE_RUNNABLE_STATUSES = [
  "Queued",
  "Retrying",
  "Waiting on Dependency"
];

const OPERATIONS_ENGINE_COALESCING_STATUSES = [
  "Queued",
  "Retrying",
  "Waiting on Dependency",
  "Running",
  "Completed",
  "Failed"
];

const OPERATIONS_ENGINE_TERMINAL_STATUSES = [
  "Completed",
  "Failed"
];

const OPERATIONS_ENGINE_LOCK_WAIT_MS = 5000;
const OPERATIONS_ENGINE_SHADOW_MODE = true;

function getOperationsEngineQueue() {

  const sheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_QUEUE_SHEET_NAME,
      OPERATIONS_ENGINE_QUEUE_HEADERS
    );

  const queue =
    getOperationsEngineObjectsFromSheet(
      sheet,
      OPERATIONS_ENGINE_QUEUE_HEADERS
    ).map(normalizeOperationsEngineQueueRecord);

  return jsonOutput({
    success: true,
    generatedAt: getOperationsEngineTimestamp(),
    operationClasses: OPERATIONS_ENGINE_OPERATION_CLASSES.slice(),
    coalescingKey: OPERATIONS_ENGINE_QUEUE_IDENTITY_FIELDS.slice(),
    schema: OPERATIONS_ENGINE_QUEUE_HEADERS.slice(),
    queue: queue
  });

}

function getOperationsEngineLog() {

  const sheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_LOG_SHEET_NAME,
      OPERATIONS_ENGINE_LOG_HEADERS
    );

  const log =
    getOperationsEngineObjectsFromSheet(
      sheet,
      OPERATIONS_ENGINE_LOG_HEADERS
    ).map(normalizeOperationsEngineLogRecord);

  return jsonOutput({
    success: true,
    generatedAt: getOperationsEngineTimestamp(),
    schema: OPERATIONS_ENGINE_LOG_HEADERS.slice(),
    log: log
  });

}

function getOperationsEngineState() {

  const states =
    getOperationsEngineSubsystemStates();

  const gameEngineSelfHealing =
    requestOperationsEngineGameEngineSelfHealing(states);

  const armyIntelligenceSelfHealing =
    requestOperationsEngineArmyIntelligenceSelfHealing(states);

  const competitiveIntelligenceSelfHealing =
    requestOperationsEngineCompetitiveIntelligenceSelfHealing(states);

  const shadowPlanning =
    planOperationsEngineShadowQueue();

  return jsonOutput({
    success: true,
    generatedAt: getOperationsEngineTimestamp(),
    shadowMode: isOperationsEngineShadowMode(),
    healthy:
      states.every(function(state) {
        return state.healthy;
      }),
    stale:
      states.some(function(state) {
        return state.stale;
      }),
    staleCount:
      states.filter(function(state) {
        return state.stale;
      }).length,
    gameEngineSelfHealing: gameEngineSelfHealing,
    armyIntelligenceSelfHealing: armyIntelligenceSelfHealing,
    competitiveIntelligenceSelfHealing: competitiveIntelligenceSelfHealing,
    shadowPlanning: shadowPlanning,
    states: states
  });

}

function requestOperationsEngineGameEngineSelfHealing(states) {

  if (typeof requestOperationsGameEngineSelfHealing !== "function")
    return {
      success: true,
      enqueued: false,
      status: "Unavailable",
      message: "Game Engine self-healing adapter is unavailable."
    };

  const state =
    states
      .filter(function(item) {
        return item.subsystemId === "gameEngine";
      })[0];

  return requestOperationsGameEngineSelfHealing(
    state,
    "Game Engine stale state detected"
  );

}

function requestOperationsEngineArmyIntelligenceSelfHealing(states) {

  if (typeof requestOperationsArmyIntelligenceSelfHealing !== "function")
    return {
      success: true,
      enqueued: false,
      status: "Unavailable",
      message: "Army Intelligence self-healing adapter is unavailable."
    };

  const armyState =
    states
      .filter(function(item) {
        return item.subsystemId === "armyIntelligence";
      })[0];

  const gameEngineState =
    states
      .filter(function(item) {
        return item.subsystemId === "gameEngine";
      })[0];

  return requestOperationsArmyIntelligenceSelfHealing(
    armyState,
    gameEngineState,
    {
      gameEngineQueue:
        getOperationsEngineBlockingOperationState(
          "gameEngine",
          "Rebuild Game Engine"
        ),
      lastSuccessfulArtifactStateKey:
        getOperationsEngineLatestSuccessfulArtifactStateKey(
          "armyIntelligence",
          "Refresh Army Intelligence"
        )
    },
    "Game Engine artifact changed"
  );

}

function requestOperationsEngineCompetitiveIntelligenceSelfHealing(states) {

  if (typeof requestOperationsCompetitiveIntelligenceSelfHealing !== "function")
    return {
      success: true,
      enqueued: false,
      status: "Unavailable",
      message: "Competitive Intelligence self-healing adapter is unavailable."
    };

  const competitiveState =
    states
      .filter(function(item) {
        return item.subsystemId === "competitiveIntelligence";
      })[0];

  const armyState =
    states
      .filter(function(item) {
        return item.subsystemId === "armyIntelligence";
      })[0];

  return requestOperationsCompetitiveIntelligenceSelfHealing(
    competitiveState,
    armyState,
    {
      armyIntelligenceQueue:
        getOperationsEngineBlockingOperationState(
          "armyIntelligence",
          "Refresh Army Intelligence"
        ),
      lastSuccessfulArtifactStateKey:
        getOperationsEngineLatestSuccessfulArtifactStateKey(
          "competitiveIntelligence",
          "Refresh Competitive Intelligence"
        )
    },
    "Army Intelligence artifact changed"
  );

}

function enqueueOperation(request) {

  const lock =
    LockService.getScriptLock();

  if (!lock.tryLock(OPERATIONS_ENGINE_LOCK_WAIT_MS))
    return {
      success: false,
      enqueued: false,
      status: "Locked",
      error: "Operations Queue is locked."
    };

  try {
    return enqueueOperationWithLock(request);
  }
  finally {
    lock.releaseLock();
  }

}

function enqueueOperationWithLock(request) {

  const operation =
    normalizeOperationsEngineOperationRequest(request);

  if (!hasOperationsEngineRequiredOperationFields(operation))
    return {
      success: false,
      enqueued: false,
      status: "Invalid",
      error: "Operation request is missing required identity fields."
    };

  const queueSheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_QUEUE_SHEET_NAME,
      OPERATIONS_ENGINE_QUEUE_HEADERS
    );

  const logSheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_LOG_SHEET_NAME,
      OPERATIONS_ENGINE_LOG_HEADERS
    );

  const queueRows =
    getOperationsEngineQueueRows(queueSheet);

  const existing =
    findOperationsEngineQueueRowForRequest(queueRows, operation);

  if (existing)
    return mergeOperationsEngineQueueRequest(
      queueSheet,
      logSheet,
      existing,
      operation
    );

  return appendOperationsEngineQueueRequest(
    queueSheet,
    logSheet,
    operation,
    queueRows.length + 1
  );

}

function normalizeOperationsEngineOperationRequest(request) {

  request =
    request || {};

  const createdAt =
    getOperationsEngineTimestamp();

  const trigger =
    getOperationsEngineString(request.trigger) ||
    "Operations Engine";

  const triggeredAt =
    getOperationsEngineString(request.triggeredAt) ||
    createdAt;

  const triggerRecord = {
    trigger: trigger,
    triggeredAt: triggeredAt
  };

  return {
    operationId:
      getOperationsEngineString(request.operationId) ||
      createOperationsEngineId("op"),
    operationType:
      getOperationsEngineString(request.operationType),
    operationClass:
      getOperationsEngineString(request.operationClass) ||
      "Normal",
    owningSubsystem:
      getOperationsEngineString(request.owningSubsystem),
    artifactStateKey:
      getOperationsEngineString(request.artifactStateKey),
    status: "Queued",
    priority:
      getOperationsEngineNumber(request.priority),
    dependencyOperationId:
      getOperationsEngineString(request.dependencyOperationId),
    retryCount: 0,
    primaryTrigger: trigger,
    triggerCount: 1,
    triggers: [triggerRecord],
    latestTriggerAt: triggeredAt,
    queuePosition: 0,
    createdAt: createdAt,
    startedAt: "",
    completedAt: "",
    updatedAt: createdAt,
    errorMessage: "",
    verificationResult: {}
  };

}

function findOperationsEngineQueueRowForRequest(queueRows, operation) {

  const key =
    getOperationsEngineCoalescingKey(operation);

  return queueRows
    .filter(function(row) {
      return getOperationsEngineCoalescingKey(row.record) === key;
    })
    .sort(compareOperationsEngineCoalescingRows)[0] || null;

}

function appendOperationsEngineQueueRequest(
  queueSheet,
  logSheet,
  operation,
  queuePosition
) {

  const createdAt =
    operation.createdAt ||
    getOperationsEngineTimestamp();

  operation.queuePosition = queuePosition;

  queueSheet.appendRow(
    OPERATIONS_ENGINE_QUEUE_HEADERS.map(function(header) {
      return getOperationsEngineQueueValue(operation, header);
    })
  );

  appendOperationsEngineLog(
    logSheet,
    buildOperationsEngineQueueRequestLog(
      operation,
      "Enqueued",
      "",
      createdAt
    )
  );

  return {
    success: true,
    enqueued: true,
    status: "Queued",
    operationId: operation.operationId,
    artifactStateKey: operation.artifactStateKey
  };

}

function mergeOperationsEngineQueueRequest(
  queueSheet,
  logSheet,
  existing,
  operation
) {

  const updatedAt =
    getOperationsEngineTimestamp();

  const triggers =
    mergeOperationsEngineTriggers(existing.record, operation);

  const status =
    getOperationsEngineStatusAfterEnqueue(existing.record.status);

  const patch = {
    "Status": status,
    "Priority":
      Math.max(existing.record.priority, operation.priority),
    "Trigger Count": triggers.length,
    "Triggers JSON": JSON.stringify(triggers),
    "Latest Trigger At":
      getOperationsEngineLatestTimestamp([
        existing.record.latestTriggerAt,
        operation.latestTriggerAt
      ]),
    "Updated At": updatedAt,
    "Error Message": "",
    "Verification Result JSON": ""
  };

  if (status !== "Running") {
    patch["Started At"] = "";
    patch["Completed At"] = "";
  }

  updateOperationsEngineQueueRow(
    queueSheet,
    existing.rowNumber,
    patch
  );

  appendOperationsEngineLog(
    logSheet,
    buildOperationsEngineQueueRequestLog(
      Object.assign({}, operation, {
        operationId: existing.record.operationId,
        status: status,
        triggerCount: triggers.length,
        triggers: triggers
      }),
      "Merged",
      existing.record.operationId,
      updatedAt
    )
  );

  return {
    success: true,
    enqueued: false,
    status: "Merged",
    operationId: existing.record.operationId,
    artifactStateKey: existing.record.artifactStateKey
  };

}

function getOperationsEngineStatusAfterEnqueue(status) {

  const normalizedStatus =
    getOperationsEngineNormalizedStatus(status);

  if (normalizedStatus === "Running")
    return "Running";

  if (normalizedStatus === "Failed")
    return "Retrying";

  if (normalizedStatus === "Waiting on Dependency")
    return "Waiting on Dependency";

  return "Queued";

}

function getOperationsEngineQueueValue(operation, header) {

  const values = {
    "Operation ID": operation.operationId,
    "Operation Type": operation.operationType,
    "Operation Class": operation.operationClass,
    "Owning Subsystem": operation.owningSubsystem,
    "Artifact State Key": operation.artifactStateKey,
    "Status": operation.status,
    "Priority": operation.priority,
    "Dependency Operation ID": operation.dependencyOperationId,
    "Retry Count": operation.retryCount,
    "Primary Trigger": operation.primaryTrigger,
    "Trigger Count": operation.triggerCount,
    "Triggers JSON": JSON.stringify(operation.triggers || []),
    "Latest Trigger At": operation.latestTriggerAt,
    "Queue Position": operation.queuePosition,
    "Created At": operation.createdAt,
    "Started At": operation.startedAt,
    "Completed At": operation.completedAt,
    "Updated At": operation.updatedAt,
    "Error Message": operation.errorMessage,
    "Verification Result JSON":
      JSON.stringify(operation.verificationResult || {})
  };

  return values[header] === undefined
    ? ""
    : values[header];

}

function buildOperationsEngineQueueRequestLog(
  operation,
  eventType,
  mergedOperationId,
  createdAt
) {

  return {
    "Log ID": createOperationsEngineId("log"),
    "Operation ID": operation.operationId,
    "Operation Type": operation.operationType,
    "Operation Class": operation.operationClass,
    "Owning Subsystem": operation.owningSubsystem,
    "Artifact State Key": operation.artifactStateKey,
    "Event Type": eventType,
    "Trigger": operation.primaryTrigger,
    "Triggered At": operation.latestTriggerAt,
    "Merged Operation ID": mergedOperationId,
    "Status": operation.status,
    "Success": "true",
    "Started At": "",
    "Completed At": "",
    "Duration Ms": 0,
    "Rows Processed": 0,
    "Cache Invalidations JSON": JSON.stringify([]),
    "Downstream Operations JSON": JSON.stringify([]),
    "Verification Result JSON": JSON.stringify({}),
    "Retry Count": operation.retryCount,
    "Error Message": "",
    "Created At": createdAt
  };

}

function executeOperationsEngineNext(e) {

  const lock =
    LockService.getScriptLock();

  if (!lock.tryLock(OPERATIONS_ENGINE_LOCK_WAIT_MS))
    return jsonOutput({
      success: false,
      status: "Locked",
      error: "Operations Engine is already running."
    });

  try {
    return jsonOutput(
      executeOperationsEngineNextWithLock(e)
    );
  }
  finally {
    lock.releaseLock();
  }

}

function executeOperationsEngineNextWithLock(e) {

  if (isOperationsEngineShadowMode())
    return planOperationsEngineShadowQueueWithLock(e);

  const queueSheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_QUEUE_SHEET_NAME,
      OPERATIONS_ENGINE_QUEUE_HEADERS
    );

  const logSheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_LOG_SHEET_NAME,
      OPERATIONS_ENGINE_LOG_HEADERS
    );

  let queueRows =
    getOperationsEngineQueueRows(queueSheet);

  const coalescingResult =
    coalesceOperationsEngineQueueRows(
      queueSheet,
      logSheet,
      queueRows
    );

  if (coalescingResult.coalesced > 0)
    queueRows =
      getOperationsEngineQueueRows(queueSheet);

  syncOperationsEngineDependencyStatuses(
    queueSheet,
    queueRows
  );

  queueRows =
    getOperationsEngineQueueRows(queueSheet);

  const nextOperation =
    selectNextOperationsEngineOperation(queueRows);

  if (!nextOperation)
    return {
      success: true,
      status: "Idle",
      generatedAt: getOperationsEngineTimestamp(),
      coalescedOperations: coalescingResult.coalesced,
      message: "No runnable Operations Queue item was found."
    };

  return executeOperationsEngineQueueRow(
    queueSheet,
    logSheet,
    nextOperation,
    e,
    coalescingResult.coalesced
  );

}

function executeOperationsEngineQueueRow(
  queueSheet,
  logSheet,
  queueRow,
  event,
  coalescedOperations
) {

  const startedAt =
    getOperationsEngineTimestamp();

  const operation =
    queueRow.record;

  if (isOperationsEngineShadowMode())
    return executeOperationsEngineQueueRowInShadowMode(
      queueSheet,
      logSheet,
      queueRow,
      event,
      coalescedOperations
    );

  updateOperationsEngineQueueRow(
    queueSheet,
    queueRow.rowNumber,
    {
      "Status": "Running",
      "Started At": startedAt,
      "Updated At": startedAt,
      "Error Message": "",
      "Verification Result JSON": ""
    }
  );

  let rebuildResult = {};
  let verificationResult = {};
  let cacheInvalidations = [];
  let finalStatus = "Completed";
  let errorMessage = "";

  try {
    const adapter =
      getOperationsEngineAdapterForOperation(operation);

    const context =
      buildOperationsEngineExecutionContext(
        operation,
        event
      );

    rebuildResult =
      normalizeOperationsEngineExecutionResult(
        adapter.rebuild(context)
      );

    if (rebuildResult.success === false)
      throw new Error(
        getOperationsEngineResultError(
          rebuildResult,
          "Operation rebuild failed."
        )
      );

    verificationResult =
      normalizeOperationsEngineExecutionResult(
        adapter.verify(context)
      );

    if (verificationResult.success === false)
      throw new Error(
        getOperationsEngineResultError(
          verificationResult,
          "Operation verification failed."
        )
      );

    cacheInvalidations =
      invalidateOperationsEngineAdapterCaches(adapter, context);
  }
  catch (err) {
    finalStatus = "Failed";
    errorMessage =
      getOperationsEngineString(err);

    if (!verificationResult || Object.keys(verificationResult).length === 0)
      verificationResult = {
        success: false,
        error: errorMessage
      };
  }

  const completedAt =
    getOperationsEngineTimestamp();

  const retryCount =
    finalStatus === "Failed"
      ? operation.retryCount + 1
      : operation.retryCount;

  updateOperationsEngineQueueRow(
    queueSheet,
    queueRow.rowNumber,
    {
      "Status": finalStatus,
      "Completed At": completedAt,
      "Updated At": completedAt,
      "Retry Count": retryCount,
      "Error Message": errorMessage,
      "Verification Result JSON":
        JSON.stringify(verificationResult)
    }
  );

  const logId =
    appendOperationsEngineLog(
      logSheet,
      {
        "Log ID": createOperationsEngineId("log"),
        "Operation ID": operation.operationId,
        "Operation Type": operation.operationType,
        "Operation Class": operation.operationClass,
        "Owning Subsystem": operation.owningSubsystem,
        "Artifact State Key": operation.artifactStateKey,
        "Event Type": "Executed",
        "Trigger": operation.primaryTrigger,
        "Triggered At": operation.latestTriggerAt,
        "Merged Operation ID": "",
        "Status": finalStatus,
        "Success": finalStatus === "Completed" ? "true" : "false",
        "Started At": startedAt,
        "Completed At": completedAt,
        "Duration Ms":
          getOperationsEngineDurationMs(startedAt, completedAt),
        "Rows Processed":
          getOperationsEngineRowsProcessed(
            rebuildResult,
            verificationResult
          ),
        "Cache Invalidations JSON":
          JSON.stringify(cacheInvalidations),
        "Downstream Operations JSON":
          JSON.stringify([]),
        "Verification Result JSON":
          JSON.stringify(verificationResult),
        "Retry Count": retryCount,
        "Error Message": errorMessage,
        "Created At": completedAt
      }
    );

  return {
    success: finalStatus === "Completed",
    status: finalStatus,
    generatedAt: completedAt,
    operation:
      Object.assign({}, operation, {
        status: finalStatus,
        completedAt: completedAt,
        updatedAt: completedAt,
        retryCount: retryCount,
        errorMessage: errorMessage,
        verificationResult: verificationResult
      }),
    rebuildResult: rebuildResult,
    verificationResult: verificationResult,
    cacheInvalidations: cacheInvalidations,
    coalescedOperations: coalescedOperations,
    logId: logId,
    error: errorMessage
  };

}

function planOperationsEngineShadowQueue(event) {

  if (!isOperationsEngineShadowMode())
    return {
      success: true,
      shadowMode: false,
      status: "Disabled",
      plannedOperations: 0,
      loggedOperations: 0
    };

  const lock =
    LockService.getScriptLock();

  if (!lock.tryLock(OPERATIONS_ENGINE_LOCK_WAIT_MS))
    return {
      success: false,
      shadowMode: true,
      status: "Locked",
      plannedOperations: 0,
      loggedOperations: 0,
      error: "Operations Queue is locked."
    };

  try {
    return planOperationsEngineShadowQueueWithLock(event);
  }
  finally {
    lock.releaseLock();
  }

}

function planOperationsEngineShadowQueueWithLock(event) {

  const queueSheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_QUEUE_SHEET_NAME,
      OPERATIONS_ENGINE_QUEUE_HEADERS
    );

  const logSheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_LOG_SHEET_NAME,
      OPERATIONS_ENGINE_LOG_HEADERS
    );

  let queueRows =
    getOperationsEngineQueueRows(queueSheet);

  const coalescingResult =
    coalesceOperationsEngineQueueRows(
      queueSheet,
      logSheet,
      queueRows
    );

  if (coalescingResult.coalesced > 0)
    queueRows =
      getOperationsEngineQueueRows(queueSheet);

  syncOperationsEngineDependencyStatuses(
    queueSheet,
    queueRows
  );

  queueRows =
    getOperationsEngineQueueRows(queueSheet);

  const rowsByOperationId =
    buildOperationsEngineQueueRowsByOperationId(queueRows);

  const shadowPlanKeys =
    getOperationsEngineShadowPlanKeys(logSheet);

  const planRows =
    queueRows
      .filter(function(row) {
        return hasOperationsEngineRequiredOperationFields(row.record);
      })
      .filter(function(row) {
        const status =
          getOperationsEngineNormalizedStatus(row.record.status);

        return (
          status === "Queued" ||
          status === "Retrying" ||
          status === "Waiting on Dependency"
        );
      })
      .sort(compareOperationsEngineQueueRows);

  const plans = [];
  let loggedOperations = 0;

  planRows.forEach(function(row) {
    const plan =
      buildOperationsEngineShadowPlan(
        row,
        rowsByOperationId,
        event
      );

    plans.push(plan);

    if (shadowPlanKeys[plan.shadowPlanKey])
      return;

    appendOperationsEngineShadowPlanLog(
      logSheet,
      row.record,
      plan
    );

    shadowPlanKeys[plan.shadowPlanKey] = true;
    loggedOperations += 1;
  });

  return {
    success: true,
    shadowMode: true,
    status:
      plans.length > 0
        ? "WOULD EXECUTE"
        : "Idle",
    generatedAt: getOperationsEngineTimestamp(),
    plannedOperations: plans.length,
    loggedOperations: loggedOperations,
    coalescedOperations: coalescingResult.coalesced,
    nextOperation:
      getOperationsEngineNextShadowPlan(plans)
  };

}

function executeOperationsEngineQueueRowInShadowMode(
  queueSheet,
  logSheet,
  queueRow,
  event,
  coalescedOperations
) {

  const rowsByOperationId =
    buildOperationsEngineQueueRowsByOperationId(
      getOperationsEngineQueueRows(queueSheet)
    );

  const plan =
    buildOperationsEngineShadowPlan(
      queueRow,
      rowsByOperationId,
      event
    );

  const shadowPlanKeys =
    getOperationsEngineShadowPlanKeys(logSheet);

  let logId = "";

  if (!shadowPlanKeys[plan.shadowPlanKey])
    logId =
      appendOperationsEngineShadowPlanLog(
        logSheet,
        queueRow.record,
        plan
      );

  return {
    success: true,
    shadowMode: true,
    status: "WOULD EXECUTE",
    generatedAt: getOperationsEngineTimestamp(),
    operation: queueRow.record,
    rebuildResult: {
      success: true,
      shadowMode: true,
      message: "Shadow Mode: rebuild execution is disabled."
    },
    verificationResult: plan.verificationPlan,
    cacheInvalidations: plan.plannedCacheInvalidations,
    downstreamOperations: plan.plannedDownstreamOperations,
    coalescedOperations: coalescedOperations,
    logId: logId,
    error: ""
  };

}

function buildOperationsEngineShadowPlan(row, rowsByOperationId, event) {

  const operation =
    row.record;

  const adapter =
    getOperationsEngineAdapterForOperation(operation);

  const context =
    buildOperationsEngineExecutionContext(
      operation,
      event
    );

  const dependencyState =
    getOperationsEngineDependencyState(
      operation,
      rowsByOperationId
    );

  const plannedCacheInvalidations =
    getOperationsEngineAdapterCacheGroups(adapter, context);

  const plannedDownstreamOperations =
    getOperationsEnginePlannedDownstreamOperations(operation);

  const dependencyStatus =
    dependencyState.satisfied
      ? "Satisfied"
      : "Blocked";

  const verificationPlan = {
    success: true,
    mode: "Shadow Mode",
    wouldExecute: true,
    executionDisabled: true,
    rebuildDisabled: true,
    refreshDisabled: true,
    cacheInvalidationDisabled: true,
    adapterVerificationRequired: true,
    adapterVerificationFunctionAvailable:
      typeof adapter.verify === "function",
    dependencyStatus: dependencyStatus,
    dependencyReason: dependencyState.reason,
    plannedCacheInvalidations: plannedCacheInvalidations,
    plannedDownstreamOperations: plannedDownstreamOperations,
    triggerCount: operation.triggerCount
  };

  return {
    operationId: operation.operationId,
    operationType: operation.operationType,
    operationClass: operation.operationClass,
    owningSubsystem: operation.owningSubsystem,
    artifactStateKey: operation.artifactStateKey,
    trigger: operation.primaryTrigger,
    dependencyStatus: dependencyStatus,
    dependencyReason: dependencyState.reason,
    runnable: dependencyState.satisfied,
    queuePosition: operation.queuePosition,
    plannedCacheInvalidations: plannedCacheInvalidations,
    plannedDownstreamOperations: plannedDownstreamOperations,
    verificationPlan: verificationPlan,
    shadowPlanKey:
      getOperationsEngineShadowPlanKey(
        operation,
        dependencyStatus
      )
  };

}

function appendOperationsEngineShadowPlanLog(logSheet, operation, plan) {

  return appendOperationsEngineLog(
    logSheet,
    {
      "Log ID": createOperationsEngineId("log"),
      "Operation ID": operation.operationId,
      "Operation Type": operation.operationType,
      "Operation Class": operation.operationClass,
      "Owning Subsystem": operation.owningSubsystem,
      "Artifact State Key": operation.artifactStateKey,
      "Event Type": "WOULD EXECUTE",
      "Trigger": operation.primaryTrigger,
      "Triggered At": operation.latestTriggerAt,
      "Merged Operation ID": "",
      "Status": "WOULD EXECUTE",
      "Success": "true",
      "Started At": "",
      "Completed At": "",
      "Duration Ms": 0,
      "Rows Processed": 0,
      "Cache Invalidations JSON":
        JSON.stringify(plan.plannedCacheInvalidations),
      "Downstream Operations JSON":
        JSON.stringify(plan.plannedDownstreamOperations),
      "Verification Result JSON":
        JSON.stringify(
          Object.assign({}, plan.verificationPlan, {
            shadowPlanKey: plan.shadowPlanKey
          })
        ),
      "Retry Count": operation.retryCount,
      "Error Message": plan.dependencyReason,
      "Created At": getOperationsEngineTimestamp()
    }
  );

}

function getOperationsEngineShadowPlanKeys(logSheet) {

  const keys = {};

  getOperationsEngineObjectsFromSheet(
    logSheet,
    OPERATIONS_ENGINE_LOG_HEADERS
  )
    .map(normalizeOperationsEngineLogRecord)
    .filter(function(record) {
      return record.eventType === "WOULD EXECUTE";
    })
    .forEach(function(record) {
      const key =
        getOperationsEngineString(
          record.verificationResult.shadowPlanKey
        );

      if (key)
        keys[key] = true;
    });

  return keys;

}

function getOperationsEngineShadowPlanKey(operation, dependencyStatus) {

  return [
    operation.operationId,
    operation.artifactStateKey,
    operation.triggerCount,
    operation.latestTriggerAt,
    dependencyStatus
  ].join("|");

}

function getOperationsEngineNextShadowPlan(plans) {

  return plans.filter(function(plan) {
    return plan.runnable;
  })[0] || null;

}

function getOperationsEnginePlannedDownstreamOperations(operation) {

  if (operation.owningSubsystem === "gameEngine")
    return [
      {
        owningSubsystem: "armyIntelligence",
        operationType: "Refresh Army Intelligence",
        trigger: "Game Engine artifact changed",
        dependency: "Rebuild Game Engine must complete and verify."
      }
    ];

  if (operation.owningSubsystem === "armyIntelligence")
    return [
      {
        owningSubsystem: "competitiveIntelligence",
        operationType: "Refresh Competitive Intelligence",
        trigger: "Army Intelligence artifact changed",
        dependency: "Refresh Army Intelligence must complete and verify."
      }
    ];

  return [];

}

function getOperationsEngineAdapterForOperation(operation) {

  const adapter =
    getOperationsEngineSubsystemAdapters()
      .filter(function(item) {
        return item.id === operation.owningSubsystem;
      })[0];

  if (!adapter)
    throw new Error(
      "No Operations adapter found for subsystem " +
      operation.owningSubsystem +
      "."
    );

  if (
    getOperationsEngineString(adapter.operationType) !==
    operation.operationType
  )
    throw new Error(
      "Operation type " +
      operation.operationType +
      " does not match adapter operation " +
      getOperationsEngineString(adapter.operationType) +
      "."
    );

  if (typeof adapter.rebuild !== "function")
    throw new Error("Adapter rebuild function is unavailable.");

  if (typeof adapter.verify !== "function")
    throw new Error("Adapter verification function is unavailable.");

  return adapter;

}

function buildOperationsEngineExecutionContext(operation, event) {

  return {
    event: event || {},
    operation: operation,
    operationId: operation.operationId,
    operationType: operation.operationType,
    owningSubsystem: operation.owningSubsystem,
    artifactStateKey: operation.artifactStateKey,
    triggers: operation.triggers
  };

}

function selectNextOperationsEngineOperation(queueRows) {

  const rowsByOperationId =
    buildOperationsEngineQueueRowsByOperationId(queueRows);

  const candidates =
    queueRows
      .filter(function(row) {
        return isOperationsEngineRunnableStatus(row.record.status);
      })
      .filter(function(row) {
        return hasOperationsEngineRequiredOperationFields(row.record);
      })
      .filter(function(row) {
        return getOperationsEngineDependencyState(
          row.record,
          rowsByOperationId
        ).satisfied;
      });

  if (candidates.length === 0)
    return null;

  return candidates
    .sort(compareOperationsEngineQueueRows)[0];

}

function compareOperationsEngineQueueRows(left, right) {

  const leftClass =
    getOperationsEngineOperationClassRank(left.record.operationClass);

  const rightClass =
    getOperationsEngineOperationClassRank(right.record.operationClass);

  if (leftClass !== rightClass)
    return leftClass - rightClass;

  if (left.record.priority !== right.record.priority)
    return right.record.priority - left.record.priority;

  const leftAge =
    getOperationsEngineQueueAge(left.record.createdAt);

  const rightAge =
    getOperationsEngineQueueAge(right.record.createdAt);

  if (leftAge !== rightAge)
    return leftAge - rightAge;

  return left.rowNumber - right.rowNumber;

}

function syncOperationsEngineDependencyStatuses(queueSheet, queueRows) {

  const rowsByOperationId =
    buildOperationsEngineQueueRowsByOperationId(queueRows);

  queueRows.forEach(function(row) {
    if (!isOperationsEngineRunnableStatus(row.record.status))
      return;

    const dependencyState =
      getOperationsEngineDependencyState(
        row.record,
        rowsByOperationId
      );

    if (dependencyState.satisfied)
      return;

    updateOperationsEngineQueueRow(
      queueSheet,
      row.rowNumber,
      {
        "Status": "Waiting on Dependency",
        "Updated At": getOperationsEngineTimestamp(),
        "Error Message": dependencyState.reason
      }
    );
  });

}

function getOperationsEngineDependencyState(operation, rowsByOperationId) {

  if (!operation.dependencyOperationId)
    return {
      satisfied: true,
      reason: ""
    };

  const dependency =
    rowsByOperationId[operation.dependencyOperationId];

  if (!dependency)
    return {
      satisfied: false,
      reason:
        "Dependency " +
        operation.dependencyOperationId +
        " was not found."
    };

  if (dependency.record.status === "Completed")
    return {
      satisfied: true,
      reason: ""
    };

  return {
    satisfied: false,
    reason:
      "Waiting for dependency " +
      operation.dependencyOperationId +
      " to complete."
  };

}

function coalesceOperationsEngineQueueRows(queueSheet, logSheet, queueRows) {

  const canonicalByKey = {};
  let coalesced = 0;

  queueRows
    .filter(function(row) {
      return hasOperationsEngineRequiredOperationFields(row.record);
    })
    .filter(function(row) {
      return isOperationsEngineCoalescingStatus(row.record.status);
    })
    .sort(compareOperationsEngineCoalescingRows)
    .forEach(function(row) {
      const key =
        getOperationsEngineCoalescingKey(row.record);

      if (!key)
        return;

      const canonical =
        canonicalByKey[key];

      if (!canonical) {
        canonicalByKey[key] = row;
        return;
      }

      coalesceOperationsEngineDuplicateQueueRow(
        queueSheet,
        logSheet,
        canonical,
        row
      );

      coalesced += 1;
    });

  return {
    coalesced: coalesced
  };

}

function compareOperationsEngineCoalescingRows(left, right) {

  const leftStatus =
    getOperationsEngineCoalescingStatusRank(left.record.status);

  const rightStatus =
    getOperationsEngineCoalescingStatusRank(right.record.status);

  if (leftStatus !== rightStatus)
    return leftStatus - rightStatus;

  return compareOperationsEngineQueueRows(left, right);

}

function getOperationsEngineCoalescingStatusRank(status) {

  const normalizedStatus =
    getOperationsEngineNormalizedStatus(status);

  if (normalizedStatus === "Completed")
    return 0;

  if (normalizedStatus === "Running")
    return 1;

  return 2;

}

function coalesceOperationsEngineDuplicateQueueRow(
  queueSheet,
  logSheet,
  canonical,
  duplicate
) {

  const completedAt =
    getOperationsEngineTimestamp();

  const triggers =
    mergeOperationsEngineTriggers(
      canonical.record,
      duplicate.record
    );

  updateOperationsEngineQueueRow(
    queueSheet,
    canonical.rowNumber,
    {
      "Priority":
        Math.max(
          canonical.record.priority,
          duplicate.record.priority
        ),
      "Trigger Count": triggers.length,
      "Triggers JSON": JSON.stringify(triggers),
      "Latest Trigger At":
        getOperationsEngineLatestTimestamp([
          canonical.record.latestTriggerAt,
          duplicate.record.latestTriggerAt
        ]),
      "Updated At": completedAt
    }
  );

  updateOperationsEngineQueueRow(
    queueSheet,
    duplicate.rowNumber,
    {
      "Status": "Completed",
      "Completed At": completedAt,
      "Updated At": completedAt,
      "Error Message":
        "Coalesced into operation " +
        canonical.record.operationId +
        ".",
      "Verification Result JSON":
        JSON.stringify({
          success: true,
          coalescedInto: canonical.record.operationId
        })
    }
  );

  appendOperationsEngineLog(
    logSheet,
    {
      "Log ID": createOperationsEngineId("log"),
      "Operation ID": duplicate.record.operationId,
      "Operation Type": duplicate.record.operationType,
      "Operation Class": duplicate.record.operationClass,
      "Owning Subsystem": duplicate.record.owningSubsystem,
      "Artifact State Key": duplicate.record.artifactStateKey,
      "Event Type": "Coalesced",
      "Trigger": duplicate.record.primaryTrigger,
      "Triggered At": duplicate.record.latestTriggerAt,
      "Merged Operation ID": canonical.record.operationId,
      "Status": "Completed",
      "Success": "true",
      "Started At": "",
      "Completed At": completedAt,
      "Duration Ms": 0,
      "Rows Processed": 0,
      "Cache Invalidations JSON": JSON.stringify([]),
      "Downstream Operations JSON": JSON.stringify([]),
      "Verification Result JSON":
        JSON.stringify({
          success: true,
          coalescedInto: canonical.record.operationId
        }),
      "Retry Count": duplicate.record.retryCount,
      "Error Message": "",
      "Created At": completedAt
    }
  );

  canonical.record.triggers = triggers;
  canonical.record.priority =
    Math.max(
      canonical.record.priority,
      duplicate.record.priority
    );
  canonical.record.latestTriggerAt =
    getOperationsEngineLatestTimestamp([
      canonical.record.latestTriggerAt,
      duplicate.record.latestTriggerAt
    ]);

}

function invalidateOperationsEngineAdapterCaches(adapter, context) {

  if (typeof invalidatePortalCacheGroup !== "function")
    return [];

  const groups =
    getOperationsEngineAdapterCacheGroups(adapter, context);

  const invalidated = [];

  groups.forEach(function(group) {
    invalidatePortalCacheGroup(group);
    invalidated.push(group);
  });

  return invalidated;

}

function getOperationsEngineAdapterCacheGroups(adapter, context) {

  const groups =
    typeof adapter.getAffectedCacheGroups === "function"
      ? adapter.getAffectedCacheGroups(context)
      : [];

  return coalesceOperationsEngineCacheGroups(groups);

}

function coalesceOperationsEngineCacheGroups(groups) {

  const normalized = [];
  const seen = {};

  if (!Array.isArray(groups))
    return normalized;

  groups.forEach(function(group) {
    const normalizedGroup =
      getOperationsEngineString(group);

    if (!normalizedGroup)
      return;

    if (seen[normalizedGroup])
      return;

    seen[normalizedGroup] = true;
    normalized.push(normalizedGroup);
  });

  return normalized;

}

function getOperationsEngineSubsystemStates() {

  return getOperationsEngineSubsystemAdapters()
    .map(function(adapter) {
      try {
        return normalizeOperationsEngineSubsystemState(
          adapter.getCurrentState(),
          adapter
        );
      }
      catch (err) {
        return normalizeOperationsEngineSubsystemState({
          subsystemId: adapter.id,
          subsystemName: adapter.label,
          schemaVersion: "",
          sourceHash: "",
          artifactHash: "",
          artifactStateKey: "",
          lastBuiltAt: "",
          healthy: false,
          stale: true,
          staleReason:
            "State evaluation failed: " +
            getOperationsEngineString(err),
          details: {}
        }, adapter);
      }
    });

}

function getOperationsEngineSubsystemAdapters() {

  const adapters = [];

  if (typeof getOperationsGameEngineAdapter === "function")
    adapters.push(getOperationsGameEngineAdapter());

  if (typeof getOperationsArmyIntelligenceAdapter === "function")
    adapters.push(getOperationsArmyIntelligenceAdapter());

  if (typeof getOperationsCompetitiveIntelligenceAdapter === "function")
    adapters.push(getOperationsCompetitiveIntelligenceAdapter());

  if (typeof getOperationsCacheAdapter === "function")
    adapters.push(getOperationsCacheAdapter());

  return adapters;

}

function normalizeOperationsEngineSubsystemState(state, adapter) {

  const sourceHash =
    getOperationsEngineString(state.sourceHash);

  const artifactStateKey =
    getOperationsEngineString(state.artifactStateKey) ||
    getOperationsEngineHash([
      getOperationsEngineString(state.schemaVersion),
      sourceHash
    ].join("|"));

  return {
    subsystemId:
      getOperationsEngineString(state.subsystemId) ||
      getOperationsEngineString(adapter.id),
    subsystemName:
      getOperationsEngineString(state.subsystemName) ||
      getOperationsEngineString(adapter.label),
    schemaVersion:
      getOperationsEngineString(state.schemaVersion),
    sourceHash: sourceHash,
    artifactHash:
      getOperationsEngineString(state.artifactHash),
    artifactStateKey: artifactStateKey,
    lastBuiltAt:
      getOperationsEngineString(state.lastBuiltAt),
    healthy: state.healthy !== false,
    stale: state.stale === true,
    staleReason:
      getOperationsEngineString(state.staleReason),
    details: state.details || {}
  };

}

function ensureOperationsEngineSheet(sheetName, headers) {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(sheetName);

    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);
  }
  else {
    ensureOperationsEngineHeaders(sheet, headers);
  }

  hideOperationsEngineSheet(sheet);

  return sheet;

}

function ensureOperationsEngineHeaders(sheet, headers) {

  const lastColumn =
    Math.max(sheet.getLastColumn(), headers.length);

  const existing =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0]
      .map(getOperationsEngineString);

  const hasHeaders =
    existing.some(function(header) {
      return header !== "";
    });

  if (!hasHeaders) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);
    return;
  }

  const missing =
    headers.filter(function(header) {
      return existing.indexOf(header) === -1;
    });

  if (missing.length === 0)
    return;

  const firstEmptyColumn =
    existing.filter(function(header) {
      return header !== "";
    }).length + 1;

  sheet
    .getRange(1, firstEmptyColumn, 1, missing.length)
    .setValues([missing]);

}

function hideOperationsEngineSheet(sheet) {

  try {
    if (!sheet.isSheetHidden())
      sheet.hideSheet();
  }
  catch (err) {
    Logger.log("Operations Engine sheet hide skipped: " + String(err));
  }

}

function getOperationsEngineObjectsFromSheet(sheet, schemaHeaders) {

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2)
    return [];

  const lastColumn =
    Math.max(sheet.getLastColumn(), schemaHeaders.length);

  const values =
    sheet
      .getRange(1, 1, lastRow, lastColumn)
      .getValues();

  const headers =
    values
      .shift()
      .map(getOperationsEngineString);

  return values.map(function(row) {
    const record = {};

    schemaHeaders.forEach(function(header) {
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

function getOperationsEngineQueueRows(sheet) {

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2)
    return [];

  const lastColumn =
    Math.max(sheet.getLastColumn(), OPERATIONS_ENGINE_QUEUE_HEADERS.length);

  const values =
    sheet
      .getRange(1, 1, lastRow, lastColumn)
      .getValues();

  const headers =
    values
      .shift()
      .map(getOperationsEngineString);

  return values
    .map(function(row, index) {
      const record = {};

      OPERATIONS_ENGINE_QUEUE_HEADERS.forEach(function(header) {
        const column =
          headers.indexOf(header);

        record[header] =
          column === -1
            ? ""
            : row[column];
      });

      return {
        rowNumber: index + 2,
        record: normalizeOperationsEngineQueueRecord(record)
      };
    })
    .filter(function(row) {
      return hasOperationsEngineRequiredOperationFields(row.record);
    });

}

function updateOperationsEngineQueueRow(sheet, rowNumber, patch) {

  const headers =
    getOperationsEngineSheetHeaders(
      sheet,
      OPERATIONS_ENGINE_QUEUE_HEADERS
    );

  Object.keys(patch).forEach(function(header) {
    const column =
      headers.indexOf(header);

    if (column === -1)
      return;

    sheet
      .getRange(rowNumber, column + 1)
      .setValue(patch[header]);
  });

}

function appendOperationsEngineLog(sheet, values) {

  const logId =
    values["Log ID"] || createOperationsEngineId("log");

  values["Log ID"] = logId;

  sheet.appendRow(
    OPERATIONS_ENGINE_LOG_HEADERS.map(function(header) {
      const value =
        values[header];

      return value === undefined || value === null
        ? ""
        : value;
    })
  );

  return logId;

}

function getOperationsEngineSheetHeaders(sheet, schemaHeaders) {

  const lastColumn =
    Math.max(sheet.getLastColumn(), schemaHeaders.length);

  return sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(getOperationsEngineString);

}

function buildOperationsEngineQueueRowsByOperationId(queueRows) {

  const rowsByOperationId = {};

  queueRows.forEach(function(row) {
    if (row.record.operationId)
      rowsByOperationId[row.record.operationId] = row;
  });

  return rowsByOperationId;

}

function getOperationsEngineBlockingOperationState(
  owningSubsystem,
  operationType
) {

  const sheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_QUEUE_SHEET_NAME,
      OPERATIONS_ENGINE_QUEUE_HEADERS
    );

  const blockingStatuses = [
    "Queued",
    "Running",
    "Waiting on Dependency",
    "Retrying",
    "Failed"
  ];

  const rows =
    getOperationsEngineQueueRows(sheet)
      .filter(function(row) {
        return (
          row.record.owningSubsystem === owningSubsystem &&
          row.record.operationType === operationType &&
          blockingStatuses.indexOf(
            getOperationsEngineNormalizedStatus(row.record.status)
          ) !== -1
        );
      })
      .sort(compareOperationsEngineQueueRows);

  if (rows.length === 0)
    return {
      blocked: false,
      operationId: "",
      status: ""
    };

  return {
    blocked: true,
    operationId: rows[0].record.operationId,
    status:
      getOperationsEngineNormalizedStatus(rows[0].record.status)
  };

}

function getOperationsEngineLatestSuccessfulArtifactStateKey(
  owningSubsystem,
  operationType
) {

  const sheet =
    ensureOperationsEngineSheet(
      OPERATIONS_ENGINE_LOG_SHEET_NAME,
      OPERATIONS_ENGINE_LOG_HEADERS
    );

  const rows =
    getOperationsEngineObjectsFromSheet(
      sheet,
      OPERATIONS_ENGINE_LOG_HEADERS
    )
      .map(normalizeOperationsEngineLogRecord)
      .filter(function(row) {
        return (
          row.owningSubsystem === owningSubsystem &&
          row.operationType === operationType &&
          row.eventType === "Executed" &&
          row.status === "Completed" &&
          row.success.toLowerCase() === "true" &&
          row.artifactStateKey !== ""
        );
      })
      .sort(function(left, right) {
        return (
          getOperationsEngineQueueAge(right.completedAt || right.createdAt) -
          getOperationsEngineQueueAge(left.completedAt || left.createdAt)
        );
      });

  return rows[0]
    ? rows[0].artifactStateKey
    : "";

}

function normalizeOperationsEngineQueueRecord(record) {

  return {
    operationId: getOperationsEngineString(record["Operation ID"]),
    operationType: getOperationsEngineString(record["Operation Type"]),
    operationClass: getOperationsEngineString(record["Operation Class"]),
    owningSubsystem: getOperationsEngineString(record["Owning Subsystem"]),
    artifactStateKey: getOperationsEngineString(record["Artifact State Key"]),
    status: getOperationsEngineString(record["Status"]),
    priority: getOperationsEngineNumber(record["Priority"]),
    dependencyOperationId: getOperationsEngineString(record["Dependency Operation ID"]),
    retryCount: getOperationsEngineNumber(record["Retry Count"]),
    primaryTrigger: getOperationsEngineString(record["Primary Trigger"]),
    triggerCount: getOperationsEngineNumber(record["Trigger Count"]),
    triggers: parseOperationsEngineJson(record["Triggers JSON"], []),
    latestTriggerAt: getOperationsEngineString(record["Latest Trigger At"]),
    queuePosition: getOperationsEngineNumber(record["Queue Position"]),
    createdAt: getOperationsEngineString(record["Created At"]),
    startedAt: getOperationsEngineString(record["Started At"]),
    completedAt: getOperationsEngineString(record["Completed At"]),
    updatedAt: getOperationsEngineString(record["Updated At"]),
    errorMessage: getOperationsEngineString(record["Error Message"]),
    verificationResult: parseOperationsEngineJson(record["Verification Result JSON"], {})
  };

}

function normalizeOperationsEngineLogRecord(record) {

  return {
    logId: getOperationsEngineString(record["Log ID"]),
    operationId: getOperationsEngineString(record["Operation ID"]),
    operationType: getOperationsEngineString(record["Operation Type"]),
    operationClass: getOperationsEngineString(record["Operation Class"]),
    owningSubsystem: getOperationsEngineString(record["Owning Subsystem"]),
    artifactStateKey: getOperationsEngineString(record["Artifact State Key"]),
    eventType: getOperationsEngineString(record["Event Type"]),
    trigger: getOperationsEngineString(record["Trigger"]),
    triggeredAt: getOperationsEngineString(record["Triggered At"]),
    mergedOperationId: getOperationsEngineString(record["Merged Operation ID"]),
    status: getOperationsEngineString(record["Status"]),
    success: getOperationsEngineString(record["Success"]),
    startedAt: getOperationsEngineString(record["Started At"]),
    completedAt: getOperationsEngineString(record["Completed At"]),
    durationMs: getOperationsEngineNumber(record["Duration Ms"]),
    rowsProcessed: getOperationsEngineNumber(record["Rows Processed"]),
    cacheInvalidations: parseOperationsEngineJson(record["Cache Invalidations JSON"], []),
    downstreamOperations: parseOperationsEngineJson(record["Downstream Operations JSON"], []),
    verificationResult: parseOperationsEngineJson(record["Verification Result JSON"], {}),
    retryCount: getOperationsEngineNumber(record["Retry Count"]),
    errorMessage: getOperationsEngineString(record["Error Message"]),
    createdAt: getOperationsEngineString(record["Created At"])
  };

}

function hasOperationsEngineRequiredOperationFields(operation) {

  return !!(
    operation &&
    operation.operationId &&
    operation.operationType &&
    operation.owningSubsystem &&
    operation.artifactStateKey
  );

}

function isOperationsEngineRunnableStatus(status) {

  const normalizedStatus =
    getOperationsEngineNormalizedStatus(status);

  return OPERATIONS_ENGINE_RUNNABLE_STATUSES.indexOf(normalizedStatus) !== -1;

}

function isOperationsEngineCoalescingStatus(status) {

  const normalizedStatus =
    getOperationsEngineNormalizedStatus(status);

  return OPERATIONS_ENGINE_COALESCING_STATUSES.indexOf(normalizedStatus) !== -1;

}

function getOperationsEngineNormalizedStatus(status) {

  const normalizedStatus =
    getOperationsEngineString(status);

  return normalizedStatus || "Queued";

}

function isOperationsEngineShadowMode() {

  return OPERATIONS_ENGINE_SHADOW_MODE === true;

}

function getOperationsEngineCoalescingKey(operation) {

  if (!hasOperationsEngineRequiredOperationFields(operation))
    return "";

  return [
    operation.owningSubsystem,
    operation.operationType,
    operation.artifactStateKey
  ].join("|");

}

function getOperationsEngineOperationClassRank(operationClass) {

  const index =
    OPERATIONS_ENGINE_OPERATION_CLASSES.indexOf(
      getOperationsEngineString(operationClass)
    );

  return index === -1
    ? OPERATIONS_ENGINE_OPERATION_CLASSES.length
    : index;

}

function getOperationsEngineQueueAge(value) {

  const raw =
    getOperationsEngineString(value);

  if (!raw)
    return 0;

  const timestamp =
    Date.parse(raw);

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;

}

function mergeOperationsEngineTriggers(left, right) {

  const merged = [];
  const seen = {};

  appendOperationsEngineTriggerValues(merged, seen, left);
  appendOperationsEngineTriggerValues(merged, seen, right);

  return merged;

}

function appendOperationsEngineTriggerValues(merged, seen, operation) {

  const triggers =
    Array.isArray(operation.triggers)
      ? operation.triggers.slice()
      : [];

  if (
    triggers.length === 0 &&
    operation.primaryTrigger
  )
    triggers.push({
      trigger: operation.primaryTrigger,
      triggeredAt: operation.latestTriggerAt
    });

  triggers.forEach(function(trigger) {
    const key =
      JSON.stringify(trigger);

    if (seen[key])
      return;

    seen[key] = true;
    merged.push(trigger);
  });

}

function getOperationsEngineLatestTimestamp(values) {

  return values
    .map(getOperationsEngineString)
    .filter(function(value) {
      return value !== "";
    })
    .sort()
    .pop() || "";

}

function normalizeOperationsEngineExecutionResult(result) {

  if (
    result &&
    typeof result.getContent === "function"
  ) {
    try {
      return JSON.parse(result.getContent());
    }
    catch (err) {
      return {
        success: false,
        error:
          "Unable to parse operation result: " +
          getOperationsEngineString(err)
      };
    }
  }

  if (
    result &&
    typeof result === "object" &&
    !Array.isArray(result)
  )
    return result;

  return {
    success: true,
    result: result === undefined ? "" : result
  };

}

function getOperationsEngineResultError(result, fallback) {

  return (
    getOperationsEngineString(result.error) ||
    getOperationsEngineString(result.message) ||
    fallback
  );

}

function getOperationsEngineRowsProcessed(rebuildResult, verificationResult) {

  const candidates = [
    rebuildResult.rowsProcessed,
    rebuildResult.updated,
    rebuildResult.processed,
    rebuildResult.sourceCount,
    verificationResult.rowsProcessed
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    const value =
      Number(candidates[index]);

    if (Number.isFinite(value) && value > 0)
      return value;
  }

  if (
    verificationResult.metrics &&
    Number.isFinite(Number(verificationResult.metrics.analyticsRows))
  )
    return Number(verificationResult.metrics.analyticsRows);

  return 0;

}

function getOperationsEngineDurationMs(startedAt, completedAt) {

  const started =
    Date.parse(startedAt);

  const completed =
    Date.parse(completedAt);

  if (
    !Number.isFinite(started) ||
    !Number.isFinite(completed)
  )
    return 0;

  return Math.max(0, completed - started);

}

function createOperationsEngineId(prefix) {

  return [
    prefix,
    getOperationsEngineTimestamp(),
    Utilities.getUuid()
  ].join("-");

}

function parseOperationsEngineJson(value, fallback) {

  const raw =
    getOperationsEngineString(value);

  if (!raw)
    return fallback;

  try {
    return JSON.parse(raw);
  }
  catch (err) {
    return fallback;
  }

}

function getOperationsEngineString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}

function getOperationsEngineNumber(value) {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;

}

function getOperationsEngineTimestamp() {

  return new Date().toISOString();

}

function getOperationsEngineHash(value) {

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      getOperationsEngineString(value),
      Utilities.Charset.UTF_8
    );

  return digest.map(function(byte) {
    const value =
      byte < 0 ? byte + 256 : byte;

    return ("0" + value.toString(16)).slice(-2);
  }).join("");

}
