/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * CacheApi.gs
 *
 * Central cache manager for cache-first API delivery.
 *******************************************************/

const PORTAL_CACHE_PREFIX = "portal:v2.0.7:";
const PORTAL_CACHE_VERSION_KEY = "portalCacheVersion";
const PORTAL_CACHE_STATS_KEY = "portalCacheStats";
const PORTAL_CACHE_MANIFEST_KEY = "portalCacheManifest";
const PORTAL_CACHE_METADATA_KEY = "portalCacheMetadata";
const PORTAL_CACHE_TTL_SECONDS = 900;
const PORTAL_STABLE_DASHBOARD_CACHE_TTL_SECONDS = 1800;
const PORTAL_STALE_CACHE_TTL_SECONDS = 21600;

const PORTAL_CACHE_GROUPS = {
  dashboard: ["dashboard", "home", "leader", "recentGames"],
  standings: ["standings", "dashboard", "home", "players", "searchData", "intelligence", "records", "hallOfFame"],
  players: ["players", "player", "searchData", "home", "dashboard", "comparison"],
  factions: ["factions", "faction", "searchData", "home", "intelligence"],
  missions: ["missions", "mission", "searchData", "home", "intelligence"],
  leagueOperations: ["leagueOperations", "home", "eventHome", "eventManager"],
  hallOfFame: ["hallOfFame", "records", "home"],
  analytics: ["intelligence", "records", "home", "notifications", "timeline"],
  armyLists: ["armyLists", "player", "faction", "searchData", "home", "armyIntelligence"],
  armyIntelligence: ["armyIntelligence"],
  streams: ["streams", "home"],
  search: ["searchData", "searchIndex"],
  news: ["news", "home", "notifications", "timeline"],
  settings: ["settings", "home"],
  events: ["events", "event", "eventHome", "eventManager", "eventTemplates", "eventSeasons", "eventRounds", "eventMigrationValidation", "teamTournament", "eventRegistration"],
  seasonCommand: ["seasonCommandCenter", "communityCommandCenter", "schedulingCenter", "matchFinder"],
  scheduling: ["seasonCommandCenter", "communityCommandCenter", "schedulingCenter", "matchFinder", "notifications"],
  operations: ["operationsSummary", "operationsLifecycle", "operationsIdentity", "operationsContent", "operationsDiscord", "operationsNotifications", "operationsAudit", "integrity"],
  all: ["dashboard", "home", "leader", "recentGames", "standings", "players", "player", "factions", "faction", "missions", "mission", "leagueOperations", "intelligence", "records", "hallOfFame", "comparison", "timeline", "news", "settings", "events", "event", "eventHome", "eventManager", "eventTemplates", "eventSeasons", "eventRounds", "eventMigrationValidation", "teamTournament", "eventRegistration", "seasonCommandCenter", "communityCommandCenter", "schedulingCenter", "matchFinder", "streams", "searchData", "searchIndex", "armyLists", "armyIntelligence", "operationsSummary", "operationsLifecycle", "operationsIdentity", "operationsContent", "operationsDiscord", "operationsNotifications", "operationsAudit", "integrity"]
};

const PORTAL_CACHE_ENDPOINT_GROUP = {
  dashboard: "dashboard",
  home: "dashboard",
  leader: "dashboard",
  recentGames: "dashboard",
  standings: "standings",
  players: "players",
  player: "players",
  factions: "factions",
  faction: "factions",
  missions: "missions",
  mission: "missions",
  leagueOperations: "leagueOperations",
  intelligence: "analytics",
  records: "hallOfFame",
  hallOfFame: "hallOfFame",
  comparison: "players",
  timeline: "analytics",
  news: "news",
  settings: "settings",
  events: "events",
  event: "events",
  eventHome: "events",
  eventManager: "events",
  eventTemplates: "events",
  eventSeasons: "events",
  eventRounds: "events",
  eventMigrationValidation: "events",
  teamTournament: "events",
  eventRegistration: "events",
  seasonCommandCenter: "seasonCommand",
  communityCommandCenter: "seasonCommand",
  schedulingCenter: "scheduling",
  matchFinder: "scheduling",
  streams: "streams",
  searchData: "search",
  searchIndex: "search",
  armyLists: "armyLists",
  armyIntelligence: "armyIntelligence"
};

function getCachedApiResponse(e, action, producer) {

  return cacheManagerGetOrBuild(
    e,
    action,
    producer
  );

}

