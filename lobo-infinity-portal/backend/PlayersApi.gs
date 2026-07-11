/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * PlayersApi.gs
 *
 * Player profile API endpoint.
 *******************************************************/

function getPlayers(e) {

  const context =
    buildEventAnalyticsContext(e);

  return jsonOutput({
    success: true,
    eventId: context.eventId,
    event: context.event,
    divisions:
      getEventAnalyticsPlayers(context)
  });

}

function getPlayer(e) {

  const requestedName =
    getPlayerRequestName(e);

  if (!requestedName)
    return jsonOutput({
      success: false,
      error: "Missing player name."
    });

  const eventProfile =
    getEventAnalyticsPlayerProfile(
      e,
      requestedName
    );

  if (eventProfile)
    return eventProfile;

  const registry =
    buildPlayerRegistry();

  const registeredPlayer =
    findRegisteredPlayer(
      registry,
      requestedName
    );

  if (!registeredPlayer)
    return jsonOutput({
      success: false,
      error: "Player not found."
    });

  updateRegistryStatistics(registry);

  const standing =
    getPlayerStanding(
      registry,
      registeredPlayer
    );

  const firstTurnGames =
    FIRSTTURNGAMES(
      registeredPlayer.player
    );

  const secondTurnGames =
    SECONDTURNGAMES(
      registeredPlayer.player
    );

  const armyLists =
    getPlayerArmyLists(
      registeredPlayer.player
    );

  const availability =
    getSeasonAvailabilityForPlayer(
      getSeasonAvailabilityMap(),
      registeredPlayer.player
    );

  return jsonOutput({

    success: true,

    player: {

      name: registeredPlayer.player,

      displayName:
        registeredPlayer.displayName ||
        registeredPlayer.player,

      division: registeredPlayer.division,

      rank: standing.rank,

      games: standing.games,

      wins: standing.wins,

      losses: standing.losses,

      tp: standing.tp,

      op: standing.op,

      vp: standing.vp,

      favoriteFaction:
        FAVORITEFACTION(
          registeredPlayer.player
        ),

      favoriteMission:
        FAVORITEMISSION(
          registeredPlayer.player
        ),

      firstTurnGames:
        firstTurnGames.length,

      secondTurnGames:
        secondTurnGames.length,

      firstTurnWinRate:
        getPlayerWinRate(
          firstTurnGames
        ),

      secondTurnWinRate:
        getPlayerWinRate(
          secondTurnGames
        ),

      bestFaction:
        BESTFACTION(
          registeredPlayer.player
        ),

      rival:
        RIVAL(
          registeredPlayer.player
        ),

      nemesis:
        NEMESIS(
          registeredPlayer.player
        ),

      armyLists:
        armyLists.lists,

      armyListSummary:
        armyLists.summary,

      registeredEvents:
        getRegisteredEventsForPlayer(registeredPlayer.player),

      availability:
        availability,

      profilePicture:
        "",

      discordHandle:
        availability.discordHandle,

      homeStore:
        availability.homeStore,

      city:
        availability.city,

      preferredLocations:
        availability.preferredLocations,

      scheduleLink:
        "/match-finder?opponent=" + encodeURIComponent(registeredPlayer.player)

    }

  });

}

function getRegisteredEventsForPlayer(player) {

  const target =
    getEventEngineString(player).toLowerCase();

  const eventsById = {};

  getEventEngineSnapshot()
    .events
    .forEach(function(event) {
      eventsById[event.id] = event;
    });

  return getEventEngineRows(
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_PARTICIPANTS,
      EVENT_ENGINE_PARTICIPANT_HEADERS
    )
  )
    .filter(function(row) {
      return getEventEngineString(row["Player"]).toLowerCase() === target;
    })
    .map(function(row) {
      const event =
        eventsById[row["Event ID"]] || {};

      return {
        eventId: row["Event ID"],
        eventName: event.name || row["Event ID"],
        eventType: event.type || "",
        status: row["Status"] || "Registered",
        team: row["Team"],
        preferredTeam: row["Preferred Team"] || row["Team"],
        registeredAt: row["Registered At"],
        updatedAt: row["Updated At"] || row["Registered At"]
      };
    });

}

function getPlayerRequestName(e) {

  if (
    !e ||
    !e.parameter ||
    !e.parameter.name
  )
    return "";

  return String(e.parameter.name)
    .trim();

}

function findRegisteredPlayer(
  registry,
  requestedName
) {

  if (registry[requestedName])
    return registry[requestedName];

  const normalizedName =
    requestedName.toLowerCase();

  for (const playerName in registry) {

    if (
      playerName.toLowerCase() ===
      normalizedName
    )
      return registry[playerName];

  }

  return null;

}

function getPlayerStanding(
  registry,
  player
) {

  const rows =
    buildDivisionTable(
      registry,
      player.division
    );

  for (
    let rowIndex = 1;
    rowIndex < rows.length;
    rowIndex++
  ) {

    const row =
      rows[rowIndex];

    if (
      row[CONFIG.STANDINGS.PLAYER] !==
      player.player
    )
      continue;

    return {
      rank:
        getPlayerNumber(
          row[CONFIG.STANDINGS.RANK]
        ),
      games:
        getPlayerNumber(
          row[CONFIG.STANDINGS.GAMES]
        ),
      wins:
        getPlayerNumber(
          row[CONFIG.STANDINGS.WINS]
        ),
      losses:
        getPlayerNumber(
          row[CONFIG.STANDINGS.LOSSES]
        ),
      tp:
        getPlayerNumber(
          row[CONFIG.STANDINGS.TP]
        ),
      op:
        getPlayerNumber(
          row[CONFIG.STANDINGS.OP]
        ),
      vp:
        getPlayerNumber(
          row[CONFIG.STANDINGS.VP]
        )
    };

  }

  return {
    rank: 0,
    games: player.games,
    wins: player.wins,
    losses: player.losses,
    tp: player.tp,
    op: player.op,
    vp: player.vp
  };

}

function getPlayerWinRate(games) {

  if (games.length === 0)
    return 0;

  return Math.round(
    RECORD(games).pct * 100
  );

}

function getPlayerNumber(value) {

  return Number(value) || 0;

}
