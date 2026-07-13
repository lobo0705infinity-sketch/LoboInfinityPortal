/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * PlayersApi.gs
 *
 * Player profile API endpoint.
 *******************************************************/

function getPlayers(e) {

  const params =
    getApiParameters(e);

  if (isCommunityPlayerRegistryRequest(params))
    return jsonOutput({
      success: true,
      eventId: "",
      event: null,
      divisions:
        getCommunityPlayerRegistryStandings()
    });

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

function isCommunityPlayerRegistryRequest(params) {

  return getCommunityPlayerRegistryString(params.eventId) === "" &&
    getCommunityPlayerRegistryString(params.gameType) === "";

}

function getCommunityPlayerRegistryStandings() {

  const standings =
    buildCommunityPlayerRegistryRows();

  return [
    {
      success: true,
      eventId: "",
      event: null,
      division: "main",
      divisionLabel: "Community Player Registry",
      standings: standings,
      summary: buildEventAnalyticsDivisionSummary(standings)
    }
  ];

}

function buildCommunityPlayerRegistryRows() {

  const records = {};
  const registry =
    buildPlayerRegistry();
  const leagueIdentityByEmail =
    buildCommunityLeagueIdentityByEmailMap();
  const eventsById =
    buildCommunityEventsById();

  Object.keys(registry)
    .forEach(function(key) {
      const player =
        registry[key];

      upsertCommunityPlayerRecord(
        records,
        {
          player: player.player,
          displayName:
            player.displayName ||
            player.player,
          division: player.division,
          active: player.active !== false,
          source: "Player Registry"
        }
      );
    });

  getCommunityPortalUsers(leagueIdentityByEmail)
    .forEach(function(user) {
      upsertCommunityPlayerRecord(
        records,
        user
      );
    });

  applyCommunityParticipantStatus(
    records,
    eventsById
  );

  applyCommunityGameStatistics(
    records
  );

  return Object.values(records)
    .map(finalizeCommunityPlayerRecord)
    .sort(sortCommunityPlayerRecords)
    .map(function(player, index) {
      player.rank = index + 1;
      return player;
    });

}

function getCommunityPortalUsers(leagueIdentityByEmail) {

  const sheet =
    ensureUsersSheet();
  const columns =
    getUsersColumns(sheet);
  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  return values.slice(1)
    .map(function(row) {
      const email =
        getCommunityPlayerRegistryString(row[columns.email])
          .toLowerCase();
      const displayName =
        getCommunityPlayerRegistryString(row[columns.displayName]) ||
        email;
      const identity =
        leagueIdentityByEmail[email] || {};
      const enabled =
        getCommunityBoolean(row[columns.enabled]);

      if (!enabled)
        return null;

      return {
        player:
          identity.player ||
          displayName ||
          email,
        displayName:
          displayName ||
          identity.displayName,
        division:
          identity.division ||
          "",
        active: true,
        portalUser: true,
        favoriteFaction:
          canonicalizeArmyName(row[columns.favoriteFaction]) ||
          "",
        createdAt:
          getCommunityPlayerRegistryString(row[columns.created]),
        lastSeen:
          getCommunityPlayerRegistryString(row[columns.lastSeen]),
        source: "Portal User"
      };
    })
    .filter(function(user) {
      return user !== null &&
        getCommunityPlayerRegistryString(user.player) !== "";
    });

}

function buildCommunityLeagueIdentityByEmailMap() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.PLAYERS);

  if (!sheet)
    return {};

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return {};

  const headers =
    values[0]
      .map(getCommunityPlayerRegistryString);

  const playerCol =
    headers.indexOf("Player");
  const emailCol =
    headers.indexOf("Google Email");
  const displayNameCol =
    headers.indexOf("Display Name");
  const divisionCol =
    headers.indexOf("Division");
  const activeCol =
    headers.indexOf("Active");

  if (
    playerCol === -1 ||
    emailCol === -1
  )
    return {};

  const map = {};

  values.slice(1)
    .forEach(function(row) {
      const email =
        getCommunityPlayerRegistryString(row[emailCol])
          .toLowerCase();

      if (!email)
        return;

      if (
        activeCol !== -1 &&
        getCommunityBoolean(row[activeCol]) === false
      )
        return;

      map[email] = {
        player:
          getCommunityPlayerRegistryString(row[playerCol]),
        displayName:
          displayNameCol === -1
            ? getCommunityPlayerRegistryString(row[playerCol])
            : getCommunityPlayerRegistryString(row[displayNameCol]) ||
              getCommunityPlayerRegistryString(row[playerCol]),
        division:
          divisionCol === -1
            ? ""
            : getCommunityPlayerRegistryString(row[divisionCol])
      };
    });

  return map;

}