function cacheManagerGetOrBuild(e, action, producer) {

  const start =
    Date.now();

  const cacheLookupStart =
    startApiPipelineStage("cacheLookup");

  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    getPortalCacheKey(e, action);

  const staleKey =
    getPortalStaleCacheKey(cacheKey);

  const cached =
    cache.get(cacheKey);

  if (cached) {
    endApiPipelineStage(
      "cacheLookup",
      cacheLookupStart,
      {
        cacheKey: cacheKey,
        hit: true
      }
    );

    recordPortalCacheMetric(
      action,
      "hit",
      Date.now() - start,
      false
    );

    return jsonFromCachePayload(cached);
  }

  endApiPipelineStage(
    "cacheLookup",
    cacheLookupStart,
    {
      cacheKey: cacheKey,
      hit: false
    }
  );

  recordPortalCacheMetric(
    action,
    "miss",
    Date.now() - start,
    false
  );

  try {

    const response =
      producer();

    const content =
      response.getContent();

    const createdAt =
      Date.now();

    const payload =
      buildPortalCachePayload(
        action,
        content,
        createdAt
      );

    writePortalCacheEntry(
      cache,
      cacheKey,
      staleKey,
      payload,
      action
    );

    recordPortalCacheMetric(
      action,
      "refresh",
      Date.now() - start,
      false
    );

    return response;

  }
  catch (err) {

    const stale =
      cache.get(staleKey);

    if (stale) {
      recordPortalCacheMetric(
        action,
        "stale",
        Date.now() - start,
        true
      );

      return jsonFromCachePayload(stale);
    }

    recordPortalCacheMetric(
      action,
      "error",
      Date.now() - start,
      true
    );

    return jsonOutput({
      success: false,
      error: String(err),
      cacheStatus: "error-no-cache"
    });

  }

}

function buildPortalCachePayload(action, content, createdAt) {

  const ttl =
    getPortalCacheTtl(action);

  return JSON.stringify({
    content: content,
    metadata: {
      action: action,
      createdAt: createdAt,
      createdAtText: formatPortalCacheTimestamp(createdAt),
      expiresAt: createdAt + ttl * 1000,
      expiresAtText: formatPortalCacheTimestamp(createdAt + ttl * 1000),
      lastRefresh: formatPortalCacheTimestamp(createdAt),
      ttlSeconds: ttl,
      version: getPortalCacheVersion(),
      status: "fresh",
      size: content.length
    }
  });

}

function writePortalCacheEntry(cache, cacheKey, staleKey, payload, action) {

  const ttl =
    getPortalCacheTtl(action);

  try {

    cache.put(
      cacheKey,
      payload,
      ttl
    );

    cache.put(
      staleKey,
      payload,
      PORTAL_STALE_CACHE_TTL_SECONDS
    );

    updatePortalCacheManifest(
      cacheKey,
      action
    );

    updatePortalCacheMetadata(
      cacheKey,
      JSON.parse(payload).metadata
    );

  }
  catch (err) {

    Logger.log(
      "Cache Manager write skipped: " +
      err
    );

  }

}

function jsonFromCachePayload(payload) {

  const parsed =
    JSON.parse(payload);

  return ContentService
    .createTextOutput(parsed.content)
    .setMimeType(ContentService.MimeType.JSON);

}

function refreshPortalCacheGroup(group) {

  invalidatePortalCacheGroup(group);

  return jsonOutput({
    success: true,
    cache: getPortalCacheStatus(),
    group: group || "all"
  });

}

function clearPortalCache() {

  invalidatePortalCacheGroup("all");

}

function invalidatePortalCacheGroup(group) {

  const normalizedGroup =
    group || "all";

  const actions =
    PORTAL_CACHE_GROUPS[normalizedGroup] || PORTAL_CACHE_GROUPS.all;

  invalidatePortalCacheActions(actions);

}

function invalidatePortalCacheActions(actions) {

  const cache =
    CacheService.getScriptCache();

  const manifest =
    getPortalCacheManifest();

  const keysToRemove = [];

  manifest.entries.forEach(function(entry) {

    if (actions.indexOf(entry.action) !== -1) {
      keysToRemove.push(entry.key);
      keysToRemove.push(getPortalStaleCacheKey(entry.key));
    }

  });

  if (keysToRemove.length > 0)
    cache.removeAll(keysToRemove.slice(0, 100));

  manifest.entries =
    manifest.entries.filter(function(entry) {
      return actions.indexOf(entry.action) === -1;
    });

  setPortalCacheManifest(manifest);

  const metadata =
    getPortalCacheMetadata();

  actions.forEach(function(action) {
    delete metadata[action];
  });

  setPortalCacheMetadata(metadata);

  incrementPortalCacheInvalidation(actions);

}

