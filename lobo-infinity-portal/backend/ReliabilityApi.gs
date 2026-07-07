/*******************************************************
 * LOBO INFINITY LEAGUE 3.4
 * ReliabilityApi.gs
 *
 * Snapshot, queue, cache, recovery, and platform health APIs.
 *******************************************************/

const RELIABILITY_VERSION = "3.4";
const RELIABILITY_SNAPSHOTS_KEY = "reliabilitySnapshots";
const RELIABILITY_JOBS_KEY = "reliabilityJobs";
const RELIABILITY_AUDIT_KEY = "reliabilityAudit";
const RELIABILITY_HISTORY_KEY = "reliabilityHistory";

const RELIABILITY_SNAPSHOT_DEFINITIONS = [
  {
    id: "league",
    label: "League Snapshot",
    dependencies: ["standings", "players", "recentGames"],
    builder: rebuildReliabilityLeagueSnapshot
  },
  {
    id: "operations",
    label: "Operations Snapshot",
    dependencies: ["operationsSummary", "cache", "identity"],
    builder: rebuildReliabilityOperationsSnapshot
  },
  {
    id: "integrity",
    label: "Integrity Snapshot",
    dependencies: ["integrity", "eventLifecycle"],
    builder: rebuildReliabilityIntegritySnapshot
  },
  {
    id: "lifecycle",
    label: "Lifecycle Snapshot",
    dependencies: ["events", "eventLifecycle"],
    builder: rebuildReliabilityLifecycleSnapshot
  },
  {
    id: "standings",
    label: "Standings Snapshot",
    dependencies: ["standings", "gameEngine"],
    builder: rebuildReliabilityStandingsSnapshot
  },
  {
    id: "records",
    label: "Records Snapshot",
    dependencies: ["recentGames", "records"],
    builder: rebuildReliabilityRecordsSnapshot
  },
  {
    id: "hallOfFame",
    label: "Hall of Fame Snapshot",
    dependencies: ["records", "hallOfFame"],
    builder: rebuildReliabilityHallOfFameSnapshot
  },
  {
    id: "analytics",
    label: "Analytics Snapshot",
    dependencies: ["recentGames", "analytics"],
    builder: rebuildReliabilityAnalyticsSnapshot
  },
  {
    id: "search",
    label: "Search Snapshot",
    dependencies: ["players", "factions", "missions", "recentGames"],
    builder: rebuildReliabilitySearchSnapshot
  }
];

function getReliabilityDashboard() {

  autoRecoverReliabilitySnapshots();

  return jsonOutput({
    success: true,
    reliability: buildReliabilityDashboard()
  });

}

function executeReliabilityAction(e, auth) {

  const params =
    getOperationsParams(e);

  const action =
    getOperationsString(params.reliabilityAction || params.actionName);

  const target =
    getOperationsString(params.target || "all");

  const commissioner =
    auth && auth.user
      ? auth.user.email || auth.user.displayName
      : "Unknown";

  const start =
    Date.now();

  let result;

  if (action === "queueJob")
    result =
      enqueueReliabilityJob(target, commissioner);
  else if (action === "processNextJob")
    result =
      processNextReliabilityJob(commissioner);
  else if (action === "rebuildSnapshot")
    result =
      rebuildReliabilitySnapshot(target, commissioner);
  else if (action === "rebuildAllSnapshots")
    result =
      rebuildAllReliabilitySnapshots(commissioner);
  else if (action === "invalidateCache")
    result =
      executeReliabilityCacheInvalidation(target, commissioner);
  else if (action === "rebuildCache")
    result =
      executeReliabilityCacheRefresh(target, commissioner);
  else if (action === "clearExpiredCache")
    result =
      executeReliabilityExpiredCacheCleanup(commissioner);
  else
    return jsonOutput({
      success: false,
      error: "Unknown reliability action."
    });

  appendReliabilityAudit({
    action: action,
    target: target,
    commissioner: commissioner,
    durationMs: Date.now() - start,
    result: result.success ? "Completed" : "Failed",
    message: result.message || "",
    timestamp: getReliabilityTimestamp()
  });

  return jsonOutput({
    success: result.success !== false,
    result: result,
    reliability: buildReliabilityDashboard()
  });

}

function buildReliabilityDashboard() {

  const snapshots =
    getReliabilitySnapshots();

  const jobs =
    getReliabilityJobs();

  const cache =
    getPortalCacheStatus();

  const health =
    buildReliabilityHealth(
      snapshots,
      jobs,
      cache
    );

  return {
    version: RELIABILITY_VERSION,
    generatedAt: getReliabilityTimestamp(),
    frontendVersion:
      getSettingsObject().portalVersion || "",
    appsScriptVersion:
      "Version " + RELIABILITY_VERSION,
    snapshots: snapshots,
    jobs: jobs,
    cache: cache,
    health: health,
    history:
      getReliabilityHistory(),
    audit:
      getReliabilityAudit().slice(-25),
    recoveryActions:
      buildReliabilityRecoveryActions(),
    cacheActions:
      buildReliabilityCacheActions(cache)
  };

}

