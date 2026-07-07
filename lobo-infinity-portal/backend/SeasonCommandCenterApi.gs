/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * SeasonCommandCenterApi.gs
 *
 * Player season command center derived from identity,
 * standings, game analytics, settings, and availability.
 *******************************************************/

const SEASON_COMMAND_TARGET_GAMES = 7;
const SEASON_AVAILABILITY_HEADERS = [
  "Player",
  "Status",
  "Preferred Days",
  "Preferred Times",
  "Notes",
  "Updated At",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Home Store",
  "City",
  "Max Travel Distance",
  "Preferred Locations",
  "Discord Handle"
];

function getSeasonCommandCenter(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const context =
    buildSeasonCommandContext(
      auth.user.leaguePlayer
    );

  if (!context.player)
    return jsonOutput({
      success: false,
      error: "League player not found."
    });

  return jsonOutput({
    success: true,
    seasonCommand: buildSeasonCommandPayload(context)
  });

}

function updateSeasonAvailability(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const params =
    getApiParameters(e);

  const record = {
    player: auth.user.leaguePlayer,
    status:
      getSeasonCommandString(params.status) ||
      "Available",
    preferredDays:
      getSeasonCommandString(params.preferredDays),
    preferredTimes:
      getSeasonCommandString(params.preferredTimes),
    notes:
      getSeasonCommandString(params.notes),
    updatedAt:
      getSeasonCommandTimestamp(),
    monday:
      getSeasonCommandString(params.monday),
    tuesday:
      getSeasonCommandString(params.tuesday),
    wednesday:
      getSeasonCommandString(params.wednesday),
    thursday:
      getSeasonCommandString(params.thursday),
    friday:
      getSeasonCommandString(params.friday),
    saturday:
      getSeasonCommandString(params.saturday),
    sunday:
      getSeasonCommandString(params.sunday),
    homeStore:
      getSeasonCommandString(params.homeStore),
    city:
      getSeasonCommandString(params.city),
    maxTravelDistance:
      getSeasonCommandString(params.maxTravelDistance),
    preferredLocations:
      getSeasonCommandString(params.preferredLocations),
    discordHandle:
      getSeasonCommandString(params.discordHandle)
  };

  saveSeasonAvailabilityRecord(record);

  invalidatePortalCacheGroup("seasonCommand");

  return getSeasonCommandCenter(e);

}

function addSeasonCommandNotifications(notifications, user) {

  if (
    !user ||
    !user.leaguePlayer
  )
    return;

  const context =
    buildSeasonCommandContext(
      user.leaguePlayer
    );

  if (!context.player)
    return;

  const command =
    buildSeasonCommandPayload(context);

  const nextOpponent =
    command.nextOpponents[0];

  if (nextOpponent)
    notifications.push(
      buildLeagueNotification({
        id:
          "season-next-" +
          getSeasonCommandKey(context.player.player) +
          "-" +
          getSeasonCommandKey(nextOpponent.player),
        type: "Season Command",
        title: "Recommended next match",
        body:
          "You still need to play " +
          nextOpponent.displayName +
          ". " +
          nextOpponent.reason +
          ".",
        timestamp: getSeasonCommandTimestamp(),
        link: "/",
        priority:
          nextOpponent.urgency === "High"
            ? "high"
            : "normal"
      })
    );

  if (command.progress.gamesRemaining > 0)
    notifications.push(
      buildLeagueNotification({
        id:
          "season-remaining-" +
          getSeasonCommandKey(context.player.player),
        type: "Season Command",
        title: "Season games remaining",
        body:
          "You have " +
          command.progress.gamesRemaining +
          " games remaining. " +
          command.deadlines.lateStatus +
          ".",
        timestamp: getSeasonCommandTimestamp(),
        link: "/",
        priority:
          command.deadlines.lateStatus === "On Schedule"
            ? "normal"
            : "high"
      })
    );

  if (
    command.promotion.promotionZone ||
    command.promotion.relegationZone
  )
    notifications.push(
      buildLeagueNotification({
        id:
          "season-table-" +
          getSeasonCommandKey(context.player.player),
        type: "Season Command",
        title: command.promotion.status,
        body:
          "You are currently rank #" +
          command.promotion.currentRank +
          " with " +
          command.promotion.gamesNeeded +
          " games left.",
        timestamp: getSeasonCommandTimestamp(),
        link: "/",
        priority: "high"
      })
    );

}

