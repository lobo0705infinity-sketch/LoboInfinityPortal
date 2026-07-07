/*******************************************************
 * LOBO INFINITY LEAGUE 4.0
 * SchedulingApi.gs
 *
 * Community scheduling, match finder, requests, and
 * calendar export derived from league identity.
 *******************************************************/

const SCHEDULING_REQUEST_HEADERS = [
  "ID",
  "From Player",
  "To Player",
  "Proposed Date",
  "Proposed Time",
  "Location",
  "Message",
  "Status",
  "Response Message",
  "Created At",
  "Updated At"
];

function getSchedulingCenter(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  return jsonOutput({
    success: true,
    scheduling:
      buildSchedulingPayload(
        auth.user.leaguePlayer,
        auth.user
      )
  });

}

function getMatchFinder(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const payload =
    buildSchedulingPayload(
      auth.user.leaguePlayer,
      auth.user
    );

  return jsonOutput({
    success: true,
    matchFinder: {
      currentSeason: payload.currentSeason,
      player: payload.player,
      availability: payload.availability,
      recommendations: payload.recommendations,
      pendingRequests: payload.requests.pending,
      upcomingMatches: payload.requests.upcoming,
      progress: payload.progress
    }
  });

}

function updateSchedulingAvailability(e) {

  return updateSeasonAvailability(e);

}

function createSchedulingRequest(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const params =
    getApiParameters(e);

  const opponent =
    getSchedulingString(params.opponent);

  if (opponent === "")
    return jsonOutput({
      success: false,
      error: "Opponent is required."
    });

  const record = {
    id:
      "schedule-" +
      Utilities.getUuid(),
    fromPlayer:
      auth.user.leaguePlayer,
    toPlayer:
      opponent,
    proposedDate:
      getSchedulingString(params.proposedDate),
    proposedTime:
      getSchedulingString(params.proposedTime),
    location:
      getSchedulingString(params.location),
    message:
      getSchedulingString(params.message),
    status:
      "Pending",
    responseMessage:
      "",
    createdAt:
      getSchedulingTimestamp(),
    updatedAt:
      getSchedulingTimestamp()
  };

  saveSchedulingRequestRecord(record);
  invalidatePortalCacheGroup("scheduling");

  return getSchedulingCenter(e);

}

function respondSchedulingRequest(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const params =
    getApiParameters(e);

  const requestId =
    getSchedulingString(params.requestId);

  const status =
    getSchedulingString(params.status);

  if (requestId === "" || status === "")
    return jsonOutput({
      success: false,
      error: "Request ID and status are required."
    });

  const result =
    updateSchedulingRequestStatus(
      requestId,
      auth.user,
      status,
      getSchedulingString(params.responseMessage)
    );

  if (!result.success)
    return jsonOutput(result);

  invalidatePortalCacheGroup("scheduling");

  return getSchedulingCenter(e);

}

function getSchedulingCalendarExport(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const params =
    getApiParameters(e);

  const requestId =
    getSchedulingString(params.requestId);

  const request =
    getSchedulingRequests()
      .filter(function(item) {
        return item.id === requestId;
      })[0] || null;

  if (!request)
    return jsonOutput({
      success: false,
      error: "Scheduling request was not found."
    });

  return jsonOutput({
    success: true,
    calendar: {
      filename:
        request.id + ".ics",
      ics:
        buildSchedulingIcs(request)
    }
  });

}

function getCommissionerScheduling(e) {

  return requireApiPermission(e, "viewOperations", function() {
    const registry =
      buildPlayerRegistry();

    updateRegistryStatistics(registry);

    const games =
      getAllRecentGameObjects();

    const availability =
      getSeasonAvailabilityMap();

    const divisions = [
      CONFIG.DIVISIONS.MAIN_MAN,
      CONFIG.DIVISIONS.PGA,
      CONFIG.DIVISIONS.PGB
    ];

    return jsonOutput({
      success: true,
      scheduling: {
        divisions:
          divisions.map(function(division) {
            return buildCommissionerSchedulingDivision(
              registry,
              games,
              availability,
              division
            );
          }),
        requests:
          getSchedulingRequests(),
        generatedAt:
          getSchedulingTimestamp()
      }
    });
  });

}