function buildCommunityEventsById() {

  const map = {};

  getEventEngineSnapshot()
    .events
    .forEach(function(event) {
      map[event.id] = event;
    });

  return map;

}

function applyCommunityParticipantStatus(records, eventsById) {

  const rows =
    getEventEngineRowsNoEnsure(
      CONFIG.SHEETS.EVENT_PARTICIPANTS
    );

  rows.forEach(function(row) {
    const status =
      getCommunityPlayerRegistryString(row["Status"]);

    if (isCommunityInactiveStatus(status))
      return;

    const player =
      getCommunityPlayerRegistryString(row["Player"]);

    if (!player)
      return;

    const record =
      findCommunityPlayerRecord(
        records,
        player,
        getCommunityPlayerRegistryString(row["Display Name"])
      );

    if (!record)
      return;

    const event =
      eventsById[row["Event ID"]] || {};
    const eventType =
      getCommunityPlayerRegistryString(event.type)
        .toLowerCase();

    if (eventType === "league") {
      record.league = true;
      if (!record.division && row["Notes"])
        record.division =
          getCommunityPlayerRegistryString(row["Notes"]);
    }

    if (eventType.indexOf("tournament") !== -1)
      record.tournament = true;

  });

}

function findCommunityPlayerRecord(records, player, displayName) {

  const playerKey =
    getCommunityPlayerKey(player);
  const displayKey =
    getCommunityPlayerKey(displayName);

  if (playerKey && records[playerKey])
    return records[playerKey];

  if (displayKey && records[displayKey])
    return records[displayKey];

  return null;

}

function applyCommunityGameStatistics(records) {

  const rows =
    getLeagueDataForEvent(
      "all",
      "all"
    );

  rows.forEach(function(row) {
    const player =
      getCommunityPlayerRegistryString(row[CONFIG.ENGINE.PLAYER]);

    if (!player)
      return;

    const record =
      records[getCommunityPlayerKey(player)];

    if (!record)
      return;

    record.games += 1;
    record.tp += Number(row[CONFIG.ENGINE.TP]) || 0;
    record.op += Number(row[CONFIG.ENGINE.OP]) || 0;
    record.vp += Number(row[CONFIG.ENGINE.VP]) || 0;

    const faction =
      canonicalizeArmyName(row[CONFIG.ENGINE.FACTION]);

    if (faction)
      record.factionCounts[faction] =
        (record.factionCounts[faction] || 0) + 1;

    const gameType =
      typeof getGameEngineGameType === "function"
        ? getGameEngineGameType(row)
        : normalizeGameType(
            row[CONFIG.ENGINE.GAME_TYPE]
          );

    if (gameType === "league")
      record.league = true;
    else if (gameType === "tournament")
      record.tournament = true;
    else if (gameType === "casual")
      record.casual = true;

    const result =
      getCommunityPlayerRegistryString(row[CONFIG.ENGINE.RESULT]);

    if (result === "W")
      record.wins += 1;
    else if (result === "L")
      record.losses += 1;

    record.results.push({
      result: result,
      dateValue:
        getCommunityDateValue(row[CONFIG.ENGINE.DATE])
    });
  });

}

