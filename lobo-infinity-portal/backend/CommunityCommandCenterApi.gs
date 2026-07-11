/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * CommunityCommandCenterApi.gs
 *
 * Version 3.1 authenticated Community Command Center.
 *******************************************************/

function getCommunityCommandCenter(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const player =
    getCommunityCommandString(auth.user.leaguePlayer);

  const context =
    buildSeasonCommandContext(player);

  if (!context.player)
    return jsonOutput({
      success: false,
      error: "League player not found."
    });

  const seasonCommand =
    buildSeasonCommandPayload(context);

  const runtimeValidation =
    validateEventEngineRuntime();

  if (!runtimeValidation.initialized)
    return jsonOutput(
      buildEventEngineInitializationRequiredResponse(runtimeValidation)
    );

  const events =
    getEventEngineSnapshot().events;

  const currentEvent =
    getCurrentLeagueEventSnapshot();

  const activity =
    buildCommunityActivity(context.games);

  const requests =
    getSchedulingRequestsForPlayer(player);

  return jsonOutput({
    success: true,
    commandCenter: {
      welcome:
        buildCommunityCommandWelcome(
          auth.user,
          currentEvent,
          events,
          seasonCommand
        ),
      activeEvents:
        buildCommunityActiveEvents(
          events,
          seasonCommand
        ),
      opponentTracker:
        buildCommunityOpponentTracker(
          seasonCommand,
          context.games
        ),
      today:
        buildCommunityTodayActions(
          auth.user,
          seasonCommand,
          currentEvent,
          context.settings
        ),
      nextActions:
        buildCommunityNextActions(
          auth.user,
          seasonCommand,
          currentEvent,
          context.settings,
          activity
        ),
      communityActivity:
        activity,
      matchRequests:
        buildCommunityMatchRequests(
          requests,
          player
        ),
      nudgeEngine:
        buildCommunityNudges(
          auth.user,
          seasonCommand,
          currentEvent,
          activity
        ),
      eventSwitcher:
        buildCommunityEventSwitcher(
          events,
          currentEvent
        ),
      promotion:
        seasonCommand.promotion,
      schedule:
        buildCommunitySchedule(
          seasonCommand,
          currentEvent
        ),
      intelligence:
        buildCommunityIntelligenceSummary(
          auth.user,
          seasonCommand
        ),
      quickActions:
        buildCommunityQuickActions(context.settings)
    }
  });

}

function buildCommunityCommandWelcome(user, currentEvent, events, seasonCommand) {

  return {
    displayName:
      user.displayName ||
      user.playerDisplayName ||
      user.leaguePlayer,
    leaguePlayer:
      user.leaguePlayer,
    playerDisplayName:
      user.playerDisplayName ||
      user.leaguePlayer,
    currentRank:
      seasonCommand.player.rank,
    currentDivision:
      seasonCommand.player.division,
    currentRecord:
      seasonCommand.player.wins +
      "-" +
      seasonCommand.player.losses,
    currentWeek:
      seasonCommand.deadlines.currentWeek,
    leagueCompletion:
      seasonCommand.progress.completionPercentage,
    currentLeague:
      currentEvent
        ? currentEvent.name
        : "Current League",
    currentActiveEvents:
      events.filter(function(event) {
        return getCommunityCommandString(event.status).toLowerCase() === "active";
      }).length
  };

}

function buildCommunityMatchRequests(requests, playerName) {

  const key =
    getCommunityCommandString(playerName).toLowerCase();

  return {
    incoming:
      requests.filter(function(request) {
        return (
          getCommunityCommandString(request.toPlayer).toLowerCase() === key &&
          request.status === "Pending"
        );
      }).slice(0, 3),
    outgoing:
      requests.filter(function(request) {
        return (
          getCommunityCommandString(request.fromPlayer).toLowerCase() === key &&
          request.status === "Pending"
        );
      }).slice(0, 3),
    upcoming:
      requests.filter(function(request) {
        return request.status === "Accepted";
      }).slice(0, 3)
  };

}