function buildSchedulingPayload(playerName, user) {

  const context =
    buildSeasonCommandContext(playerName);

  if (!context.player)
    return {
      error: "League player not found."
    };

  const seasonCommand =
    buildSeasonCommandPayload(context);

  const requests =
    getSchedulingRequestsForPlayer(playerName);

  const recommendations =
    buildSchedulingRecommendations(
      context,
      seasonCommand,
      requests
    );

  return {
    currentSeason:
      getSchedulingString(context.settings.currentSeason) ||
      "Current Season",
    player:
      seasonCommand.player,
    availability:
      seasonCommand.availability,
    progress:
      seasonCommand.progress,
    opponents:
      seasonCommand.opponents,
    completedOpponents:
      seasonCommand.opponents.filter(function(opponent) {
        return opponent.status === "Already Played";
      }),
    remainingOpponents:
      seasonCommand.opponents.filter(function(opponent) {
        return opponent.status !== "Already Played";
      }),
    recommendations:
      recommendations,
    requests:
      buildSchedulingRequestGroups(
        requests,
        playerName
      ),
    seasonProgress:
      buildSchedulingSeasonProgress(context),
    activity:
      buildSchedulingActivity(requests),
    commissioner:
      buildCommissionerSeasonStatus(context),
    quickActions:
      buildSchedulingQuickActions(
        user,
        recommendations
      )
  };

}

function buildSchedulingRecommendations(context, seasonCommand, requests) {

  const pendingLookup = {};

  requests.forEach(function(request) {
    if (request.status !== "Pending" && request.status !== "Suggested")
      return;

    const other =
      getSchedulingKey(request.fromPlayer) === getSchedulingKey(context.player.player)
        ? request.toPlayer
        : request.fromPlayer;

    pendingLookup[getSchedulingKey(other)] = true;
  });

  return seasonCommand.opponents
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

      const score =
        getSchedulingRecommendationScore(
          context,
          opponent,
          overlap,
          pendingLookup[getSchedulingKey(opponent.player)]
        );

      return {
        player: opponent.player,
        displayName: opponent.displayName,
        division: context.player.division,
        rank: opponent.rank,
        gamesCompleted: opponent.games,
        gamesRemainingBetweenPlayers: opponent.gamesRemainingBetweenPlayers,
        availability: opponent.availability,
        availabilitySummary: opponent.availabilitySummary,
        preferredStore: opponent.preferredStore,
        discordHandle: opponent.discordHandle,
        profileLink: opponent.profileLink,
        scheduleLink: opponent.scheduleLink,
        score: score,
        priority:
          score >= 80
            ? "High"
            : score >= 55
              ? "Recommended"
              : "Normal",
        reason:
          buildSchedulingRecommendationReason(
            context,
            opponent,
            overlap,
            pendingLookup[getSchedulingKey(opponent.player)]
          )
      };
    })
    .sort(function(a, b) {
      return b.score - a.score || a.rank - b.rank;
    });

}

function getSchedulingRecommendationScore(context, opponent, overlap, pending) {

  let score = 40;

  if (overlap)
    score += 30;

  if (getSchedulingString(opponent.preferredStore) !== "")
    score += 10;

  if (opponent.games < context.standing.games)
    score += 10;

  if (pending)
    score -= 25;

  return Math.max(0, Math.min(100, score));

}

function buildSchedulingRecommendationReason(context, opponent, overlap, pending) {

  if (pending)
    return "A scheduling request is already pending.";

  if (overlap)
    return (
      "You and " +
      opponent.displayName +
      " have overlapping availability. This is a high-priority remaining league match."
    );

  if (getSchedulingString(opponent.preferredStore) !== "")
    return (
      opponent.displayName +
      " has a preferred store recorded: " +
      opponent.preferredStore +
      "."
    );

  if (opponent.games < context.standing.games)
    return (
      opponent.displayName +
      " needs games and is a useful next scheduling target."
    );

  return "Remaining required division pairing.";

}

function buildSchedulingRequestGroups(requests, playerName) {

  const key =
    getSchedulingKey(playerName);

  return {
    incoming:
      requests.filter(function(request) {
        return getSchedulingKey(request.toPlayer) === key && request.status === "Pending";
      }),
    outgoing:
      requests.filter(function(request) {
        return getSchedulingKey(request.fromPlayer) === key && request.status === "Pending";
      }),
    pending:
      requests.filter(function(request) {
        return request.status === "Pending" || request.status === "Suggested";
      }),
    upcoming:
      requests.filter(function(request) {
        return request.status === "Accepted";
      }),
    history:
      requests.filter(function(request) {
        return request.status !== "Pending";
      })
  };

}

function buildSchedulingSeasonProgress(context) {

  const divisions = [
    CONFIG.DIVISIONS.MAIN_MAN,
    CONFIG.DIVISIONS.PGA,
    CONFIG.DIVISIONS.PGB
  ];

  return {
    player:
      context.standing,
    division:
      buildSchedulingDivisionProgress(
        context.standings
      ),
    league:
      divisions.map(function(division) {
        return buildSchedulingDivisionProgress(
          buildSeasonDivisionStandings(
            buildPlayerRegistry(),
            division
          )
        );
      })
  };

}

