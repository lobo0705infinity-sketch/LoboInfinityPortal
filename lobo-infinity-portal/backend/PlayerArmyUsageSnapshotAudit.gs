/*******************************************************
 * Owner-run, read-only audit for one validated, unpublished
 * Public Snapshot V1 player army-usage artifact.
 *******************************************************/

const PLAYER_ARMY_USAGE_AUDIT_SNAPSHOT_ID = "20260902T202809Z";

function auditValidatedPlayerArmyUsageSnapshot20260902T202809Z() {
  const snapshotId = PLAYER_ARMY_USAGE_AUDIT_SNAPSHOT_ID;
  const files = readPlayerArmyUsageAuditSnapshotFiles_(snapshotId);
  const manifest = JSON.parse(files["snapshot.json"]);
  if (manifest.snapshotId !== snapshotId || manifest.status !== "validated" ||
      manifest.published !== false || manifest.livePointer !== false)
    throw new Error("Player Army Usage audit requires the exact validated, unpublished snapshot: " + snapshotId);

  const players = readPlayerArmyUsageAuditDataset_(files["players.json"], snapshotId, "players");
  const games = readPlayerArmyUsageAuditDataset_(files["games.json"], snapshotId, "games");
  const audit = buildPlayerArmyUsageAudit_(players, games);

  audit.players.forEach(function(player) {
    Logger.log("PLAYER_ARMY_USAGE_AUDIT_PLAYER " + JSON.stringify(player));
  });
  audit.ties.forEach(function(tie) {
    Logger.log("PLAYER_ARMY_USAGE_AUDIT_TIE " + JSON.stringify(tie));
  });
  Logger.log("PLAYER_ARMY_USAGE_AUDIT_NO_ARMY_SELECTED " + JSON.stringify(audit.noArmySelected));
  audit.inventory.forEach(function(entry) {
    Logger.log("PLAYER_ARMY_USAGE_AUDIT_INVENTORY " + JSON.stringify(entry));
  });
  Logger.log("PLAYER_ARMY_USAGE_AUDIT_TOTALS " + JSON.stringify(audit.totals));

  if (audit.errors.length)
    throw new Error("Player Army Usage audit failed: " + audit.errors.join(" | "));

  const result = {
    success: true,
    snapshotId: snapshotId,
    published: false,
    livePointer: false,
    players: audit.players.length,
    games: games.length,
    draws: audit.totals.draws,
    noArmySelected: audit.noArmySelected,
    ties: audit.ties,
    inventory: audit.inventory,
    totals: audit.totals,
    readOnly: true
  };
  Logger.log("PLAYER_ARMY_USAGE_AUDIT_RESULT " + JSON.stringify(result));
  return result;
}

function readPlayerArmyUsageAuditSnapshotFiles_(snapshotId) {
  const rootId = String(
    PropertiesService.getScriptProperties().getProperty(PUBLIC_SNAPSHOT_V1_ROOT_PROPERTY) || ""
  ).trim();
  if (!rootId) throw new Error("Public Snapshot V1 root folder is not configured.");
  const folders = DriveApp.getFolderById(rootId).getFoldersByName(snapshotId);
  if (!folders.hasNext()) throw new Error("Snapshot folder was not found: " + snapshotId);
  const folder = folders.next();
  if (folders.hasNext()) throw new Error("Duplicate snapshot folders found: " + snapshotId);
  const files = {};
  ["snapshot.json", "players.json", "games.json"].forEach(function(name) {
    const matches = folder.getFilesByName(name);
    if (!matches.hasNext()) throw new Error("Snapshot audit file is missing: " + name);
    files[name] = matches.next().getBlob().getDataAsString("UTF-8");
    if (matches.hasNext()) throw new Error("Duplicate snapshot audit file: " + name);
  });
  return files;
}

function readPlayerArmyUsageAuditDataset_(content, snapshotId, name) {
  const envelope = JSON.parse(content);
  if (envelope.snapshotId !== snapshotId || !Array.isArray(envelope.data))
    throw new Error("Snapshot audit dataset is invalid: " + name);
  return envelope.data;
}

