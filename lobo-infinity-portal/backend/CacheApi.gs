/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * CacheApi.gs
 *
 * Lightweight API response caching.
 *******************************************************/

const PORTAL_CACHE_PREFIX = "portal:v1.0.3.1:";
const PORTAL_CACHE_VERSION_KEY = "portalCacheVersion";

const PORTAL_CACHE_SECONDS = {
  dashboard: 300,
  leader: 300,
  recentGames: 180,
  standings: 300,
  players: 300,
  player: 300,
  factions: 300,
  faction: 300,
  missions: 300,
  mission: 300,
  intelligence: 300,
  records: 300,
  hallOfFame: 300,
  comparison: 300,
  notifications: 120,
  timeline: 120,
  news: 120,
  settings: 60,
  streams: 60,
  searchData: 300
};

function getCachedApiResponse(e, action, producer) {

  const ttl =
    PORTAL_CACHE_SECONDS[action] || 0;

  if (ttl <= 0)
    return producer();

  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    getPortalCacheKey(e, action);

  const cached =
    cache.get(cacheKey);

  if (cached)
    return ContentService
      .createTextOutput(cached)
      .setMimeType(ContentService.MimeType.JSON);

  const response =
    producer();

  const content =
    response.getContent();

  try {

    cache.put(
      cacheKey,
      content,
      ttl
    );

  }
  catch (err) {

    Logger.log(
      "Cache write skipped: " +
      err
    );

  }

  return response;

}

function getPortalCacheKey(e, action) {

  const parameters =
    e && e.parameter
      ? e.parameter
      : {};

  const parts =
    Object.keys(parameters)
      .sort()
      .map(function(key) {

        return (
          encodeURIComponent(key) +
          "=" +
          encodeURIComponent(parameters[key])
        );

      });

  return (
    PORTAL_CACHE_PREFIX +
    getPortalCacheVersion() +
    ":" +
    action +
    ":" +
    parts.join("&")
  );

}

function clearPortalCache() {

  try {

    const nextVersion =
      String(
        Date.now()
      );

    PropertiesService
      .getScriptProperties()
      .setProperty(
        PORTAL_CACHE_VERSION_KEY,
        nextVersion
      );

  }
  catch (err) {

    Logger.log(
      "Cache clear skipped: " +
      err
    );

  }

}

function getPortalCacheVersion() {

  const properties =
    PropertiesService.getScriptProperties();

  let version =
    properties.getProperty(
      PORTAL_CACHE_VERSION_KEY
    );

  if (!version) {

    version = "1";

    properties.setProperty(
      PORTAL_CACHE_VERSION_KEY,
      version
    );

  }

  return version;

}
