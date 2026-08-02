/*******************************************************
 * OperationsCacheAdapter.gs
 *
 * Phase 2 subsystem adapter. This file exposes cache
 * contracts and delegates to existing cache functions.
 * It does not enqueue, schedule, or execute operations.
 *******************************************************/

const OPERATIONS_CACHE_ADAPTER_SCHEMA_VERSION = "cache-adapter-v1";

function getOperationsCacheAdapter() {

  return {
    id: "cache",
    label: "Cache",
    operationType: "Refresh Cache",
    operationClass: "Immediate",
    getCurrentState: getOperationsCacheCurrentState,
    rebuild: rebuildOperationsCache,
    verify: verifyOperationsCache,
    getDependencies: getOperationsCacheDependencies,
    getAffectedCacheGroups: getOperationsCacheAffectedCacheGroups
  };

}

function getOperationsCacheCurrentState() {

  const status =
    typeof getPortalCacheStatus === "function"
      ? getPortalCacheStatus()
      : {};

  const healthy =
    typeof getPortalCacheStatus === "function" &&
    typeof invalidatePortalCacheGroup === "function";

  const statusHash =
    getOperationsCacheHash(JSON.stringify(status));

  const staleState =
    getOperationsCacheStaleState(healthy, status);

  return {
    subsystemId: "cache",
    subsystemName: "Cache",
    schemaVersion: OPERATIONS_CACHE_ADAPTER_SCHEMA_VERSION,
    sourceHash: statusHash,
    artifactHash: statusHash,
    artifactStateKey:
      getOperationsCacheHash([
        OPERATIONS_CACHE_ADAPTER_SCHEMA_VERSION,
        statusHash
      ].join("|")),
    lastBuiltAt: getOperationsCacheString(status.lastRefresh),
    healthy: healthy,
    stale: staleState.stale,
    staleReason: staleState.staleReason,
    details: status
  };

}

function rebuildOperationsCache(context) {

  if (typeof invalidatePortalCacheGroup !== "function")
    return {
      success: false,
      error: "invalidatePortalCacheGroup is not available."
    };

  const group =
    getOperationsCacheRequestedGroup(context);

  return {
    success: true,
    group: group,
    plannedCacheInvalidations: [group],
    cache:
      typeof getPortalCacheStatus === "function"
        ? getPortalCacheStatus()
        : {}
  };

}

function verifyOperationsCache() {

  const status =
    typeof getPortalCacheStatus === "function"
      ? getPortalCacheStatus()
      : null;

  const errors = [];

  if (!status)
    errors.push("getPortalCacheStatus is not available.");

  if (typeof invalidatePortalCacheGroup !== "function")
    errors.push("invalidatePortalCacheGroup is not available.");

  return {
    success: errors.length === 0,
    errors: errors,
    warnings: [],
    metrics: {
      status: status ? getOperationsCacheString(status.status) : "",
      version: status ? getOperationsCacheString(status.version) : "",
      entryCount:
        status && status.entries
          ? status.entries.length
          : 0
    }
  };

}

function getOperationsCacheDependencies() {

  return [];

}

function getOperationsCacheAffectedCacheGroups(context) {

  return [getOperationsCacheRequestedGroup(context)];

}

function getOperationsCacheRequestedGroup(context) {

  return context && context.group
    ? getOperationsCacheString(context.group)
    : "all";

}

function getOperationsCacheStaleState(healthy, status) {

  if (!healthy)
    return {
      stale: true,
      staleReason: "Cache dependencies are unavailable."
    };

  const staleEntries =
    status && status.entries
      ? status.entries.filter(function(entry) {
          return getOperationsCacheString(entry.status) === "stale";
        })
      : [];

  if (staleEntries.length > 0)
    return {
      stale: true,
      staleReason:
        staleEntries.length +
        " cache entries are expired."
    };

  return {
    stale: false,
    staleReason: ""
  };

}

function getOperationsCacheHash(value) {

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      getOperationsCacheString(value),
      Utilities.Charset.UTF_8
    );

  return digest.map(function(byte) {
    const value =
      byte < 0 ? byte + 256 : byte;

    return ("0" + value.toString(16)).slice(-2);
  }).join("");

}

function getOperationsCacheString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
