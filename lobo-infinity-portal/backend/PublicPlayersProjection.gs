/*******************************************************
 * Prepared public community Players projection.
 *******************************************************/

const PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY =
  "PUBLIC_PLAYERS_PROJECTION_FILE_ID";
const PUBLIC_PLAYERS_PROJECTION_FILE_NAME =
  "Lobo Infinity Portal - Public Players Projection.json";
const PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY =
  "PUBLIC_PLAYERS_PROJECTION_DIRTY";

function refreshPublicPlayersProjection(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    const projection = publishPublicPlayersProjection_();
    return jsonOutput({
      success: true,
      generatedAt: projection.generatedAt,
      playerCount: countPublicPlayersProjectionRows_(projection),
      fileId: getPublicPlayersProjectionFileId_()
    });
  });
}

function markPublicPlayersProjectionDirty_() {
  try {
    markPublicProjectionRequired_(PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY, ["players"]);
  }
  catch (error) {
    console.error("PUBLIC_PLAYERS_DIRTY_MARK_FAILED " + String(error));
  }
}

function publishDirtyPublicPlayersProjectionBestEffort_() {
  const obligation = getNextPublicProjectionObligation_(PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY);
  if (!obligation)
    return { refreshed: false, success: true };

  try {
    beginPublicProjectionAttempt_(PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY, obligation);
    const projection = publishPublicPlayersProjection_(obligation.requiredGeneration);
    const acknowledgement = acknowledgePublicProjection_(PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY, obligation, projection);
    return {
      acknowledgement: acknowledgement,
      refreshed: true,
      generatedAt: projection.generatedAt,
      success: true
    };
  }
  catch (error) {
    failPublicProjectionAttempt_(PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY, obligation, "publication", error);
    console.error(
      "PUBLIC_PLAYERS_PROJECTION_REFRESH_FAILED " +
      JSON.stringify({
        message: error && error.message ? String(error.message) : String(error)
      })
    );
    return {
      error: error && error.message ? String(error.message) : String(error),
      refreshed: false,
      success: false
    };
  }
}

function publishPublicPlayersProjection_(generation) {
  let projection = buildPublicPlayersProjection_();
  validatePublicPlayersProjection_(projection);
  const file = getOrCreatePublicPlayersProjectionFile_();
  projection = writeAndValidatePublicProjectionArtifact_(file, projection, generation);
  file.setDescription(
    "Prepared public community Players projection. Canonical data remains in the Lobo Apps Script project."
  );
  return projection;
}

function buildPublicPlayersProjection_() {
  const response = JSON.parse(getPlayers({ parameter: {} }).getContent());
  if (!response.success || !Array.isArray(response.divisions))
    throw new Error("Public Players projection could not be built.");

  response.divisions.forEach(function(division) {
    (division.standings || []).forEach(stripUnusedPublicPlayerFields_);
    if (division.summary && division.summary.leader)
      stripUnusedPublicPlayerFields_(division.summary.leader);
  });

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    eventId: "",
    divisions: response.divisions,
    comparison: buildPublicPlayerComparisonIndex_(response.divisions)
  };
}