function upsertCommunityPlayerRecord(records, input) {

  const key =
    getCommunityPlayerKey(input.player);

  if (!records[key])
    records[key] = {
      rank: 0,
      player: getCommunityPlayerRegistryString(input.player),
      displayName:
        getCommunityPlayerRegistryString(input.displayName) ||
        getCommunityPlayerRegistryString(input.player),
      division:
        getCommunityPlayerRegistryString(input.division),
      active: input.active !== false,
      portalUser: !!input.portalUser,
      league: false,
      tournament: false,
      casual: false,
      favoriteFaction: "",
      createdAt: "",
      lastSeen: "",
      source: input.source || "",
      games: 0,
      wins: 0,
      losses: 0,
      tp: 0,
      op: 0,
      vp: 0,
      factionCounts: {},
      results: []
    };

  const record =
    records[key];

  if (input.portalUser)
    record.displayName =
      getCommunityPlayerRegistryString(input.displayName) ||
      record.displayName ||
      record.player;
  else
    record.displayName =
      record.displayName ||
      getCommunityPlayerRegistryString(input.displayName) ||
      record.player;
  record.division =
    record.division ||
    getCommunityPlayerRegistryString(input.division);
  record.portalUser =
    record.portalUser || !!input.portalUser;
  record.favoriteFaction =
    record.favoriteFaction ||
    canonicalizeArmyName(input.favoriteFaction) ||
    "";
  record.createdAt =
    record.createdAt ||
    getCommunityPlayerRegistryString(input.createdAt);
  record.lastSeen =
    record.lastSeen ||
    getCommunityPlayerRegistryString(input.lastSeen);
  record.source =
    record.source ||
    input.source ||
    "";

  return record;

}

function finalizeCommunityPlayerRecord(record) {

  const favoriteArmy =
    getCommunityMostPlayedArmy(record.factionCounts) ||
    record.favoriteFaction ||
    "";
  const currentWinStreak =
    getCommunityCurrentWinStreak(record.results);
  const statusBadges =
    getCommunityStatusBadges(record);
  const gameTypes = [];

  if (record.league)
    gameTypes.push("league");
  if (record.tournament)
    gameTypes.push("tournament");
  if (record.casual)
    gameTypes.push("casual");

  return {
    eventId: "",
    rank: record.rank,
    player: record.player,
    displayName:
      record.displayName ||
      record.player,
    division:
      getCommunityDivisionLabel(record.division),
    games: record.games,
    wins: record.wins,
    losses: record.losses,
    tp: record.tp,
    op: record.op,
    vp: record.vp,
    faction: favoriteArmy,
    favoriteArmy: favoriteArmy,
    currentWinStreak: currentWinStreak,
    statusBadges: statusBadges,
    gameTypes: gameTypes,
    lastActive:
      getCommunityMostRecentDate(record.results) ||
      record.lastSeen ||
      record.createdAt,
    communityStatus:
      record.games > 0
        ? "Active"
        : "New"
  };

}

function getCommunityDivisionLabel(value) {

  const original =
    getCommunityPlayerRegistryString(value);
  const compact =
    original
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  if (
    compact === "main" ||
    compact === "mainman"
  )
    return "Main Man";

  if (
    compact === "pga" ||
    compact === "provinggroundsa" ||
    compact === "provinggrounda"
  )
    return "Proving Grounds A";

  if (
    compact === "pgb" ||
    compact === "provinggroundsb" ||
    compact === "provinggroundb"
  )
    return "Proving Grounds B";

  return original;

}

function getCommunityStatusBadges(record) {

  const badges = [];

  if (record.league)
    badges.push("League");
  if (record.tournament)
    badges.push("Tournament");
  if (record.casual)
    badges.push("Casual");

  if (record.games === 0)
    badges.push("New Player");

  if (badges.length === 0)
    badges.push("Registered");

  return badges;

}

function sortCommunityPlayerRecords(left, right) {

  const leftDate =
    getCommunityTimestamp(left.lastActive);
  const rightDate =
    getCommunityTimestamp(right.lastActive);

  if (rightDate !== leftDate)
    return rightDate - leftDate;

  if (right.games !== left.games)
    return right.games - left.games;

  return left.displayName.localeCompare(
    right.displayName
  );

}