function buildSeasonCommandContext(playerName) {

  const registry =
    buildPlayerRegistry();

  updateRegistryStatistics(registry);

  const player =
    findRegisteredPlayer(
      registry,
      playerName
    );

  const games =
    getAllRecentGameObjects();

  const settings =
    typeof getSettingsObjectSafe === "function"
      ? getSettingsObjectSafe()
      : getSettingsObject();

  const availability =
    getSeasonAvailabilityMap();

  if (!player)
    return {
      player: null
    };

  const standings =
    buildSeasonDivisionStandings(
      registry,
      player.division
    );

  const standing =
    standings.filter(function(row) {
      return getSeasonCommandKey(row.player) === getSeasonCommandKey(player.player);
    })[0] || {
      rank: 0,
      games: 0,
      wins: 0,
      losses: 0,
      tp: 0,
      op: 0,
      vp: 0
    };

  return {
    availability: availability,
    games: games,
    player: player,
    settings: settings,
    standing: standing,
    standings: standings
  };

}

function buildSeasonCommandPayload(context) {

  const opponents =
    buildOpponentTracker(context);

  const completed =
    opponents.filter(function(opponent) {
      return opponent.status === "Already Played";
    }).length;

  const remaining =
    opponents.filter(function(opponent) {
      return opponent.status !== "Already Played";
    }).length;

  const progress =
    buildSeasonProgress(
      context,
      completed,
      remaining
    );

  return {
    player: {
      player: context.player.player,
      displayName:
        context.player.displayName ||
        context.player.player,
      division: context.player.division,
      rank: context.standing.rank,
      games: context.standing.games,
      wins: context.standing.wins,
      losses: context.standing.losses,
      tp: context.standing.tp,
      op: context.standing.op,
      vp: context.standing.vp
    },
    progress: progress,
    opponents: opponents,
    nextOpponents:
      buildNextOpponentRecommendations(
        context,
        opponents
      ),
    deadlines:
      buildSeasonDeadlines(
        context,
        progress
      ),
    promotion:
      buildSeasonPromotionTracker(
        context,
        progress
      ),
    divisionStatus:
      buildDivisionStatus(
        context,
        opponents
      ),
    leagueActivity:
      buildSeasonLeagueActivity(
        context
      ),
    availability:
      getSeasonAvailabilityForPlayer(
        context.availability,
        context.player.player
      ),
    commissioner:
      buildCommissionerSeasonStatus(context)
  };

}

function buildOpponentTracker(context) {

  const playerKey =
    getSeasonCommandKey(context.player.player);

  return context.standings
    .filter(function(opponent) {
      return getSeasonCommandKey(opponent.player) !== playerKey;
    })
    .map(function(opponent) {
      const game =
        findSeasonGameBetween(
          context.games,
          context.player.player,
          opponent.player
        );

      const availability =
        getSeasonAvailabilityForPlayer(
          context.availability,
          opponent.player
        );

      return {
        player: opponent.player,
        displayName:
          opponent.displayName ||
          opponent.player,
        rank: opponent.rank,
        games: opponent.games,
        status:
          game
            ? "Already Played"
            : availability.status === "Available"
              ? "Scheduled"
              : "Not Played",
        gamesRemainingBetweenPlayers:
          game
            ? 0
            : 1,
        gameId:
          game
            ? game.id
            : 0,
        lastResult:
          game
            ? buildSeasonGameResult(
                game,
                context.player.player
          )
            : "",
        availability: availability,
        availabilitySummary:
          buildSeasonAvailabilitySummary(availability),
        preferredStore:
          availability.homeStore,
        discordHandle:
          availability.discordHandle,
        profileLink:
          "/players/" + encodeURIComponent(opponent.player),
        scheduleLink:
          "/match-finder?opponent=" + encodeURIComponent(opponent.player)
      };
    });

}

function buildSeasonProgress(context, completed, remaining) {

  const required =
    Math.max(
      SEASON_COMMAND_TARGET_GAMES,
      context.standings.length - 1
    );

  const gamesCompleted =
    Number(context.standing.games) || completed;

  return {
    gamesRequired: required,
    gamesCompleted: gamesCompleted,
    gamesRemaining:
      Math.max(0, required - gamesCompleted),
    opponentsCompleted: completed,
    opponentsRemaining: remaining,
    midseasonProgress:
      getSeasonCommandPercent(
        gamesCompleted,
        Math.ceil(required / 2)
      ),
    seasonProgress:
      getSeasonCommandPercent(
        gamesCompleted,
        required
      ),
    completionPercentage:
      getSeasonCommandPercent(
        completed,
        Math.max(1, context.standings.length - 1)
      )
  };

}