function buildPublicPlayerComparisonIndex_(divisions) {
  const context = buildLeagueStandingsContext();
  const games = getLeagueData();
  const gamesByPlayer = {};
  const headToHeadByPair = {};

  games.forEach(function(game) {
    const player = String(game[CONFIG.ENGINE.PLAYER] || "").trim();
    const opponent = String(game[CONFIG.ENGINE.OPPONENT] || "").trim();
    if (!player || !opponent)
      return;

    if (!gamesByPlayer[player])
      gamesByPlayer[player] = [];
    gamesByPlayer[player].push(game);

    const names = [player, opponent].sort();
    const key = names[0] + "\n" + names[1];
    if (!headToHeadByPair[key])
      headToHeadByPair[key] = { players: names, rows: 0, winsByPlayer: {}, drawRows: 0 };

    const record = headToHeadByPair[key];
    record.rows += 1;
    if (game[CONFIG.ENGINE.RESULT] === "W")
      record.winsByPlayer[player] = (record.winsByPlayer[player] || 0) + 1;
    else if (game[CONFIG.ENGINE.RESULT] === "D")
      record.drawRows += 1;
  });

  const projectedPlayers = [];
  (divisions || []).forEach(function(division) {
    (division.standings || []).forEach(function(publicPlayer) {
      const registeredPlayer = findRegisteredPlayer(context.playerRegistry, publicPlayer.player);
      if (!registeredPlayer)
        return;

      const standing = getPlayerStanding(context.playerRegistry, registeredPlayer);
      const playerGames = gamesByPlayer[registeredPlayer.player] || [];
      const missionProfile = buildMissionProfileSummary(
        playerGames,
        function(game) { return game[COL_MISSION]; },
        function(game) { return game[COL_RESULT] === "W"; },
        function(game) { return game[COL_DATE]; }
      );
      const favoriteFaction = MOSTCOMMON(playerGames.map(function(game) {
        return canonicalizeArmyName(game[COL_FACTION]);
      }));

      projectedPlayers.push({
        name: registeredPlayer.player,
        displayName: registeredPlayer.displayName || registeredPlayer.player,
        division: registeredPlayer.division,
        rank: standing.rank,
        games: standing.games,
        wins: standing.wins,
        losses: standing.losses,
        draws: standing.draws || 0,
        tp: standing.tp,
        op: standing.op,
        vp: standing.vp,
        favoriteFaction: favoriteFaction.count === 0
          ? ""
          : favoriteFaction.value + " (" + favoriteFaction.count + " games)",
        favoriteMission: missionProfile.favoriteMission,
        bestMission: missionProfile.bestMission,
        bestFaction: buildBestFactionSummaryFromGames_(playerGames)
      });
    });
  });

  return {
    players: projectedPlayers,
    headToHead: Object.keys(headToHeadByPair).map(function(key) {
      const record = headToHeadByPair[key];
      return {
        left: record.players[0],
        right: record.players[1],
        games: record.rows / 2,
        leftWins: record.winsByPlayer[record.players[0]] || 0,
        rightWins: record.winsByPlayer[record.players[1]] || 0,
        draws: record.drawRows / 2
      };
    })
  };
}

function stripUnusedPublicPlayerFields_(player) {
  delete player.gameDerivedFavoriteFaction;
  delete player.armyListDerivedFavoriteFaction;
}

function validatePublicPlayersProjection_(projection) {
  if (!projection || projection.eventId !== "" || !Array.isArray(projection.divisions))
    throw new Error("Public Players projection is invalid.");

  projection.divisions.forEach(function(division) {
    if (!Array.isArray(division.standings) || !division.summary)
      throw new Error("Public Players division projection is invalid.");
    division.standings.forEach(function(player) {
      if (!player.player || !player.displayName || !Number.isFinite(Number(player.rank)))
        throw new Error("Public Players identity/rank projection is invalid.");
      ["games", "wins", "losses", "tp", "op", "vp"].forEach(function(field) {
        if (!Number.isFinite(Number(player[field])))
          throw new Error("Public Players statistics projection is invalid.");
      });
    });
  });

  if (!projection.comparison || !Array.isArray(projection.comparison.players) ||
      !Array.isArray(projection.comparison.headToHead))
    throw new Error("Public Players comparison projection is invalid.");
}

function countPublicPlayersProjectionRows_(projection) {
  return projection.divisions.reduce(function(total, division) {
    return total + division.standings.length;
  }, 0);
}

function getOrCreatePublicPlayersProjectionFile_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY);
  if (existingId) {
    try {
      return DriveApp.getFileById(existingId);
    }
    catch (error) {
      properties.deleteProperty(PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY);
    }
  }

  const file = DriveApp.createFile(
    PUBLIC_PLAYERS_PROJECTION_FILE_NAME,
    "{}",
    MimeType.PLAIN_TEXT
  );
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  properties.setProperty(PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY, file.getId());
  return file;
}

function getPublicPlayersProjectionFileId_() {
  return PropertiesService.getScriptProperties().getProperty(
    PUBLIC_PLAYERS_PROJECTION_FILE_PROPERTY
  ) || "";
}
