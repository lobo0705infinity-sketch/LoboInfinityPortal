/**
 * CanonicalArmyCodeResolver.gs
 *
 * Sole owner of Army Code selection, lookup, fallback, normalization, and
 * submitted Army List identity resolution.
 */

var CanonicalArmyCodeResolver = (function() {

  function resolveGameSideCode(game, side, normalizeString) {

    return normalizeString(
      side === "winner"
        ? game.winnerArmyCode
        : game.loserArmyCode
    );

  }

  function buildPlayerFactionLookup(listsById, getPlayerFactionKey) {

    const lookup = {};

    Object.keys(listsById || {}).forEach(function(id) {
      const list = listsById[id];

      if (!list || !list.armyCode)
        return;

      [list.player, list.playerDisplayName].forEach(function(player) {
        const key = getPlayerFactionKey(player, list.faction);

        if (key)
          lookup[key] = list;
      });
    });

    return lookup;

  }

  function resolveWithFallback(options) {

    const direct = options.normalizeString(options.directCode);

    if (direct)
      return direct;

    const id = options.normalizeString(options.armyListId);

    if (id && options.listsById && options.listsById[id])
      return options.normalizeString(options.listsById[id].armyCode);

    const key = options.getPlayerFactionKey(options.player, options.faction);

    if (!key || !options.playerFactionLookup || !options.playerFactionLookup[key])
      return "";

    return options.normalizeString(options.playerFactionLookup[key].armyCode);

  }

  function resolveSubmittedArmyList(options) {

    const armyCode = resolveGameSideCode(
      options.game,
      options.side,
      options.normalizeString
    );
    const armyListId = options.normalizeNumber(
      options.side === "winner"
        ? options.game.winnerArmyListId
        : options.game.loserArmyListId
    );
    const id = armyListId || (
      armyCode
        ? buildArmyCodeId(armyCode, options.normalizeString)
        : buildGameSideId(options.game, options.side, options.normalizeNumber)
    );

    return {
      armyCode: armyCode,
      armyListId: armyListId,
      id: id
    };

  }

  function buildArmyCodeId(armyCode, normalizeString) {

    const identity = normalizeSubmittedCodeIdentity(armyCode, normalizeString);

    if (!identity)
      return 0;

    let hash = 5381;

    for (let index = 0; index < identity.length; index++)
      hash = (hash * 33) ^ identity.charCodeAt(index);

    return 800000000 + (hash >>> 0);

  }

  function normalizeSubmittedCodeIdentity(value, normalizeString) {

    return normalizeString(value)
      .replace(/\s+/g, "")
      .replace(/-/g, "")
      .replace(/_/g, "");

  }

  function buildGameSideId(game, side, normalizeNumber) {

    const sideOffset = side === "winner" ? 1 : 2;

    return 900000000 +
      normalizeNumber(game.sourceIndex || game.id) * 2 +
      sideOffset;

  }

  return Object.freeze({
    buildArmyCodeId: buildArmyCodeId,
    buildGameSideId: buildGameSideId,
    buildPlayerFactionLookup: buildPlayerFactionLookup,
    normalizeSubmittedCodeIdentity: normalizeSubmittedCodeIdentity,
    resolveGameSideCode: resolveGameSideCode,
    resolveSubmittedArmyList: resolveSubmittedArmyList,
    resolveWithFallback: resolveWithFallback
  });

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = CanonicalArmyCodeResolver;