function buildCommunityActiveEvents(events, seasonCommand) {

  return events
    .filter(function(event) {
      return getCommunityCommandString(event.status).toLowerCase() === "active";
    })
    .map(function(event) {
      return {
        eventId: event.id,
        name: event.name,
        type: event.type,
        status: event.status,
        gamesRemaining:
          event.id === EVENT_ENGINE_DEFAULT_EVENT_ID
            ? seasonCommand.progress.gamesRemaining
            : 0,
        completionPercentage:
          event.id === EVENT_ENGINE_DEFAULT_EVENT_ID
            ? seasonCommand.progress.completionPercentage
            : 0,
        primaryAction:
          event.id === EVENT_ENGINE_DEFAULT_EVENT_ID &&
          seasonCommand.nextOpponents[0]
            ? "Schedule Next Match"
            : "View Event",
        statusDetail:
          event.id === EVENT_ENGINE_DEFAULT_EVENT_ID
            ? "Week " + seasonCommand.deadlines.currentWeek
            : getCommunityCommandString(event.lifecycleStage || event.status),
        link:
          event.id === EVENT_ENGINE_DEFAULT_EVENT_ID
            ? "/standings"
            : "/"
      };
    });

}

function buildCommunityOpponentTracker(seasonCommand, games) {

  const divisionLookup = {};

  seasonCommand.divisionStatus.forEach(function(row) {
    divisionLookup[getCommunityCommandString(row.player).toLowerCase()] = row;
  });

  return {
    progress: {
      gamesCompleted: seasonCommand.progress.gamesCompleted,
      gamesRequired: seasonCommand.progress.gamesRequired,
      gamesRemaining: seasonCommand.progress.gamesRemaining,
      completionPercentage: seasonCommand.progress.completionPercentage
    },
    completed:
      seasonCommand.opponents
        .filter(function(opponent) {
          return opponent.status === "Already Played";
        })
        .map(function(opponent) {
          return buildCommunityOpponentCard(
            opponent,
            games,
            divisionLookup,
            seasonCommand.player.division
          );
        }),
    remaining:
      seasonCommand.opponents
        .filter(function(opponent) {
          return opponent.status !== "Already Played";
        })
        .map(function(opponent) {
          return buildCommunityOpponentCard(
            opponent,
            games,
            divisionLookup,
            seasonCommand.player.division
          );
        }),
    suggested:
      seasonCommand.nextOpponents[0] || null
  };

}

function buildCommunityOpponentCard(opponent, games, divisionLookup, playerDivision) {

  const recent =
    games.filter(function(game) {
      const player =
        getCommunityCommandString(opponent.player).toLowerCase();

      return (
        getCommunityCommandString(game.winner).toLowerCase() === player ||
        getCommunityCommandString(game.loser).toLowerCase() === player
      );
    })[0] || null;

  const standingsRow =
    divisionLookup[getCommunityCommandString(opponent.player).toLowerCase()] || {};

  return {
    player: opponent.player,
    displayName:
      opponent.displayName ||
      opponent.player,
    division:
      standingsRow.division || playerDivision || "",
    status: opponent.status,
    rank: opponent.rank,
    gamesCompleted: opponent.games,
    lastActivity:
      recent
        ? recent.date
        : "",
    availability:
      opponent.availability || {
        status: "Not Set"
    },
    availabilitySummary:
      opponent.availabilitySummary || "",
    preferredStore:
      opponent.preferredStore || "",
    discordHandle:
      opponent.discordHandle || "",
    gamesRemainingBetweenPlayers:
      opponent.gamesRemainingBetweenPlayers || 0,
    profileLink:
      opponent.profileLink || "/players/" + encodeURIComponent(opponent.player),
    scheduleLink:
      opponent.scheduleLink || "/match-finder?opponent=" + encodeURIComponent(opponent.player),
    quickMessage:
      "Message",
    suggestedPriority:
      opponent.games < 3
        ? "High"
        : opponent.status === "Scheduled"
          ? "Ready"
          : "Normal",
    reason:
      opponent.games < 3
        ? "Needs games"
        : opponent.status === "Scheduled"
          ? "Availability set"
          : "Remaining pairing"
  };

}

function buildCommunityTodayActions(user, seasonCommand, currentEvent, settings) {

  return buildCommunityNextActions(
    user,
    seasonCommand,
    currentEvent,
    settings,
    null
  )
    .filter(function(action) {
      return (
        action.priority === "Critical" ||
        action.priority === "High" ||
        action.priority === "Normal"
      );
    })
    .slice(0, 3);

}