function buildPlayerArmyUsageAudit_(players, games) {
  const expectedByPlayer = {};
  const drawCounts = {};
  const errors = [];
  let drawGames = 0;
  let gameSides = 0;
  let firstArmyUsageMismatchLogged = false;

  (games || []).forEach(function(game) {
    const draw = game.winner === "Draw";
    if (draw) drawGames += 1;
    [[game.player1, game.player1Faction], [game.player2, game.player2Faction]].forEach(function(side) {
      const player = String(side[0] || "").trim();
      const faction = String(side[1] || "").trim();
      if (!player || !faction) {
        errors.push("Game " + game.id + " is missing a player side identity or faction.");
        return;
      }
      const key = normalizePublicSnapshotIdentity_(player);
      if (!expectedByPlayer[key]) {
        expectedByPlayer[key] = { player: player, games: 0, draws: 0, usage: {} };
      }
      const record = expectedByPlayer[key];
      record.games += 1;
      gameSides += 1;
      if (draw) {
        record.draws += 1;
        drawCounts[key] = (drawCounts[key] || 0) + 1;
      }
      const profile = getCanonicalArmyUsageProfile(faction);
      if (!profile) {
        errors.push("Game " + game.id + " has no canonical army-usage profile for " + faction + ".");
        return;
      }
      const usage = record.usage[profile.army] || {
        army: profile.army,
        parentFaction: profile.parentFaction,
        classification: profile.classification,
        games: 0,
        mostRecentGameDate: "",
        mostRecentGameId: 0
      };
      usage.games += 1;
      if (playerArmyUsageAuditIsMoreRecent_(game, usage)) {
        usage.mostRecentGameDate = String(game.date || "");
        usage.mostRecentGameId = Number(game.id) || 0;
      }
      record.usage[profile.army] = usage;
    });
  });

  const results = (players || []).map(function(player) {
    const key = normalizePublicSnapshotIdentity_(player.player);
    const expected = expectedByPlayer[key] || { player: player.player, games: 0, draws: 0, usage: {} };
    const usage = playerArmyUsageAuditFinalizeUsage_(expected.usage);
    const preferredArmy = playerArmyUsageAuditResolvePreferredArmy_(usage);
    const actualUsage = Array.isArray(player.armyUsage) ? player.armyUsage : [];
    const normalizedActualUsage = stablePublicSnapshotJson_(actualUsage);
    const normalizedReconstructedUsage = stablePublicSnapshotJson_(usage);
    const tied = usage.filter(function(entry) { return entry.tiedForHighestUsage; });
    const preferredUsage = usage.filter(function(entry) { return entry.army === preferredArmy; })[0] || null;
    if (Number(player.games) !== expected.games)
      errors.push(player.player + " game total does not match game sides.");
    if (Number(player.draws) !== expected.draws)
      errors.push(player.player + " draw total does not match draw game sides.");
    if (normalizedActualUsage !== normalizedReconstructedUsage) {
      errors.push(player.player + " armyUsage does not match snapshot game history.");
      if (!firstArmyUsageMismatchLogged) {
        firstArmyUsageMismatchLogged = true;
        Logger.log("PLAYER_ARMY_USAGE_AUDIT_FIRST_NORMALIZED_MISMATCH " + JSON.stringify({
          player: player.displayName || player.player,
          storedArmyUsage: normalizedActualUsage,
          reconstructedArmyUsage: normalizedReconstructedUsage
        }));
      }
    }
    if (String(player.preferredArmy || "") !== preferredArmy)
      errors.push(player.player + " preferredArmy does not match count and recency selection.");
    if (!expected.games && preferredArmy !== "No Army Selected")
      errors.push(player.player + " zero-game fallback is not No Army Selected.");
    return {
      player: player.displayName || player.player,
      preferredArmy: preferredArmy,
      preferredArmyGames: preferredUsage ? preferredUsage.games : 0,
      tied: tied.length > 1,
      tiedArmies: tied.length > 1 ? tied : [],
      mostRecentUsageWinner: tied.length > 1 && preferredUsage ? {
        army: preferredUsage.army,
        date: preferredUsage.mostRecentGameDate,
        gameId: preferredUsage.mostRecentGameId
      } : null,
      noArmySelected: preferredArmy === "No Army Selected"
    };
  }).sort(function(left, right) { return left.player.localeCompare(right.player); });

  const inventoryByArmy = {};
  results.filter(function(player) { return !player.noArmySelected; }).forEach(function(player) {
    if (!inventoryByArmy[player.preferredArmy]) inventoryByArmy[player.preferredArmy] = [];
    inventoryByArmy[player.preferredArmy].push(player.player);
  });
  const inventory = Object.keys(inventoryByArmy).sort().map(function(army) {
    return { army: army, count: inventoryByArmy[army].length, players: inventoryByArmy[army].sort() };
  });
  const noArmySelected = results.filter(function(player) { return player.noArmySelected; }).map(function(player) {
    return player.player;
  });
  const ties = results.filter(function(player) { return player.tied; }).map(function(player) {
    return {
      player: player.player,
      tiedArmies: player.tiedArmies,
      mostRecentUsageWinner: player.mostRecentUsageWinner,
      preferredArmy: player.preferredArmy,
      correct: player.mostRecentUsageWinner && player.mostRecentUsageWinner.army === player.preferredArmy
    };
  });

  if (results.length !== 45) errors.push("Expected 45 players but found " + results.length + ".");
  if ((games || []).length !== 78) errors.push("Expected 78 games but found " + (games || []).length + ".");
  if (gameSides !== (games || []).length * 2) errors.push("Every game must preserve two player sides.");
  if (Object.keys(drawCounts).reduce(function(total, key) { return total + drawCounts[key]; }, 0) !== drawGames * 2)
    errors.push("Draw game sides were not counted for both players.");
  return {
    players: results,
    ties: ties,
    noArmySelected: { count: noArmySelected.length, players: noArmySelected },
    inventory: inventory,
    errors: errors,
    totals: {
      players: results.length,
      games: (games || []).length,
      gameSides: gameSides,
      draws: drawGames,
      drawPlayerSides: Object.keys(drawCounts).reduce(function(total, key) { return total + drawCounts[key]; }, 0),
      sectorialUsageEntries: results.reduce(function(total, player) {
        return total + playerArmyUsageAuditUsageCount_(players, player.player, "sectorial");
      }, 0),
      vanillaUsageEntries: results.reduce(function(total, player) {
        return total + playerArmyUsageAuditUsageCount_(players, player.player, "vanilla");
      }, 0)
    }
  };
}

