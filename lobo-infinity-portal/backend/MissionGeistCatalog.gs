/*******************************************************
 * Mission Geist public mission catalog cache.
 *
 * This catalog is refreshed only while a public snapshot is
 * built. It is never consulted by normal Portal API requests.
 *******************************************************/

const MISSION_GEIST_LISTING_URL = "https://infinitygeist.com/api/v1/listing.json";
const MISSION_GEIST_CATALOG_SCHEMA_VERSION = 1;
const MISSION_GEIST_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MISSION_GEIST_CACHE_FOLDER_PROPERTY = "MISSION_GEIST_CATALOG_CACHE_FOLDER_ID";
const MISSION_GEIST_CACHE_MANIFEST_PROPERTY = "MISSION_GEIST_CATALOG_CACHE_MANIFEST";
const MISSION_GEIST_CACHE_FOLDER_NAME = "Lobo Mission Geist Catalog Cache";

function getMissionGeistCatalogForPublicSnapshot_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const cached = readMissionGeistCachedCatalog_(properties);
    if (cached && isMissionGeistCachedCatalogFresh_(cached.manifest))
      return cached.catalog;

    const listing = fetchMissionGeistListing_();
    const catalog = buildMissionGeistCatalog_(listing);
    if (cached && cached.catalog.contentHash === catalog.contentHash) {
      properties.setProperty(
        MISSION_GEIST_CACHE_MANIFEST_PROPERTY,
        JSON.stringify(buildMissionGeistCacheManifest_(cached.manifest.fileId, catalog.contentHash))
      );
      return cached.catalog;
    }

    const folder = getOrCreateMissionGeistCacheFolder_(properties);
    const file = folder.createFile(
      "mission-geist-catalog-" + Date.now() + ".json",
      stableMissionGeistCatalogJson_(catalog),
      MimeType.PLAIN_TEXT
    );
    properties.setProperty(
      MISSION_GEIST_CACHE_MANIFEST_PROPERTY,
      JSON.stringify(buildMissionGeistCacheManifest_(file.getId(), catalog.contentHash))
    );
    return catalog;
  }
  finally {
    lock.releaseLock();
  }
}

function readMissionGeistCachedCatalog_(properties) {
  const manifest = parseMissionGeistCatalogJson_(
    properties.getProperty(MISSION_GEIST_CACHE_MANIFEST_PROPERTY),
    null
  );
  if (!isMissionGeistCacheManifest_(manifest)) return null;
  try {
    const catalog = JSON.parse(
      DriveApp.getFileById(manifest.fileId).getBlob().getDataAsString("UTF-8")
    );
    validateMissionGeistCatalog_(catalog);
    if (catalog.contentHash !== manifest.contentHash) return null;
    return { manifest: manifest, catalog: catalog };
  }
  catch (error) {
    return null;
  }
}

function isMissionGeistCachedCatalogFresh_(manifest) {
  const cachedAt = Date.parse(String(manifest && manifest.cachedAt || ""));
  return Number.isFinite(cachedAt) && Date.now() - cachedAt >= 0 &&
    Date.now() - cachedAt < MISSION_GEIST_CACHE_TTL_MS;
}

function fetchMissionGeistListing_() {
  const response = UrlFetchApp.fetch(MISSION_GEIST_LISTING_URL, {
    headers: { Accept: "application/json" },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200)
    throw new Error("Mission Geist listing request failed (HTTP " + response.getResponseCode() + ").");
  const listing = parseMissionGeistCatalogJson_(response.getContentText(), null);
  if (!listing) throw new Error("Mission Geist listing is not valid JSON.");
  return listing;
}

function buildMissionGeistCatalog_(listing) {
  const catalog = {
    schemaVersion: String(listing.schemaVersion || ""),
    contentHash: String(listing.contentHash || ""),
    generatedAt: String(listing.generatedAt || ""),
    attribution: String(listing.source && listing.source.attribution || "Courtesy of Mission Geist"),
    missions: []
  };
  (listing.seasons || []).forEach(function(collection) {
    const collectionId = String(collection && collection.id || "");
    const collectionName = String(collection && collection.name || "");
    const current = collection && collection.current === true;
    (collection && collection.missions || []).forEach(function(mission) {
      catalog.missions.push({
        id: String(mission && mission.id || ""),
        name: String(mission && mission.name || ""),
        canonicalUrl: String(mission && mission.canonicalUrl || ""),
        rights: copyMissionGeistRights_(mission && mission.rights),
        sourceCollectionId: collectionId,
        sourceCollectionName: collectionName,
        current: current
      });
    });
  });
  catalog.missions.sort(function(left, right) { return left.id.localeCompare(right.id); });
  validateMissionGeistCatalog_(catalog);
  return catalog;
}

function copyMissionGeistRights_(rights) {
  if (!rights || typeof rights !== "object" || Array.isArray(rights)) return {};
  return JSON.parse(JSON.stringify(rights));
}

function validateMissionGeistCatalog_(catalog) {
  if (!catalog || !catalog.schemaVersion || !catalog.contentHash || !catalog.generatedAt ||
      !Array.isArray(catalog.missions))
    throw new Error("Mission Geist catalog metadata is incomplete.");
  const ids = {};
  catalog.missions.forEach(function(mission) {
    if (!mission || !mission.id || !mission.name || !mission.canonicalUrl ||
        !mission.sourceCollectionId || !mission.sourceCollectionName ||
        typeof mission.current !== "boolean" || !mission.rights ||
        typeof mission.rights !== "object" || Array.isArray(mission.rights))
      throw new Error("Mission Geist catalog mission is incomplete.");
    if (ids[mission.id]) throw new Error("Mission Geist catalog contains a duplicate mission ID: " + mission.id);
    ids[mission.id] = true;
  });
}

function getOrCreateMissionGeistCacheFolder_(properties) {
  const folderId = String(properties.getProperty(MISSION_GEIST_CACHE_FOLDER_PROPERTY) || "").trim();
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); }
    catch (ignored) {}
  }
  const folder = DriveApp.createFolder(MISSION_GEIST_CACHE_FOLDER_NAME);
  properties.setProperty(MISSION_GEIST_CACHE_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function buildMissionGeistCacheManifest_(fileId, contentHash) {
  return {
    schemaVersion: MISSION_GEIST_CATALOG_SCHEMA_VERSION,
    fileId: String(fileId || ""),
    contentHash: String(contentHash || ""),
    cachedAt: new Date().toISOString()
  };
}

function isMissionGeistCacheManifest_(manifest) {
  return Boolean(manifest && manifest.schemaVersion === MISSION_GEIST_CATALOG_SCHEMA_VERSION &&
    manifest.fileId && manifest.contentHash && manifest.cachedAt);
}

function parseMissionGeistCatalogJson_(value, fallback) {
  try { return JSON.parse(String(value || "")); }
  catch (error) { return fallback; }
}

function stableMissionGeistCatalogJson_(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableMissionGeistCatalogJson_).join(",") + "]";
  return "{" + Object.keys(value).sort().map(function(key) {
    return JSON.stringify(key) + ":" + stableMissionGeistCatalogJson_(value[key]);
  }).join(",") + "}";
}
