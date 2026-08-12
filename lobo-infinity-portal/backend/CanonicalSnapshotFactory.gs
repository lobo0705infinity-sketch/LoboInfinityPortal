/**
 * CanonicalSnapshotFactory.gs
 *
 * Sole construction owner for Army Intelligence snapshots. Callers retain
 * decoding, orchestration, persistence, and read-model responsibilities.
 */

var CanonicalSnapshotFactory = (function() {

  function createDeterministicSnapshot(list, decoded) {

    return {
      decoderVersion: decoded.decoderVersion,
      id: "army-list-" + list.id,
      timestamp: new Date().toISOString(),
      generated: true,
      source: "Army Lists sheet",
      units: decoded.profiles,
      unitCount: decoded.unitCount,
      points: decoded.points,
      swc: decoded.swc
    };

  }

  function createLegacySnapshot(source, decoded, normalizeUnit, normalizeString) {

    if (!decoded.success)
      return null;

    const shared =
      decoded.sharedDecode || {};

    const entries =
      (decoded.profiles || []).map(function(unit) {
        return normalizeUnit(unit);
      });

    return {
      decoded: {
        armyCode: normalizeString(shared.raw || ""),
        combatGroups: buildLegacyCombatGroups(entries),
        decoderVersion: decoded.decoderVersion,
        faction: shared.faction || "",
        listName: shared.armyName || "",
        orderCounts: {
          impetuous: 0,
          irregular: 0,
          lieutenant: 0,
          regular: decoded.unitCount || 0,
          tacticalAwareness: 0
        },
        sectorial: shared.sectorial || shared.faction || "",
        totals: {
          combatGroups: shared.combatGroups || 0,
          points: decoded.points || 0,
          swc: decoded.swc || 0
        },
        units: entries
      },
      decodedAt: new Date().toISOString(),
      error: "",
      snapshotKey: source.snapshotKey,
      status: "decoded"
    };

  }

  function createRefreshSnapshot(snapshotKey, decoded, error, status) {

    return {
      decoded: decoded || null,
      decodedAt: new Date().toISOString(),
      error: error || "",
      snapshotKey: snapshotKey,
      status: status
    };

  }

  function createLegacyStorageSnapshot(source, snapshot, decoderFailure) {

    if (!snapshot)
      return {
        armyCodeHash: source.armyCodeHash,
        decodedAt: "",
        decodedJson: "",
        error: serializeDecoderFailure(decoderFailure),
        snapshotKey: source.snapshotKey,
        status: "failed"
      };

    return {
      armyCodeHash: source.armyCodeHash,
      decodedAt: snapshot.decodedAt,
      decodedJson: JSON.stringify(snapshot.decoded),
      error: snapshot.error,
      snapshotKey: source.snapshotKey,
      status: snapshot.status
    };

  }

  function serializeDecoderFailure(decoderFailure) {

    if (!decoderFailure)
      return "Army Code could not be decoded.";

    try {
      return JSON.stringify(decoderFailure);
    }
    catch (err) {
      return String(decoderFailure);
    }

  }

  function buildLegacyCombatGroups(entries) {

    const groups = {};

    entries.forEach(function(entry) {
      const group =
        Number(entry.combatGroup) || 1;

      if (!groups[group])
        groups[group] = [];

      groups[group].push(entry);
    });

    return Object.keys(groups)
      .sort()
      .map(function(group) {
        return {
          combatGroup: Number(group),
          entries: groups[group]
        };
      });

  }

  return Object.freeze({
    createDeterministicSnapshot: createDeterministicSnapshot,
    createLegacySnapshot: createLegacySnapshot,
    createLegacyStorageSnapshot: createLegacyStorageSnapshot,
    createRefreshSnapshot: createRefreshSnapshot
  });

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = CanonicalSnapshotFactory;