function getCommunityMostPlayedArmy(counts) {

  let best = "";
  let bestCount = 0;

  Object.keys(counts)
    .sort()
    .forEach(function(army) {
      if (counts[army] > bestCount) {
        best = army;
        bestCount = counts[army];
      }
    });

  return best;

}

function getCommunityCurrentWinStreak(results) {

  const ordered =
    results
      .slice()
      .sort(function(left, right) {
        return right.dateValue - left.dateValue;
      });

  let streak = 0;

  for (
    let index = 0;
    index < ordered.length;
    index++
  ) {
    if (ordered[index].result !== "W")
      break;
    streak++;
  }

  return streak;

}

function getCommunityMostRecentDate(results) {

  const best =
    results.reduce(function(current, result) {
      return result.dateValue > current
        ? result.dateValue
        : current;
    }, 0);

  return best
    ? new Date(best).toISOString()
    : "";

}

function getCommunityDateValue(value) {

  if (value instanceof Date)
    return value.getTime();

  const timestamp =
    Date.parse(
      getCommunityPlayerRegistryString(value)
    );

  return isNaN(timestamp)
    ? 0
    : timestamp;

}

function getCommunityTimestamp(value) {

  const timestamp =
    Date.parse(
      getCommunityPlayerRegistryString(value)
    );

  return isNaN(timestamp)
    ? 0
    : timestamp;

}

function isCommunityInactiveStatus(status) {

  const normalized =
    getCommunityPlayerRegistryString(status)
      .toLowerCase();

  return normalized === "deleted" ||
    normalized === "removed" ||
    normalized === "withdrawn" ||
    normalized === "disabled";

}

function getCommunityPlayerKey(player) {

  return getCommunityPlayerRegistryString(player)
    .toLowerCase();

}

function getCommunityPlayerRegistryString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}

function getCommunityBoolean(value) {

  if (value === true)
    return true;

  const normalized =
    getCommunityPlayerRegistryString(value)
      .toLowerCase();

  return normalized === "true" ||
    normalized === "yes" ||
    normalized === "enabled" ||
    normalized === "active" ||
    normalized === "1";

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

  const missionProfile =
    getPlayerMissionProfile(
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
        missionProfile.favoriteMission,

      bestMission:
        missionProfile.bestMission,

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
        getRegisteredEventsForPlayer(registeredPlayer),

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
        "/match-finder?opponent=" + encodeURIComponent(registeredPlayer.player),

      careerSummary:
        buildPlayerCareerSummary(
          registeredPlayer.player
        )

    }

  });

}

function buildPlayerCareerSummary(playerName) {

  const target =
    getCommunityPlayerKey(playerName);
  const rows =
    getLeagueDataForEvent(
      "all",
      "all"
    )
      .filter(function(row) {
        return getCommunityPlayerKey(row[CONFIG.ENGINE.PLAYER]) === target;
      })
      .map(buildPlayerCareerGame)
      .filter(function(game) {
        return game.player !== "";
      });

  const sorted =
    rows
      .slice()
      .sort(sortPlayerCareerGamesNewestFirst);

  const overall =
    buildPlayerCareerRecord(rows);
  const records =
    {
      overall: overall,
      league:
        buildPlayerCareerRecordByType(
          rows,
          "league"
        ),
      tournament:
        buildPlayerCareerRecordByType(
          rows,
          "tournament"
        ),
      casual:
        buildPlayerCareerRecordByType(
          rows,
          "casual"
        )
    };
  const armyMetrics =
    buildPlayerCareerGroupMetrics(
      rows,
      "army",
      1
    );
  const missionMetrics =
    buildPlayerCareerGroupMetrics(
      rows,
      "mission",
      3
    );

  return {
    totalGames: overall.games,
    wins: overall.wins,
    losses: overall.losses,
    winPercentage: overall.winPercentage,
    currentWinStreak:
      getPlayerCareerCurrentWinStreak(sorted),
    longestWinStreak:
      getPlayerCareerLongestWinStreak(rows),
    gamesThisMonth:
      getPlayerCareerGamesThisMonth(rows),
    records: records,
    armies: armyMetrics,
    missions: missionMetrics,
    quickStats: {
      highestVpGame:
        getPlayerCareerHighestValue(
          rows,
          "vp"
        ),
      biggestVictory:
        getPlayerCareerHighestValue(
          rows.filter(function(game) {
            return game.result === "W";
          }),
          "vp"
        ),
      mostPlayedArmy:
        armyMetrics.favorite.label,
      mostPlayedArmyParentFaction:
        armyMetrics.favorite.parentFaction || "",
      mostPlayedMission:
        missionMetrics.favorite.label
    }
  };

}

