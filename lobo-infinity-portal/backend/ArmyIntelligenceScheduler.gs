/*******************************************************
 * ArmyIntelligenceScheduler.gs
 *
 * Owner-authorized clock only. Decoding and persistence
 * remain owned by the existing Vercel worker/API path.
 *******************************************************/

const ARMY_INTELLIGENCE_SCHEDULER_HANDLER =
  "runScheduledArmyIntelligenceRefresh";
const ARMY_INTELLIGENCE_SCHEDULER_TOKEN_PROPERTY =
  "ARMY_INTELLIGENCE_WORKER_TOKEN";
const ARMY_INTELLIGENCE_SCHEDULER_URL =
  "https://lobo-infinity-portal.vercel.app/api/army-intelligence-refresh-worker";
const AUTOMATION_QUEUE_WORKER_URL =
  "https://lobo-infinity-portal.vercel.app/api/automation-queue-worker";

function installArmyIntelligenceRefreshScheduler(e) {

  const parameters = e ? getApiParameters(e) : {};
  const suppliedToken = e
    ? getApiParameter(parameters, "workerToken")
    : "";

  if (suppliedToken)
    PropertiesService.getScriptProperties().setProperty(
      ARMY_INTELLIGENCE_SCHEDULER_TOKEN_PROPERTY,
      suppliedToken
    );

  const token = getArmyIntelligenceSchedulerToken_();

  if (!token)
    throw new Error(
      "Set the ARMY_INTELLIGENCE_WORKER_TOKEN Script Property before installing the scheduler."
    );

  const initialResult = runScheduledArmyIntelligenceRefresh();

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === ARMY_INTELLIGENCE_SCHEDULER_HANDLER)
      ScriptApp.deleteTrigger(trigger);
  });

  const trigger =
    ScriptApp
      .newTrigger(ARMY_INTELLIGENCE_SCHEDULER_HANDLER)
      .timeBased()
      .everyMinutes(5)
      .create();

  return {
    cadenceMinutes: 5,
    handler: ARMY_INTELLIGENCE_SCHEDULER_HANDLER,
    initialResult: initialResult,
    success: true,
    triggerId: trigger.getUniqueId()
  };

}

function runScheduledArmyIntelligenceRefresh() {

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    const skipped = {
      status: "Skipped",
      success: true,
      timestamp: new Date().toISOString()
    };
    Logger.log("ARMY_INTELLIGENCE_SCHEDULER " + JSON.stringify(skipped));
    return skipped;
  }

  try {
    const token = getArmyIntelligenceSchedulerToken_();

    if (!token)
      throw new Error("Army Intelligence scheduler credential is not configured.");

    const intelligence = runScheduledMaintenanceWorker_(
      ARMY_INTELLIGENCE_SCHEDULER_URL,
      token
    );
    const automation = runScheduledMaintenanceWorker_(
      AUTOMATION_QUEUE_WORKER_URL,
      token
    );
    const payload = intelligence.payload;
    const result = {
      automation: automation,
      decoded: Number(payload.decoded) || 0,
      failed: Number(payload.failed) || 0,
      hasMore: payload.hasMore === true,
      remaining: Number(payload.remaining) || 0,
      status: intelligence.success && automation.success
        ? "Succeeded"
        : "Failed",
      success: intelligence.success && automation.success,
      timestamp: new Date().toISOString(),
      updated: Number(payload.updated) || 0,
      workerHttpStatus: intelligence.workerHttpStatus
    };

    Logger.log("ARMY_INTELLIGENCE_SCHEDULER " + JSON.stringify(result));

    if (!result.success)
      throw new Error(
        "Scheduled maintenance worker failed."
      );

    return result;
  }
  finally {
    lock.releaseLock();
  }

}

function runScheduledMaintenanceWorker_(url, token) {

  try {
    const response = UrlFetchApp.fetch(url, {
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      method: "post",
      muteHttpExceptions: true,
      payload: "{}"
    });
    const statusCode = response.getResponseCode();
    const payload = parseArmyIntelligenceSchedulerResponse_(response.getContentText());
    return {
      payload: payload,
      success: statusCode >= 200 && statusCode < 300 && payload.success !== false,
      workerHttpStatus: statusCode
    };
  }
  catch (error) {
    return {
      error: String(error && error.message ? error.message : error),
      payload: {},
      success: false,
      workerHttpStatus: 0
    };
  }

}

function getArmyIntelligenceSchedulerToken_() {

  return String(
    PropertiesService
      .getScriptProperties()
      .getProperty(ARMY_INTELLIGENCE_SCHEDULER_TOKEN_PROPERTY) || ""
  ).trim();

}

function parseArmyIntelligenceSchedulerResponse_(value) {

  try {
    return JSON.parse(String(value || "{}"));
  }
  catch (error) {
    return {
      success: false
    };
  }

}