function buildNextOpponentRecommendations(context, opponents) {

  return opponents
    .filter(function(opponent) {
      return opponent.status !== "Already Played";
    })
    .map(function(opponent) {
      const overlap =
        getAvailabilityOverlap(
          context.availability,
          context.player.player,
          opponent.player
        );

      return {
        player: opponent.player,
        displayName: opponent.displayName,
        rank: opponent.rank,
        reason:
          overlap
            ? "Availability overlap"
            : opponent.games < context.standing.games
              ? "Opponent needs games"
              : "Remaining division pairing",
        urgency:
          opponent.games < context.standing.games
            ? "High"
            : "Normal",
        availability: opponent.availability
      };
    })
    .sort(function(a, b) {
      if (a.urgency !== b.urgency)
        return a.urgency === "High" ? -1 : 1;

      return a.rank - b.rank;
    })
    .slice(0, 5);

}

function buildSeasonDeadlines(context, progress) {

  const settings =
    context.settings || {};

  const now =
    new Date();

  const endDate =
    getSeasonCommandDate(settings.seasonEndDate);

  const startDate =
    getSeasonCommandDate(settings.seasonStartDate);

  const midpoint =
    startDate && endDate
      ? new Date(
          startDate.getTime() +
          Math.floor((endDate.getTime() - startDate.getTime()) / 2)
        )
      : null;

  const midseasonTarget =
    Math.ceil(progress.gamesRequired / 2);

  return {
    currentWeek:
      startDate
        ? Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / 604800000))
        : 1,
    midseasonDeadline:
      midpoint
        ? formatSeasonCommandDate(midpoint)
        : "",
    seasonEndDeadline:
      endDate
        ? formatSeasonCommandDate(endDate)
        : getSeasonCommandString(settings.seasonEndDate),
    gamesNeededBeforeMidseason:
      Math.max(0, midseasonTarget - progress.gamesCompleted),
    gamesNeededBeforeEnd:
      progress.gamesRemaining,
    lateStatus:
      progress.gamesCompleted < midseasonTarget &&
      midpoint &&
      now.getTime() > midpoint.getTime()
        ? "Behind Midseason Pace"
        : progress.gamesRemaining > 0 &&
          endDate &&
          now.getTime() > endDate.getTime()
          ? "Past Season Deadline"
          : "On Schedule"
  };

}

function buildSeasonPromotionTracker(context, progress) {

  const rank =
    Number(context.standing.rank) || 0;

  const division =
    getSeasonCommandString(context.player.division).toLowerCase();

  const promotionZone =
    division.indexOf("main") === -1 && rank > 0 && rank <= 2;

  const relegationZone =
    division.indexOf("main") !== -1 && rank >= Math.max(1, context.standings.length - 1);

  return {
    currentRank: rank,
    promotionZone: promotionZone,
    safe:
      !promotionZone &&
      !relegationZone,
    relegationZone: relegationZone,
    projectedFinish:
      rank || context.standings.length,
    gamesNeeded:
      progress.gamesRemaining,
    magicNumber:
      promotionZone
        ? Math.max(1, progress.gamesRemaining)
        : Math.max(1, 3 - Math.min(2, context.standing.wins)),
    status:
      promotionZone
        ? "Promotion Zone"
        : relegationZone
          ? "Relegation Zone"
          : "Safe"
  };

}

function buildDivisionStatus(context, opponents) {

  const opponentMap = {};

  opponents.forEach(function(opponent) {
    opponentMap[getSeasonCommandKey(opponent.player)] = opponent;
  });

  return context.standings.map(function(row) {
    const key =
      getSeasonCommandKey(row.player);

    const opponent =
      opponentMap[key];

    return {
      player: row.player,
      displayName:
        row.displayName ||
        row.player,
      rank: row.rank,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
      tp: row.tp,
      op: row.op,
      vp: row.vp,
      pairingStatus:
        key === getSeasonCommandKey(context.player.player)
          ? "You"
          : opponent
            ? opponent.status
            : "Not Played"
    };
  });

}