function rebuildReliabilitySnapshot(snapshotId, commissioner) {

  const definition =
    getReliabilitySnapshotDefinition(snapshotId);

  if (!definition)
    return {
      success: false,
      message: "Unknown snapshot."
    };

  const start =
    Date.now();

  try {
    const payload =
      definition.builder();

    const snapshot =
      buildReliabilitySnapshotRecord(
        definition,
        "Healthy",
        payload.recordCount,
        Date.now() - start,
        ""
      );

    upsertReliabilitySnapshot(snapshot);
    appendReliabilityHistory("snapshot", definition.id, snapshot.durationMs, true);

    return {
      success: true,
      message: definition.label + " rebuilt.",
      snapshot: snapshot
    };
  }
  catch (err) {
    const snapshot =
      buildReliabilitySnapshotRecord(
        definition,
        "Failed",
        0,
        Date.now() - start,
        String(err)
      );

    upsertReliabilitySnapshot(snapshot);
    appendReliabilityHistory("snapshot", definition.id, snapshot.durationMs, false);

    return {
      success: false,
      message: String(err),
      snapshot: snapshot
    };
  }

}

function rebuildAllReliabilitySnapshots(commissioner) {

  const results =
    RELIABILITY_SNAPSHOT_DEFINITIONS.map(function(definition) {
      return rebuildReliabilitySnapshot(
        definition.id,
        commissioner
      );
    });

  return {
    success:
      results.every(function(result) {
        return result.success;
      }),
    message: "Snapshot rebuild complete.",
    results: results
  };

}

function enqueueReliabilityJob(jobType, commissioner) {

  const jobs =
    getReliabilityJobs();

  const job = {
    id:
      "job-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
    type: jobType,
    status: "Queued",
    retries: 0,
    queuedAt: getReliabilityTimestamp(),
    startedAt: "",
    completedAt: "",
    durationMs: 0,
    error: "",
    requestedBy: commissioner
  };

  jobs.push(job);
  setReliabilityJobs(jobs.slice(-100));

  return {
    success: true,
    message: job.type + " queued.",
    job: job
  };

}

function processNextReliabilityJob(commissioner) {

  const jobs =
    getReliabilityJobs();

  const index =
    jobs.findIndex(function(job) {
      return job.status === "Queued";
    });

  if (index === -1)
    return {
      success: true,
      message: "No queued jobs."
    };

  const job =
    jobs[index];

  const start =
    Date.now();

  job.status = "Running";
  job.startedAt = getReliabilityTimestamp();
  setReliabilityJobs(jobs);

  const result =
    runReliabilityJob(job.type, commissioner);

  job.status =
    result.success
      ? "Completed"
      : "Failed";
  job.completedAt = getReliabilityTimestamp();
  job.durationMs = Date.now() - start;
  job.error =
    result.success
      ? ""
      : result.message || "Job failed.";

  if (!result.success)
    job.retries++;

  jobs[index] = job;
  setReliabilityJobs(jobs);
  appendReliabilityHistory("job", job.type, job.durationMs, result.success);

  return {
    success: result.success,
    message: result.message,
    job: job
  };

}

function runReliabilityJob(jobType, commissioner) {

  if (jobType === "rebuildEverything")
    return rebuildAllReliabilitySnapshots(commissioner);

  if (jobType === "refreshCache")
    return executeReliabilityCacheRefresh("all", commissioner);

  if (jobType.indexOf("rebuild") === 0) {
    const snapshotId =
      jobType
        .replace("rebuild", "")
        .replace("Snapshot", "");

    return rebuildReliabilitySnapshot(
      lowerFirstReliability(snapshotId),
      commissioner
    );
  }

  return rebuildReliabilitySnapshot(jobType, commissioner);

}

function buildReliabilityHealth(snapshots, jobs, cache) {

  const warnings = [];
  const failedJobs =
    jobs.filter(function(job) {
      return job.status === "Failed";
    });

  const runningJobs =
    jobs.filter(function(job) {
      return job.status === "Running";
    });

  snapshots.forEach(function(snapshot) {
    if (snapshot.status === "Failed")
      warnings.push(snapshot.label + " failed: " + snapshot.error);

    if (snapshot.ageMinutes > 60)
      warnings.push(snapshot.label + " is stale.");
  });

  if (failedJobs.length > 0)
    warnings.push(failedJobs.length + " background jobs failed.");

  if (cache.performance.cacheHitRate < 90)
    warnings.push("Cache hit rate is below 90%.");

  const score =
    Math.max(
      0,
      100 -
        warnings.length * 10 -
        failedJobs.length * 5
    );

  return {
    score: score,
    status:
      score >= 90
        ? "Healthy"
        : score >= 70
          ? "Needs Attention"
          : "Critical",
    warnings: warnings,
    runningJobs: runningJobs.length,
    failedJobs: failedJobs.length,
    cacheHitRate: cache.performance.cacheHitRate,
    averageApiResponse: cache.performance.averageApiResponse,
    lastSuccessfulRebuild:
      getLastSuccessfulReliabilityRebuild(snapshots)
  };

}