function buildPlayerCareerGame(row) {

  const gameType =
    typeof getGameEngineGameType === "function"
      ? getGameEngineGameType(row)
      : normalizeGameType(row[CONFIG.ENGINE.GAME_TYPE]);

  const dateValue =
    getCommunityDateValue(row[CONFIG.ENGINE.DATE]);

  return {
    player:
      getCommunityPlayerRegistryString(row[CONFIG.ENGINE.PLAYER]),
    result:
      getCommunityPlayerRegistryString(row[CONFIG.ENGINE.RESULT]),
    gameType: gameType || "league",
    army:
      canonicalizeArmyName(row[CONFIG.ENGINE.FACTION]),
    parentFaction:
      getCanonicalArmyParentFaction(row[CONFIG.ENGINE.FACTION]),
    mission:
      getCommunityPlayerRegistryString(row[CONFIG.ENGINE.MISSION]),
    date:
      getCommunityPlayerRegistryString(row[CONFIG.ENGINE.DATE]),
    dateValue: dateValue,
    tp:
      Number(row[CONFIG.ENGINE.TP]) || 0,
    op:
      Number(row[CONFIG.ENGINE.OP]) || 0,
    vp:
      Number(row[CONFIG.ENGINE.VP]) || 0
  };

}

function buildPlayerCareerRecordByType(rows, gameType) {

  return buildPlayerCareerRecord(
    rows.filter(function(game) {
      return game.gameType === gameType;
    })
  );

}

function buildPlayerCareerRecord(rows) {

  const wins =
    rows.filter(function(game) {
      return game.result === "W";
    }).length;
  const losses =
    rows.filter(function(game) {
      return game.result === "L";
    }).length;
  const games =
    wins + losses;

  return {
    games: games,
    wins: wins,
    losses: losses,
    winPercentage:
      games === 0
        ? 0
        : Math.round(
            (wins / games) * 100
          )
  };

}

function buildPlayerCareerGroupMetrics(rows, field, bestMinimumGames) {

  const groups = {};

  rows.forEach(function(game) {
    const label =
      field === "army"
        ? game.army
        : game.mission;

    if (!label)
      return;

    if (!groups[label])
      groups[label] = {
        label: label,
        rows: []
      };

    groups[label].rows.push(game);
  });

  const metrics =
    Object.keys(groups)
      .map(function(label) {
        const metric =
          buildPlayerCareerMetric(
          label,
          groups[label].rows
        );

        if (field === "army")
          metric.parentFaction =
            getCanonicalArmyParentFaction(label);

        return metric;
      });

  const favorite =
    metrics
      .slice()
      .sort(sortPlayerCareerFavoriteMetric)[0] ||
    buildEmptyPlayerCareerMetric();
  const best =
    metrics
      .filter(function(metric) {
        return metric.games >= bestMinimumGames;
      })
      .sort(sortPlayerCareerBestMetric)[0] ||
    buildEmptyPlayerCareerMetric(
      bestMinimumGames > 1
    );
  const mostRecent =
    metrics
      .slice()
      .sort(sortPlayerCareerRecentMetric)[0] ||
    buildEmptyPlayerCareerMetric();

  return {
    favorite: favorite,
    best: best,
    mostRecent: mostRecent
  };

}