function buildSeasonLeagueActivity(context) {

  const division =
    context.player.division;

  const recentDivisionGames =
    context.games
      .filter(function(game) {
        return getSeasonCommandString(game.division) === division;
      })
      .slice(0, 5);

  const sortedByGames =
    context.standings
      .slice()
      .sort(function(a, b) {
        return a.games - b.games || a.rank - b.rank;
      });

  return {
    recentDivisionGames: recentDivisionGames,
    playersCatchingUp:
      sortedByGames.slice(0, 5),
    promotionRace:
      context.standings.slice(0, 3),
    relegationRace:
      context.standings.slice(-3)
  };

}

function buildCommissionerSeasonStatus(context) {

  return {
    division: context.player.division,
    finished:
      context.standings.filter(function(row) {
        return row.games >= Math.max(SEASON_COMMAND_TARGET_GAMES, context.standings.length - 1);
      }).length,
    behind:
      context.standings.filter(function(row) {
        return row.games < Math.ceil(SEASON_COMMAND_TARGET_GAMES / 2);
      }).length,
    missingPairings:
      buildMissingDivisionPairings(context).length,
    latePlayers:
      context.standings
        .filter(function(row) {
          return row.games < Math.ceil(SEASON_COMMAND_TARGET_GAMES / 2);
        })
        .map(function(row) {
          return {
            player: row.player,
            displayName: row.displayName || row.player,
            games: row.games
          };
        })
  };

}

function buildMissingDivisionPairings(context) {

  const pairings = [];

  for (let left = 0; left < context.standings.length; left++) {
    for (let right = left + 1; right < context.standings.length; right++) {
      if (!findSeasonGameBetween(
        context.games,
        context.standings[left].player,
        context.standings[right].player
      ))
        pairings.push({
          left: context.standings[left].player,
          right: context.standings[right].player
        });
    }
  }

  return pairings;

}

function buildSeasonDivisionStandings(registry, division) {

  const rows =
    buildDivisionTable(
      registry,
      division
    );

  const displayNames =
    buildSeasonDisplayNameMap(registry);

  return rows
    .slice(1)
    .map(function(row) {
      const player =
        row[CONFIG.STANDINGS.PLAYER];

      return {
        rank: Number(row[CONFIG.STANDINGS.RANK]) || 0,
        player: player,
        displayName:
          displayNames[player] ||
          player,
        games: Number(row[CONFIG.STANDINGS.GAMES]) || 0,
        wins: Number(row[CONFIG.STANDINGS.WINS]) || 0,
        losses: Number(row[CONFIG.STANDINGS.LOSSES]) || 0,
        tp: Number(row[CONFIG.STANDINGS.TP]) || 0,
        op: Number(row[CONFIG.STANDINGS.OP]) || 0,
        vp: Number(row[CONFIG.STANDINGS.VP]) || 0
      };
    });

}

function findSeasonGameBetween(games, leftPlayer, rightPlayer) {

  const left =
    getSeasonCommandKey(leftPlayer);

  const right =
    getSeasonCommandKey(rightPlayer);

  return games.filter(function(game) {
    const winner =
      getSeasonCommandKey(game.winner);
    const loser =
      getSeasonCommandKey(game.loser);

    return (
      (winner === left && loser === right) ||
      (winner === right && loser === left)
    );
  })[0] || null;

}

function buildSeasonGameResult(game, playerName) {

  const playerKey =
    getSeasonCommandKey(playerName);

  return getSeasonCommandKey(game.winner) === playerKey
    ? "Win"
    : "Loss";

}

function getAvailabilityOverlap(availabilityMap, leftPlayer, rightPlayer) {

  const left =
    getSeasonAvailabilityForPlayer(
      availabilityMap,
      leftPlayer
    );

  const right =
    getSeasonAvailabilityForPlayer(
      availabilityMap,
      rightPlayer
    );

  if (left.status !== "Available" || right.status !== "Available")
    return false;

  return (
    left.preferredDays !== "" &&
    right.preferredDays !== "" &&
    left.preferredDays.toLowerCase() === right.preferredDays.toLowerCase()
  );

}

function getSeasonAvailabilityForPlayer(availabilityMap, playerName) {

  const key =
    getSeasonCommandKey(playerName);

  return availabilityMap[key] || {
    player: playerName,
    status: "Not Set",
    preferredDays: "",
    preferredTimes: "",
    notes: "",
    updatedAt: "",
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
    homeStore: "",
    city: "",
    maxTravelDistance: "",
    preferredLocations: "",
    discordHandle: ""
  };

}