function autoRecoverReliabilitySnapshots() {

  const snapshots =
    getReliabilitySnapshots();

  if (snapshots.length === 0) {
    seedReliabilitySnapshotMetadata();
    return;
  }

  snapshots
    .filter(function(snapshot) {
      return (
        snapshot.status === "Failed" ||
        snapshot.ageMinutes > 360
      );
    })
    .slice(0, 1)
    .forEach(function(snapshot) {
      enqueueReliabilityJob(
        snapshot.id,
        "Automatic Recovery"
      );
    });

}

function seedReliabilitySnapshotMetadata() {

  const now =
    getReliabilityTimestamp();

  setReliabilitySnapshots(
    RELIABILITY_SNAPSHOT_DEFINITIONS.map(function(definition) {
      return {
        id: definition.id,
        label: definition.label,
        version: RELIABILITY_VERSION,
        generatedAt: now,
        durationMs: 0,
        dependencies: definition.dependencies,
        status: "Pending",
        recordCount: 0,
        error: "",
        ageMinutes: 0
      };
    })
  );

}

function buildReliabilitySnapshotRecord(definition, status, recordCount, durationMs, error) {

  return {
    id: definition.id,
    label: definition.label,
    version: RELIABILITY_VERSION,
    generatedAt: getReliabilityTimestamp(),
    durationMs: durationMs,
    dependencies: definition.dependencies,
    status: status,
    recordCount: recordCount,
    error: error,
    ageMinutes: 0
  };

}

function getReliabilitySnapshots() {

  const snapshots =
    getReliabilityPropertyJson(
      RELIABILITY_SNAPSHOTS_KEY,
      []
    );

  const now =
    Date.now();

  return snapshots.map(function(snapshot) {
    const generated =
      Date.parse(snapshot.generatedAt);

    snapshot.ageMinutes =
      generated
        ? Math.max(0, Math.round((now - generated) / 60000))
        : 0;

    return snapshot;
  });

}

function setReliabilitySnapshots(snapshots) {

  setReliabilityPropertyJson(
    RELIABILITY_SNAPSHOTS_KEY,
    snapshots
  );

}

function upsertReliabilitySnapshot(snapshot) {

  const snapshots =
    getReliabilitySnapshots()
      .filter(function(item) {
        return item.id !== snapshot.id;
      });

  snapshots.push(snapshot);
  setReliabilitySnapshots(snapshots);

}

function getReliabilityJobs() {

  return getReliabilityPropertyJson(
    RELIABILITY_JOBS_KEY,
    []
  );

}

function setReliabilityJobs(jobs) {

  setReliabilityPropertyJson(
    RELIABILITY_JOBS_KEY,
    jobs
  );

}

function appendReliabilityAudit(record) {

  const audit =
    getReliabilityAudit();

  audit.push(record);

  setReliabilityPropertyJson(
    RELIABILITY_AUDIT_KEY,
    audit.slice(-100)
  );

}

function getReliabilityAudit() {

  return getReliabilityPropertyJson(
    RELIABILITY_AUDIT_KEY,
    []
  );

}

function appendReliabilityHistory(kind, target, durationMs, success) {

  const history =
    getReliabilityHistory();

  history.push({
    kind: kind,
    target: target,
    durationMs: durationMs,
    success: success,
    timestamp: getReliabilityTimestamp()
  });

  setReliabilityPropertyJson(
    RELIABILITY_HISTORY_KEY,
    history.slice(-200)
  );

}

function getReliabilityHistory() {

  return getReliabilityPropertyJson(
    RELIABILITY_HISTORY_KEY,
    []
  );

}

function executeReliabilityCacheRefresh(group, commissioner) {

  invalidatePortalCacheGroup(group || "all");

  return {
    success: true,
    message: "Cache group queued for rebuild: " + (group || "all")
  };

}

function executeReliabilityCacheInvalidation(group, commissioner) {

  invalidatePortalCacheGroup(group || "all");

  return {
    success: true,
    message: "Cache group invalidated: " + (group || "all")
  };

}

function executeReliabilityExpiredCacheCleanup(commissioner) {

  const metadata =
    getPortalCacheMetadata();

  const now =
    Date.now();

  const expired =
    Object.keys(metadata)
      .filter(function(action) {
        return Number(metadata[action].expiresAt) <= now;
      });

  if (expired.length > 0)
    invalidatePortalCacheActions(expired);

  return {
    success: true,
    message: expired.length + " expired cache entries cleared."
  };

}

