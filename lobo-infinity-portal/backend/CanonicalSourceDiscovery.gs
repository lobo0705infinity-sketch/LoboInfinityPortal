/**
 * CanonicalSourceDiscovery.gs
 *
 * Sole owner of Army Intelligence source discovery, normalization, identity,
 * snapshot-key generation, ordering, and deduplication.
 */

var CanonicalSourceDiscovery = (function() {

  function discover(options) {

    const sources = [];
    (options.sources || []).forEach(function(source) {
      appendSource(sources, source, options);
    });
    const games = options.deduplicateGames
      ? uniqueGames(options.games || [], options.normalizeString)
      : (options.games || []);

    games.forEach(function(game) {
      appendSource(sources, buildGameSource(game, "winner", options), options);
      appendSource(sources, buildGameSource(game, "loser", options), options);
    });

    (options.tournamentResults || []).forEach(function(item) {
      appendSource(sources, buildTournamentSource(item, "player1", options), options);
      appendSource(sources, buildTournamentSource(item, "player2", options), options);
    });

    return uniqueSources(sources);

  }

  function buildGameSource(game, side, options) {

    const winner = side === "winner";
    const player = winner
      ? game.winnerDisplayName || game.winner
      : game.loserDisplayName || game.loser;
    const opponent = winner
      ? game.loserDisplayName || game.loser
      : game.winnerDisplayName || game.winner;
    const faction = winner ? game.winnerFaction : game.loserFaction;

    const source = {
      armyCode: options.resolveArmyCode(game, side, player, faction),
      date: game.date,
      event: options.resolveEventName(game),
      faction: faction,
      gameType: options.formatGameType(game.gameType),
      mission: game.mission,
      opponent: opponent,
      player: player,
      result: options.normalizeString(game.gameResult).toLowerCase() === "draw"
        ? "Draw"
        : winner ? "Win" : "Loss",
      sectorial: faction,
      sourceId: game.id,
      sourcePlayer: side,
      sourceType: game.gameType === "casual" ? "casual" : "league"
    };

    if (options.includeArmyListId)
      source.armyListId = winner ? game.winnerArmyListId : game.loserArmyListId;

    return source;

  }

  function buildTournamentSource(item, side, options) {

    const result = item.result;
    const first = side === "player1";
    const player = first ? result.player : result.opponent;

    return {
      armyCode: first ? result.player1ArmyCode : result.player2ArmyCode,
      date: result.createdAt || result.updatedAt,
      event: item.eventName || item.eventId,
      faction: first ? result.winningFaction : "",
      gameType: "Tournament",
      mission: result.mission,
      opponent: first ? result.opponent : result.player,
      player: player,
      result: options.tournamentResult(result, player),
      sectorial: first ? result.winningFaction : "",
      sourceId: result.resultId,
      sourcePlayer: side,
      sourceType: "tournament"
    };

  }

  function appendSource(sources, source, options) {

    const armyCode = options.normalizeString(source.armyCode);

    if (!armyCode)
      return;

    const armyCodeHash = options.hashArmyCode(armyCode);
    const player = options.normalizeString(source.player);
    const sourceType = options.normalizeString(source.sourceType);
    const sourceId = options.normalizeString(source.sourceId);
    const sourcePlayer = options.normalizeString(source.sourcePlayer);
    const normalized = options.normalizeAll
      ? {
          armyCode: armyCode,
          armyCodeHash: armyCodeHash,
          armyListId: options.normalizeString(source.armyListId),
          date: options.normalizeString(source.date),
          event: options.normalizeString(source.event),
          faction: options.normalizeString(source.faction),
          gameType: options.normalizeString(source.gameType),
          mission: options.normalizeString(source.mission),
          opponent: options.normalizeString(source.opponent),
          player: player,
          result: options.normalizeString(source.result),
          sectorial: options.normalizeString(source.sectorial)
        }
      : {};

    if (!options.normalizeAll)
      Object.keys(source).forEach(function(key) {
        normalized[key] = source[key];
      });

    normalized.armyCode = armyCode;
    normalized.armyCodeHash = armyCodeHash;
    normalized.player = player;
    normalized.snapshotKey = [
      sourceType,
      sourceId,
      sourcePlayer,
      options.normalizeKey(player),
      armyCodeHash
    ].join(":");
    normalized.sourceId = sourceId;
    normalized.sourcePlayer = sourcePlayer;
    normalized.sourceType = sourceType;
    sources.push(normalized);

  }

  function uniqueGames(games, normalizeString) {

    const seen = {};

    return games.filter(function(game) {
      const key = [
        normalizeString(game.id),
        normalizeString(game.gameType)
      ].join(":");

      if (seen[key])
        return false;

      seen[key] = true;
      return true;
    });

  }

  function uniqueSources(sources) {

    const seen = {};

    return sources.filter(function(source) {
      if (seen[source.snapshotKey])
        return false;

      seen[source.snapshotKey] = true;
      return true;
    });

  }

  return Object.freeze({
    discover: discover
  });

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = CanonicalSourceDiscovery;
