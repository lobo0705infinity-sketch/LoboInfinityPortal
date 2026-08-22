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

function installArmyIntelligenceRefreshScheduler() {

  const token = getArmyIntelligenceSchedulerToken_();

  if (!token)
    throw new Error(
      "Set the ARMY_INTELLIGENCE_WORKER_TOKEN Script Property before installing the scheduler."
    );

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

  const initialResult = runScheduledArmyIntelligenceRefresh();

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

    const response =
      UrlFetchApp.fetch(
        ARMY_INTELLIGENCE_SCHEDULER_URL,
        {
          contentType: "application/json",
          headers: {
            Authorization: "Bearer " + token
          },
          method: "post",
          muteHttpExceptions: true,
          payload: "{}"
        }
      );

    const statusCode = response.getResponseCode();
    const payload = parseArmyIntelligenceSchedulerResponse_(response.getContentText());
    const result = {
      decoded: Number(payload.decoded) || 0,
      failed: Number(payload.failed) || 0,
      hasMore: payload.hasMore === true,
      remaining: Number(payload.remaining) || 0,
      status: statusCode >= 200 && statusCode < 300 && payload.success !== false
        ? "Succeeded"
        : "Failed",
      success: statusCode >= 200 && statusCode < 300 && payload.success !== false,
      timestamp: new Date().toISOString(),
      updated: Number(payload.updated) || 0,
      workerHttpStatus: statusCode
    };

    Logger.log("ARMY_INTELLIGENCE_SCHEDULER " + JSON.stringify(result));

    if (!result.success)
      throw new Error(
        "Army Intelligence worker failed with HTTP " + statusCode + "."
      );

    return result;
  }
  finally {
    lock.releaseLock();
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