function buildReliabilityRecoveryActions() {

  return [
    { id: "standings", label: "Rebuild Standings" },
    { id: "records", label: "Rebuild Records" },
    { id: "hallOfFame", label: "Rebuild Hall of Fame" },
    { id: "search", label: "Rebuild Search" },
    { id: "analytics", label: "Rebuild Analytics" },
    { id: "lifecycle", label: "Rebuild Lifecycle Snapshot" },
    { id: "operations", label: "Rebuild Operations Snapshot" },
    { id: "integrity", label: "Rebuild Integrity Snapshot" },
    { id: "rebuildEverything", label: "Rebuild Everything" }
  ];

}

function buildReliabilityCacheActions(cache) {

  const groups =
    Object.keys(PORTAL_CACHE_GROUPS)
      .filter(function(group) {
        return group !== "all";
      });

  return groups.map(function(group) {
    return {
      id: group,
      label: group,
      entries:
        cache.entries.filter(function(entry) {
          return entry.group === group;
        }).length
    };
  });

}

function rebuildReliabilityLeagueSnapshot() {

  return {
    recordCount: getAllRecentGameObjects().length
  };

}

function rebuildReliabilityOperationsSnapshot() {

  const payload =
    JSON.parse(getOperationsSummaryDashboard().getContent());

  return {
    recordCount:
      payload.summary
        ? payload.summary.leagueStatistics.games
        : 0
  };

}

function rebuildReliabilityIntegritySnapshot() {

  const payload =
    JSON.parse(runFreshIntegrityAudit().getContent());

  return {
    recordCount:
      payload.integrity && payload.integrity.sections
        ? payload.integrity.sections.length
        : 0
  };

}

function rebuildReliabilityLifecycleSnapshot() {

  const payload =
    buildEventLifecycleSummaryDashboard(EVENT_ENGINE_DEFAULT_EVENT_ID);

  return {
    recordCount: payload.participants + payload.rounds
  };

}

function rebuildReliabilityStandingsSnapshot() {

  const divisions = [
    getStandingsDivisionConfig("main"),
    getStandingsDivisionConfig("pga"),
    getStandingsDivisionConfig("pgb")
  ];

  return {
    recordCount:
      divisions.reduce(function(total, division) {
        return total + buildStandingsResponse(division).standings.length;
      }, 0)
  };

}

function rebuildReliabilityRecordsSnapshot() {

  const payload =
    JSON.parse(getRecords().getContent());

  return {
    recordCount:
      payload.records
        ? Object.keys(payload.records).length
        : 0
  };

}

function rebuildReliabilityHallOfFameSnapshot() {

  const snapshot =
    getHallOfFameSnapshot();

  return {
    recordCount:
      snapshot && snapshot.playerCareers
        ? snapshot.playerCareers.length
        : 0
  };

}

function rebuildReliabilityAnalyticsSnapshot() {

  const payload =
    JSON.parse(getIntelligence().getContent());

  return {
    recordCount:
      payload.recentUpsets
        ? payload.recentUpsets.length
        : 0
  };

}

function rebuildReliabilitySearchSnapshot() {

  const payload =
    JSON.parse(getSearchData().getContent());

  return {
    recordCount:
      (payload.players || []).length +
      (payload.factions || []).length +
      (payload.missions || []).length +
      (payload.games || []).length +
      (payload.armyLists || []).length
  };

}

function getReliabilitySnapshotDefinition(snapshotId) {

  return RELIABILITY_SNAPSHOT_DEFINITIONS
    .filter(function(definition) {
      return definition.id === snapshotId;
    })[0] || null;

}

function getLastSuccessfulReliabilityRebuild(snapshots) {

  const successful =
    snapshots
      .filter(function(snapshot) {
        return snapshot.status === "Healthy";
      })
      .sort(function(left, right) {
        return Date.parse(right.generatedAt) - Date.parse(left.generatedAt);
      });

  return successful[0]
    ? successful[0].generatedAt
    : "";

}

function getReliabilityPropertyJson(key, fallback) {

  try {
    const value =
      PropertiesService
        .getScriptProperties()
        .getProperty(key);

    return value
      ? JSON.parse(value)
      : fallback;
  }
  catch (err) {
    return fallback;
  }

}

function setReliabilityPropertyJson(key, value) {

  PropertiesService
    .getScriptProperties()
    .setProperty(
      key,
      JSON.stringify(value)
    );

}

function lowerFirstReliability(value) {

  const text =
    String(value || "");

  return text
    ? text.slice(0, 1).toLowerCase() + text.slice(1)
    : text;

}

function getReliabilityTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}