function getPortalCacheStatus() {

  const metadata =
    getPortalCacheMetadata();

  const stats =
    getPortalCacheStats();

  const entries =
    Object.keys(metadata)
      .sort()
      .map(function(action) {

        const item =
          metadata[action];

        const now =
          Date.now();

        const remaining =
          Math.max(
            0,
            Math.floor((Number(item.expiresAt) - now) / 1000)
          );

        return {
          action: action,
          group: PORTAL_CACHE_ENDPOINT_GROUP[action] || "general",
          ageSeconds:
            Math.max(
              0,
              Math.floor((now - Number(item.createdAt)) / 1000)
            ),
          timeRemainingSeconds: remaining,
          lastRefresh: item.lastRefresh || "",
          createdAt: item.createdAtText || "",
          expiresAt: item.expiresAtText || "",
          version: item.version || getPortalCacheVersion(),
          status: remaining > 0 ? "fresh" : "stale",
          size: Number(item.size) || 0,
          health: remaining > 0 ? "Healthy" : "Expired"
        };

      });

  const totalRequests =
    Math.max(1, stats.hits + stats.misses);

  return {
    status: entries.length > 0 ? "Ready" : "Cold",
    version: getPortalCacheVersion(),
    lastRefresh: entries[0] ? entries[0].lastRefresh : "",
    cacheAge: entries[0] ? entries[0].ageSeconds + "s" : "No cache yet",
    entries: entries,
    performance: {
      averageApiResponse: getPortalAverageResponse(stats),
      slowestEndpoint: stats.slowestEndpoint || "",
      fastestEndpoint: stats.fastestEndpoint || "",
      cacheHitRate: Math.round((stats.hits / totalRequests) * 100),
      cacheMissRate: Math.round((stats.misses / totalRequests) * 100),
      totalCacheRefreshes: stats.refreshes,
      googleSheetsReads: stats.misses + stats.refreshes,
      staleFallbacks: stats.staleFallbacks,
      errors: stats.errors,
      estimatedPerformanceImprovement: estimatePortalPerformanceImprovement(stats)
    }
  };

}

function getPortalCacheVersion() {

  const properties =
    PropertiesService.getScriptProperties();

  let version =
    properties.getProperty(PORTAL_CACHE_VERSION_KEY);

  if (!version) {

    version = "1";

    properties.setProperty(
      PORTAL_CACHE_VERSION_KEY,
      version
    );

  }

  return version;

}

function getPortalCacheKey(e, action) {

  const parameters =
    e && e.parameter
      ? e.parameter
      : {};

  const parts =
    Object.keys(parameters)
      .filter(function(key) {
        return [
          "authToken",
          "idToken",
          "credential",
          "_",
          "cacheBust"
        ].indexOf(key) === -1;
      })
      .sort()
      .map(function(key) {
        return (
          encodeURIComponent(key) +
          "=" +
          encodeURIComponent(parameters[key])
        );
      });

  if (action === "hallOfFame")
    parts.push("schema=2.5.4.1");

  if (
    [
      "players",
      "player",
      "factions",
      "faction",
      "missions",
      "mission",
      "intelligence",
      "records",
      "hallOfFame",
      "comparison",
      "timeline",
      "searchData",
      "searchIndex"
    ].indexOf(action) !== -1
  )
    parts.push("eventContextSchema=13.0");

  if (
    [
      "players",
      "searchData",
      "searchIndex"
    ].indexOf(action) !== -1
  )
    parts.push("communityPlayerRegistrySchema=5.3");

  if (action === "events")
    parts.push("schema=portalUser1");

  return (
    PORTAL_CACHE_PREFIX +
    getPortalCacheVersion() +
    ":" +
    action +
    ":" +
    parts.join("&")
  );

}

function getPortalStaleCacheKey(cacheKey) {

  return cacheKey + ":stale";

}

function getPortalCacheTtl(action) {

  if (
    [
      "dashboard",
      "home",
      "leader"
    ].indexOf(action) !== -1
  )
    return PORTAL_STABLE_DASHBOARD_CACHE_TTL_SECONDS;

  return PORTAL_CACHE_TTL_SECONDS;

}