function buildPlayerCareerMetric(label, rows) {

  const record =
    buildPlayerCareerRecord(rows);
  const recent =
    rows
      .slice()
      .sort(sortPlayerCareerGamesNewestFirst)[0] ||
    {};

  return {
    label: label,
    games: record.games,
    wins: record.wins,
    losses: record.losses,
    winPercentage: record.winPercentage,
    lastPlayed:
      recent.date || ""
  };

}

function buildEmptyPlayerCareerMetric(insufficientGames) {

  return {
    label: "",
    games: 0,
    wins: 0,
    losses: 0,
    winPercentage: 0,
    lastPlayed: "",
    insufficientGames: insufficientGames === true
  };

}

function sortPlayerCareerFavoriteMetric(a, b) {

  if (b.games !== a.games)
    return b.games - a.games;

  if (b.wins !== a.wins)
    return b.wins - a.wins;

  return comparePlayerCareerDates(
    b.lastPlayed,
    a.lastPlayed
  );

}

function sortPlayerCareerBestMetric(a, b) {

  if (b.winPercentage !== a.winPercentage)
    return b.winPercentage - a.winPercentage;

  if (b.wins !== a.wins)
    return b.wins - a.wins;

  if (b.games !== a.games)
    return b.games - a.games;

  return comparePlayerCareerDates(
    b.lastPlayed,
    a.lastPlayed
  );

}

function sortPlayerCareerRecentMetric(a, b) {

  return comparePlayerCareerDates(
    b.lastPlayed,
    a.lastPlayed
  );

}

function sortPlayerCareerGamesNewestFirst(a, b) {

  if (b.dateValue !== a.dateValue)
    return b.dateValue - a.dateValue;

  return 0;

}

function comparePlayerCareerDates(a, b) {

  return getCommunityDateValue(a) - getCommunityDateValue(b);

}

function getPlayerCareerCurrentWinStreak(rows) {

  let streak = 0;

  for (
    let index = 0;
    index < rows.length;
    index++
  ) {
    if (rows[index].result !== "W")
      break;

    streak++;
  }

  return streak;

}

function getPlayerCareerLongestWinStreak(rows) {

  const sorted =
    rows
      .slice()
      .sort(function(a, b) {
        return a.dateValue - b.dateValue;
      });
  let current = 0;
  let longest = 0;

  sorted.forEach(function(game) {
    if (game.result === "W") {
      current++;
      longest =
        Math.max(
          longest,
          current
        );
      return;
    }

    current = 0;
  });

  return longest;

}

function getPlayerCareerGamesThisMonth(rows) {

  const now =
    new Date();
  const year =
    now.getFullYear();
  const month =
    now.getMonth();

  return rows.filter(function(game) {
    if (!game.dateValue)
      return false;

    const date =
      new Date(game.dateValue);

    return date.getFullYear() === year &&
      date.getMonth() === month;
  }).length;

}

function getPlayerCareerHighestValue(rows, field) {

  return rows.reduce(function(highest, game) {
    return Math.max(
      highest,
      Number(game[field]) || 0
    );
  }, 0);

}

function getRegisteredEventsForPlayer(player) {

  const identities =
    getPlayerProfileRegistrationIdentities(player);

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
      return playerProfileRegistrationMatches(row, identities);
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

function getPlayerProfileRegistrationIdentities(player) {

  const identities = {};

  if (typeof player === "string") {
    addPlayerProfileRegistrationIdentity(identities, player);
    return identities;
  }

  if (!player)
    return identities;

  addPlayerProfileRegistrationIdentity(identities, player.player);
  addPlayerProfileRegistrationIdentity(identities, player.displayName);

  return identities;

}

function addPlayerProfileRegistrationIdentity(identities, value) {

  const key =
    getEventEngineString(value).toLowerCase();

  if (key !== "")
    identities[key] = true;

}

function playerProfileRegistrationMatches(row, identities) {

  const player =
    getEventEngineString(row["Player"]).toLowerCase();
  const displayName =
    getEventEngineString(row["Display Name"]).toLowerCase();

  return !!(
    identities[player] ||
    identities[displayName]
  );

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