function playerArmyUsageAuditIsMoreRecent_(game, usage) {
  const date = String(game && game.date || "");
  const currentDate = String(usage && usage.mostRecentGameDate || "");
  if (date !== currentDate) return date > currentDate;
  return (Number(game && game.id) || 0) > (Number(usage && usage.mostRecentGameId) || 0);
}

function playerArmyUsageAuditFinalizeUsage_(usageByArmy) {
  const usage = Object.keys(usageByArmy || {}).map(function(army) {
    const value = usageByArmy[army];
    return {
      army: value.army,
      parentFaction: value.parentFaction,
      classification: value.classification,
      games: value.games,
      mostRecentGameDate: value.mostRecentGameDate,
      mostRecentGameId: value.mostRecentGameId,
      tiedForHighestUsage: false
    };
  });
  const highestGames = usage.reduce(function(highest, entry) {
    return Math.max(highest, Number(entry.games) || 0);
  }, 0);
  usage.forEach(function(entry) {
    entry.tiedForHighestUsage = highestGames > 0 && entry.games === highestGames;
  });
  return usage.sort(function(left, right) {
    return right.games - left.games ||
      String(right.mostRecentGameDate).localeCompare(String(left.mostRecentGameDate)) ||
      right.mostRecentGameId - left.mostRecentGameId ||
      left.army.localeCompare(right.army);
  });
}

function playerArmyUsageAuditResolvePreferredArmy_(usage) {
  const candidates = (usage || []).filter(function(entry) { return entry.games > 0; });
  if (!candidates.length) return "No Army Selected";
  candidates.sort(function(left, right) {
    return right.games - left.games ||
      String(right.mostRecentGameDate).localeCompare(String(left.mostRecentGameDate)) ||
      right.mostRecentGameId - left.mostRecentGameId;
  });
  const selected = candidates[0];
  if (candidates.length > 1 && selected.games === candidates[1].games &&
      selected.mostRecentGameDate === candidates[1].mostRecentGameDate &&
      selected.mostRecentGameId === candidates[1].mostRecentGameId)
    throw new Error("Player Army Usage audit found an unresolved same-game tie.");
  return selected.army;
}

function playerArmyUsageAuditUsageCount_(players, playerName, classification) {
  const player = (players || []).filter(function(value) {
    return String(value.displayName || value.player) === playerName;
  })[0];
  return player && Array.isArray(player.armyUsage) ? player.armyUsage.filter(function(entry) {
    return entry.classification === classification;
  }).length : 0;
}