function updatePortalCacheManifest(key, action) {

  const manifest =
    getPortalCacheManifest();

  manifest.entries =
    manifest.entries.filter(function(entry) {
      return entry.key !== key;
    });

  manifest.entries.push({
    key: key,
    action: action,
    group: PORTAL_CACHE_ENDPOINT_GROUP[action] || "general",
    updatedAt: Date.now()
  });

  manifest.entries =
    manifest.entries.slice(-120);

  setPortalCacheManifest(manifest);

}

function getPortalCacheManifest() {

  return getPortalPropertyJson(
    PORTAL_CACHE_MANIFEST_KEY,
    {
      entries: []
    }
  );

}

function setPortalCacheManifest(manifest) {

  setPortalPropertyJson(
    PORTAL_CACHE_MANIFEST_KEY,
    manifest
  );

}

function updatePortalCacheMetadata(key, entry) {

  const metadata =
    getPortalCacheMetadata();

  metadata[entry.action] = entry;

  setPortalCacheMetadata(metadata);

}

function getPortalCacheMetadata() {

  return getPortalPropertyJson(
    PORTAL_CACHE_METADATA_KEY,
    {}
  );

}

function setPortalCacheMetadata(metadata) {

  setPortalPropertyJson(
    PORTAL_CACHE_METADATA_KEY,
    metadata
  );

}

function getPortalCacheStats() {

  const fallback = {
    hits: 0,
    misses: 0,
    refreshes: 0,
    invalidations: 0,
    staleFallbacks: 0,
    errors: 0,
    totalResponseMs: 0,
    responseCount: 0,
    slowestEndpoint: "",
    slowestMs: 0,
    fastestEndpoint: "",
    fastestMs: 0
  };

  return getPortalPropertyJson(
    PORTAL_CACHE_STATS_KEY,
    fallback
  );

}

function recordPortalCacheMetric(action, type, responseMs, failed) {

  const stats =
    getPortalCacheStats();

  if (type === "hit")
    stats.hits++;

  if (type === "miss")
    stats.misses++;

  if (type === "refresh")
    stats.refreshes++;

  if (type === "stale")
    stats.staleFallbacks++;

  if (type === "error" || failed)
    stats.errors++;

  stats.totalResponseMs += responseMs;
  stats.responseCount++;

  if (
    responseMs > stats.slowestMs ||
    !stats.slowestEndpoint
  ) {
    stats.slowestMs = responseMs;
    stats.slowestEndpoint = action + " (" + responseMs + "ms)";
  }

  if (
    responseMs < stats.fastestMs ||
    !stats.fastestEndpoint
  ) {
    stats.fastestMs = responseMs;
    stats.fastestEndpoint = action + " (" + responseMs + "ms)";
  }

  setPortalPropertyJson(
    PORTAL_CACHE_STATS_KEY,
    stats
  );

}

function incrementPortalCacheInvalidation(actions) {

  const stats =
    getPortalCacheStats();

  stats.invalidations += actions.length;

  if (actions.length >= PORTAL_CACHE_GROUPS.all.length) {

    const nextVersion =
      String(Date.now());

    PropertiesService
      .getScriptProperties()
      .setProperty(
        PORTAL_CACHE_VERSION_KEY,
        nextVersion
      );

  }

  setPortalPropertyJson(
    PORTAL_CACHE_STATS_KEY,
    stats
  );

}

function getPortalAverageResponse(stats) {

  if (!stats.responseCount)
    return "0ms";

  return (
    Math.round(stats.totalResponseMs / stats.responseCount) +
    "ms"
  );

}

function estimatePortalPerformanceImprovement(stats) {

  const total =
    stats.hits + stats.misses;

  if (total === 0)
    return "Awaiting traffic";

  return (
    Math.round((stats.hits / total) * 100) +
    "% cache-served"
  );

}

function getPortalPropertyJson(key, fallback) {

  try {

    const text =
      PropertiesService
        .getScriptProperties()
        .getProperty(key);

    if (!text)
      return fallback;

    return JSON.parse(text);

  }
  catch (err) {

    return fallback;

  }

}

function setPortalPropertyJson(key, value) {

  try {

    PropertiesService
      .getScriptProperties()
      .setProperty(
        key,
        JSON.stringify(value)
      );

  }
  catch (err) {

    Logger.log(
      "Cache Manager property write skipped: " +
      err
    );

  }

}

function formatPortalCacheTimestamp(timestamp) {

  return Utilities.formatDate(
    new Date(timestamp),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}