function buildCommunityNextActions(user, seasonCommand, currentEvent, settings, activity) {

  const actions = [];

  const recommended =
    seasonCommand.nextOpponents[0];

  if (recommended)
    actions.push({
      label:
        "You still need to play " +
        recommended.displayName +
        ".",
      priority:
        recommended.urgency === "High"
          ? "High"
          : "Normal",
      link:
        "/match-finder?opponent=" +
        encodeURIComponent(recommended.player)
    });

  if (seasonCommand.deadlines.gamesNeededBeforeMidseason > 0)
    actions.push({
      label:
        "Midseason target needs " +
        seasonCommand.deadlines.gamesNeededBeforeMidseason +
        " more games.",
      priority:
        seasonCommand.deadlines.lateStatus === "On Schedule"
          ? "Normal"
          : "High",
      link: "/standings"
    });

  if (seasonCommand.deadlines.seasonEndDeadline)
    actions.push({
      label:
        "Season deadline: " +
        seasonCommand.deadlines.seasonEndDeadline +
        ".",
      priority: "Normal",
      link: "/standings"
    });

  if (currentEvent && currentEvent.registration === "Registration Open")
    actions.push({
      label:
        "Registration is open for " +
        currentEvent.name +
        ".",
      priority: "Normal",
      link: "/standings"
    });

  if (getCommunityPlayerArmyListCount(user.leaguePlayer) === 0)
    actions.push({
      label: "Submit your first Army List.",
      priority: "Normal",
      link: "/army-lists/submit"
    });

  if (activity && activity.news[0])
    actions.push({
      label: "Read the latest commissioner news.",
      priority: "Normal",
      link: activity.news[0].link || "/news"
    });

  if (activity && activity.streams[0])
    actions.push({
      label: "Watch the latest stream.",
      priority: "Low",
      link: activity.streams[0].youtubeUrl || "/streams"
    });

  const submitUrl =
    getCommunityCommandString(settings && settings.googleFormUrl);

  if (submitUrl !== "")
    actions.push({
      label: "Submit a completed game.",
      priority: "Low",
      link: submitUrl
    });

  return actions.slice(0, 5);

}

function buildCommunityActivity(games) {

  const news =
    JSON.parse(
      getCommissionerNews().getContent()
    ).news || [];

  const streams =
    JSON.parse(
      getStreams().getContent()
    ).streams || [];

  const notifications =
    buildLeagueNotifications();

  return {
    latestResults:
      games.slice(0, 3),
    latestAchievements:
      notifications
        .filter(function(notification) {
          return notification.type === "Achievement Unlocked";
        })
        .slice(0, 3),
    news:
      news.slice(0, 3),
    streams:
      streams.slice(0, 3),
    featuredBattle:
      games[0] || null
  };

}