function buildSchedulingDivisionProgress(rows) {

  const required =
    Math.max(
      SEASON_COMMAND_TARGET_GAMES,
      rows.length - 1
    );

  const completed =
    rows.reduce(function(total, row) {
      return total + (Number(row.games) || 0);
    }, 0);

  const total =
    rows.length * required;

  return {
    players: rows.length,
    gamesCompleted: completed,
    gamesRemaining: Math.max(0, total - completed),
    completionPercentage:
      total === 0
        ? 0
        : Math.round((completed / total) * 100)
  };

}

function buildSchedulingActivity(requests) {

  const requestActivity =
    requests
      .slice()
      .sort(function(a, b) {
        return getSchedulingDateValue(b.updatedAt) - getSchedulingDateValue(a.updatedAt);
      })
      .slice(0, 8)
      .map(function(request) {
        return {
          type: "Scheduling",
          title:
            request.status + " match request",
          body:
            request.fromPlayer +
            " -> " +
            request.toPlayer +
            " at " +
            (request.location || "location TBD"),
          timestamp:
            request.updatedAt,
          link:
            "/match-finder"
        };
      });

  const games =
    getAllRecentGameObjects()
      .slice(0, 5)
      .map(function(game) {
        return {
          type: "Game Submitted",
          title:
            game.winner +
            " defeated " +
            game.loser,
          body:
            game.mission,
          timestamp:
            game.date,
          link:
            "/games/" + game.id
        };
      });

  return requestActivity.concat(games)
    .sort(function(a, b) {
      return getSchedulingDateValue(b.timestamp) - getSchedulingDateValue(a.timestamp);
    })
    .slice(0, 10);

}

function buildSchedulingQuickActions(user, recommendations) {

  const actions = [
    {
      label: "Update Availability",
      link: "/match-finder#availability"
    },
    {
      label: "View Standings",
      link: "/standings"
    },
    {
      label: "My Profile",
      link: "/profile"
    }
  ];

  if (recommendations[0])
    actions.unshift({
      label:
        "Schedule " +
        recommendations[0].displayName,
      link:
        "/match-finder?opponent=" +
        encodeURIComponent(recommendations[0].player)
    });

  return actions;

}

function buildCommissionerSchedulingDivision(registry, games, availability, division) {

  const standings =
    buildSeasonDivisionStandings(
      registry,
      division
    );

  const context = {
    availability: availability,
    games: games,
    player: standings[0] || null,
    standing: standings[0] || {},
    standings: standings
  };

  const missing =
    context.player
      ? buildMissingDivisionPairings(context)
      : [];

  return {
    division: division,
    progress:
      buildSchedulingDivisionProgress(standings),
    playersBehind:
      standings.filter(function(row) {
        return row.games < Math.ceil(SEASON_COMMAND_TARGET_GAMES / 2);
      }),
    inactivePlayers:
      standings.filter(function(row) {
        const record =
          getSeasonAvailabilityForPlayer(availability, row.player);

        return record.status === "Not Set" && row.games === 0;
      }),
    outstandingMatchups:
      missing,
    suggestedReminderRecipients:
      standings
        .filter(function(row) {
          return row.games < Math.ceil(SEASON_COMMAND_TARGET_GAMES / 2);
        })
        .map(function(row) {
          return {
            player: row.player,
            displayName: row.displayName,
            games: row.games,
            profileLink: "/players/" + encodeURIComponent(row.player)
          };
        })
  };

}

function getSchedulingRequestsForPlayer(playerName) {

  const key =
    getSchedulingKey(playerName);

  return getSchedulingRequests()
    .filter(function(request) {
      return (
        getSchedulingKey(request.fromPlayer) === key ||
        getSchedulingKey(request.toPlayer) === key
      );
    });

}

function getSchedulingRequests() {

  const sheet =
    ensureSchedulingRequestsSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  return values
    .slice(1)
    .filter(function(row) {
      return getSchedulingString(row[0]) !== "";
    })
    .map(function(row) {
      return {
        id: getSchedulingString(row[0]),
        fromPlayer: getSchedulingString(row[1]),
        toPlayer: getSchedulingString(row[2]),
        proposedDate: getSchedulingString(row[3]),
        proposedTime: getSchedulingString(row[4]),
        location: getSchedulingString(row[5]),
        message: getSchedulingString(row[6]),
        status: getSchedulingString(row[7]) || "Pending",
        responseMessage: getSchedulingString(row[8]),
        createdAt: getSchedulingString(row[9]),
        updatedAt: getSchedulingString(row[10])
      };
    });

}