function getSeasonAvailabilityMap() {

  const sheet =
    ensureSeasonAvailabilitySheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  const map = {};

  values
    .slice(1)
    .forEach(function(row) {
      const player =
        getSeasonCommandString(row[0]);

      if (player === "")
        return;

      map[getSeasonCommandKey(player)] = {
        player: player,
        status:
          getSeasonCommandString(row[1]) ||
          "Not Set",
        preferredDays:
          getSeasonCommandString(row[2]),
        preferredTimes:
          getSeasonCommandString(row[3]),
        notes:
          getSeasonCommandString(row[4]),
        updatedAt:
          getSeasonCommandString(row[5]),
        monday:
          getSeasonCommandString(row[6]),
        tuesday:
          getSeasonCommandString(row[7]),
        wednesday:
          getSeasonCommandString(row[8]),
        thursday:
          getSeasonCommandString(row[9]),
        friday:
          getSeasonCommandString(row[10]),
        saturday:
          getSeasonCommandString(row[11]),
        sunday:
          getSeasonCommandString(row[12]),
        homeStore:
          getSeasonCommandString(row[13]),
        city:
          getSeasonCommandString(row[14]),
        maxTravelDistance:
          getSeasonCommandString(row[15]),
        preferredLocations:
          getSeasonCommandString(row[16]),
        discordHandle:
          getSeasonCommandString(row[17])
      };
    });

  return map;

}

function saveSeasonAvailabilityRecord(record) {

  const sheet =
    ensureSeasonAvailabilitySheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  const key =
    getSeasonCommandKey(record.player);

  let rowNumber = -1;

  for (let index = 1; index < values.length; index++) {
    if (getSeasonCommandKey(values[index][0]) === key) {
      rowNumber = index + 1;
      break;
    }
  }

  const row = [
    record.player,
    record.status,
    record.preferredDays,
    record.preferredTimes,
    record.notes,
    record.updatedAt,
    record.monday || "",
    record.tuesday || "",
    record.wednesday || "",
    record.thursday || "",
    record.friday || "",
    record.saturday || "",
    record.sunday || "",
    record.homeStore || "",
    record.city || "",
    record.maxTravelDistance || "",
    record.preferredLocations || "",
    record.discordHandle || ""
  ];

  if (rowNumber === -1)
    sheet.appendRow(row);
  else
    sheet
      .getRange(rowNumber, 1, 1, SEASON_AVAILABILITY_HEADERS.length)
      .setValues([row]);

}

function ensureSeasonAvailabilitySheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.SEASON_AVAILABILITY
    );

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEETS.SEASON_AVAILABILITY
      );

  const headerRange =
    sheet.getRange(1, 1, 1, SEASON_AVAILABILITY_HEADERS.length);

  const headers =
    headerRange.getValues()[0];

  const matches =
    SEASON_AVAILABILITY_HEADERS.every(function(header, index) {
      return headers[index] === header;
    });

  if (!matches)
    headerRange.setValues([SEASON_AVAILABILITY_HEADERS]);

  return sheet;

}

function buildSeasonDisplayNameMap(registry) {

  const map = {};

  Object.keys(registry)
    .forEach(function(playerName) {
      const player =
        registry[playerName];

      map[player.player] =
        player.displayName ||
        player.player;
    });

  return map;

}

function getSeasonCommandPercent(value, total) {

  if (!total)
    return 0;

  return Math.min(
    100,
    Math.round((Number(value) / Number(total)) * 100)
  );

}

function buildSeasonAvailabilitySummary(availability) {

  const pieces = [];

  if (availability.status)
    pieces.push(availability.status);

  if (availability.preferredDays)
    pieces.push(availability.preferredDays);

  if (availability.preferredTimes)
    pieces.push(availability.preferredTimes);

  return pieces.join(" - ");

}

function getSeasonCommandDate(value) {

  const text =
    getSeasonCommandString(value);

  if (text === "")
    return null;

  const parsed =
    new Date(text);

  return isNaN(parsed.getTime())
    ? null
    : parsed;

}

function formatSeasonCommandDate(date) {

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

}

function getSeasonCommandTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getSeasonCommandKey(value) {

  return getSeasonCommandString(value)
    .toLowerCase();

}

function getSeasonCommandString(value) {

  return String(
    value === undefined ||
    value === null
      ? ""
      : value
  ).trim();

}