function buildCommunityNudges(user, seasonCommand, currentEvent, activity) {

  const nudges = [];
  const recommended =
    seasonCommand.nextOpponents[0];

  if (recommended)
    nudges.push({
      category: "Priority",
      priority:
        recommended.urgency === "High"
          ? "High"
          : "Normal",
      reason:
        "You still have an unplayed division pairing with " +
        recommended.displayName +
        ".",
      suggestedAction:
        "Schedule " +
        recommended.displayName,
      deepLink:
        "/match-finder?opponent=" +
        encodeURIComponent(recommended.player)
    });

  if (seasonCommand.deadlines.gamesNeededBeforeMidseason > 0)
    nudges.push({
      category: "Deadline",
      priority:
        seasonCommand.deadlines.lateStatus === "On Schedule"
          ? "Normal"
          : "High",
      reason:
        "You need " +
        seasonCommand.deadlines.gamesNeededBeforeMidseason +
        " more games before the Midseason Deadline.",
      suggestedAction: "Review remaining games",
      deepLink: "/standings"
    });

  if (seasonCommand.promotion.status !== "Safe")
    nudges.push({
      category:
        seasonCommand.promotion.promotionZone
          ? "Promotion"
          : "Relegation",
      priority: "High",
      reason:
        "Your current rank is #" +
        seasonCommand.promotion.currentRank +
        " and your table status is " +
        seasonCommand.promotion.status +
        ".",
      suggestedAction: "Review promotion tracker",
      deepLink: "/standings"
    });

  if (
    activity &&
    activity.latestAchievements &&
    activity.latestAchievements[0]
  )
    nudges.push({
      category: "Achievement",
      priority: "Normal",
      reason:
        activity.latestAchievements[0].title,
      suggestedAction: "View achievements",
      deepLink:
        activity.latestAchievements[0].link || "/profile"
    });

  if (currentEvent && currentEvent.registration === "Registration Open")
    nudges.push({
      category: "Tournament",
      priority: "Normal",
      reason:
        "Registration is open for " +
        currentEvent.name +
        ".",
      suggestedAction: "Review event details",
      deepLink: "/standings"
    });

  if (
    seasonCommand.leagueActivity &&
    seasonCommand.leagueActivity.playersCatchingUp &&
    seasonCommand.leagueActivity.playersCatchingUp.length > 0
  )
    nudges.push({
      category: "Community",
      priority: "Low",
      reason:
        seasonCommand.leagueActivity.playersCatchingUp.length +
        " players in your division are still building season progress.",
      suggestedAction: "Find an active opponent",
      deepLink: "/players"
    });

  if (nudges.length === 0)
    nudges.push({
      category: "Status",
      priority: "Low",
      reason: "Not enough information yet.",
      suggestedAction: "Check back after more league activity",
      deepLink: "/"
    });

  return nudges.slice(0, 5);

}

function buildCommunityEventSwitcher(events, currentEvent) {

  return events
    .filter(function(event) {
      return getCommunityCommandString(event.status) !== "";
    })
    .map(function(event) {
      return {
        eventId: event.id,
        label: event.name,
        type: event.type,
        status: event.status,
        active:
          currentEvent &&
          event.id === currentEvent.id,
        link:
          event.id === EVENT_ENGINE_DEFAULT_EVENT_ID
            ? "/standings"
            : "/"
      };
    });

}

function buildCommunitySchedule(seasonCommand, currentEvent) {

  return {
    gamesRemaining:
      seasonCommand.progress.gamesRemaining,
    deadlines:
      seasonCommand.deadlines,
    upcomingEventDates:
      currentEvent
        ? [
            currentEvent.startDate,
            currentEvent.endDate
          ].filter(function(date) {
            return getCommunityCommandString(date) !== "";
          })
        : [],
    currentRound:
      EVENT_ENGINE_DEFAULT_ROUND_ID
  };

}

function buildCommunityIntelligenceSummary(user, seasonCommand) {

  const insights = [];

  if (seasonCommand.player.games > 0)
    insights.push(
      "You are rank #" +
      seasonCommand.player.rank +
      " in " +
      seasonCommand.player.division +
      "."
    );

  if (seasonCommand.nextOpponents[0])
    insights.push(
      seasonCommand.nextOpponents[0].displayName +
      " is your recommended next opponent."
    );

  if (seasonCommand.promotion.status)
    insights.push(
      "Current table status: " +
      seasonCommand.promotion.status +
      "."
    );

  if (user.favoriteFaction)
    insights.push(
      "Favorite faction: " +
      user.favoriteFaction +
      "."
    );

  if (insights.length === 0)
    insights.push("Not enough games played yet.");

  return insights.slice(0, 3);

}

function buildCommunityQuickActions(settings) {

  const submitUrl =
    getCommunityCommandString(settings && settings.googleFormUrl) || "/";

  return [
    {
      label: "Submit Game",
      link: submitUrl
    },
    {
      label: "Submit Army List",
      link: "/army-lists/submit"
    },
    {
      label: "Match Finder",
      link: "/match-finder"
    },
    {
      label: "View Standings",
      link: "/standings"
    },
    {
      label: "View Hall of Fame",
      link: "/hall-of-fame"
    },
    {
      label: "View My Profile",
      link: "/profile"
    },
    {
      label: "Player Intelligence",
      link: "/analytics"
    }
  ];

}

function getCommunityPlayerArmyListCount(playerName) {

  return getArmyListObjects()
    .filter(function(list) {
      return (
        getCommunityCommandString(list.player).toLowerCase() ===
        getCommunityCommandString(playerName).toLowerCase()
      );
    }).length;

}

function getCommunityCommandString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