function saveSchedulingRequestRecord(record) {

  const sheet =
    ensureSchedulingRequestsSheet();

  sheet.appendRow([
    record.id,
    record.fromPlayer,
    record.toPlayer,
    record.proposedDate,
    record.proposedTime,
    record.location,
    record.message,
    record.status,
    record.responseMessage,
    record.createdAt,
    record.updatedAt
  ]);

}

function updateSchedulingRequestStatus(requestId, user, status, responseMessage) {

  const sheet =
    ensureSchedulingRequestsSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  const normalizedId =
    getSchedulingKey(requestId);

  const normalizedStatus =
    getSchedulingStatus(status);

  for (let index = 1; index < values.length; index++) {
    if (getSchedulingKey(values[index][0]) !== normalizedId)
      continue;

    const fromPlayer =
      getSchedulingString(values[index][1]);

    const toPlayer =
      getSchedulingString(values[index][2]);

    const isParticipant =
      getSchedulingKey(user.leaguePlayer) === getSchedulingKey(fromPlayer) ||
      getSchedulingKey(user.leaguePlayer) === getSchedulingKey(toPlayer);

    const canManage =
      userHasPermission(user.role, "viewOperations");

    if (!isParticipant && !canManage)
      return {
        success: false,
        error: "You do not have permission to update this request."
      };

    sheet
      .getRange(index + 1, 8, 1, 4)
      .setValues([[
        normalizedStatus,
        responseMessage,
        getSchedulingString(values[index][9]),
        getSchedulingTimestamp()
      ]]);

    return {
      success: true
    };
  }

  return {
    success: false,
    error: "Scheduling request was not found."
  };

}

function ensureSchedulingRequestsSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.SCHEDULING_REQUESTS
    );

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEETS.SCHEDULING_REQUESTS
      );

  const headerRange =
    sheet.getRange(1, 1, 1, SCHEDULING_REQUEST_HEADERS.length);

  const headers =
    headerRange.getValues()[0];

  const matches =
    SCHEDULING_REQUEST_HEADERS.every(function(header, index) {
      return headers[index] === header;
    });

  if (!matches)
    headerRange.setValues([SCHEDULING_REQUEST_HEADERS]);

  return sheet;

}

function addSchedulingNotifications(notifications, user) {

  if (!user || !user.leaguePlayer)
    return;

  getSchedulingRequestsForPlayer(user.leaguePlayer)
    .filter(function(request) {
      return request.status === "Pending" || request.status === "Accepted" || request.status === "Declined" || request.status === "Suggested";
    })
    .slice(0, 8)
    .forEach(function(request) {
      const incoming =
        getSchedulingKey(request.toPlayer) === getSchedulingKey(user.leaguePlayer);

      notifications.push(
        buildLeagueNotification({
          id:
            "schedule-" +
            request.id +
            "-" +
            request.status,
          type: "Scheduling",
          title:
            incoming
              ? "Match request from " + request.fromPlayer
              : "Match request " + request.status,
          body:
            request.proposedDate +
            " " +
            request.proposedTime +
            " at " +
            (request.location || "location TBD"),
          timestamp:
            request.updatedAt || request.createdAt,
          link:
            "/match-finder",
          priority:
            request.status === "Pending"
              ? "high"
              : "normal"
        })
      );
    });

}

function buildSchedulingIcs(request) {

  const dateText =
    request.proposedDate.replace(/-/g, "");

  const timeText =
    getSchedulingString(request.proposedTime).replace(/[^0-9]/g, "");

  const start =
    dateText +
    "T" +
    (timeText.length >= 4 ? timeText.slice(0, 4) : "1900") +
    "00";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lobo Infinity League//Scheduling//EN",
    "BEGIN:VEVENT",
    "UID:" + request.id + "@lobo-infinity",
    "DTSTAMP:" + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd'T'HHmmss'Z'"),
    "DTSTART:" + start,
    "SUMMARY:Lobo League Match: " + request.fromPlayer + " vs " + request.toPlayer,
    "LOCATION:" + request.location,
    "DESCRIPTION:" + request.message,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

}

function getSchedulingStatus(status) {

  const text =
    getSchedulingString(status)
      .toLowerCase();

  if (text === "accepted")
    return "Accepted";

  if (text === "declined")
    return "Declined";

  if (text === "suggested")
    return "Suggested";

  return "Pending";

}

function getSchedulingDateValue(value) {

  const parsed =
    new Date(value);

  return isNaN(parsed.getTime())
    ? 0
    : parsed.getTime();

}

function getSchedulingTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getSchedulingKey(value) {

  return getSchedulingString(value)
    .toLowerCase();

}

function getSchedulingString(value) {

  return String(
    value === undefined ||
    value === null
      ? ""
      : value
  ).trim();

}
