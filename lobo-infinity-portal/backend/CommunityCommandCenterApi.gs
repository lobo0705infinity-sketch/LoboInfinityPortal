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

  const events =
    ensureEventEngine().events;

  const currentEvent =
    getCurrentLeagueEvent();

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
      nextActions:
        buildCommunityNextActions(
          auth.user,
          seasonCommand,
          currentEvent
        ),
      communityActivity:
        buildCommunityActivity(context.games),
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
        buildCommunityQuickActions()
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
        link:
          event.id === EVENT_ENGINE_DEFAULT_EVENT_ID
            ? "/standings"
            : "/"
      };
    });

}

function buildCommunityOpponentTracker(seasonCommand, games) {

  return {
    completed:
      seasonCommand.opponents
        .filter(function(opponent) {
          return opponent.status === "Already Played";
        })
        .map(function(opponent) {
          return buildCommunityOpponentCard(opponent, games);
        }),
    remaining:
      seasonCommand.opponents
        .filter(function(opponent) {
          return opponent.status !== "Already Played";
        })
        .map(function(opponent) {
          return buildCommunityOpponentCard(opponent, games);
        }),
    suggested:
      seasonCommand.nextOpponents[0] || null
  };

}

function buildCommunityOpponentCard(opponent, games) {

  const recent =
    games.filter(function(game) {
      const player =
        getCommunityCommandString(opponent.player).toLowerCase();

      return (
        getCommunityCommandString(game.winner).toLowerCase() === player ||
        getCommunityCommandString(game.loser).toLowerCase() === player
      );
    })[0] || null;

  return {
    player: opponent.player,
    displayName:
      opponent.displayName ||
      opponent.player,
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
    quickMessage:
      "Message"
  };

}

function buildCommunityNextActions(user, seasonCommand, currentEvent) {

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
        "/players/" +
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
      link: "/"
    });

  if (seasonCommand.deadlines.seasonEndDeadline)
    actions.push({
      label:
        "Season deadline: " +
        seasonCommand.deadlines.seasonEndDeadline +
        ".",
      priority: "Normal",
      link: "/"
    });

  if (currentEvent && currentEvent.registration === "Registration Open")
    actions.push({
      label:
        "Registration is open for " +
        currentEvent.name +
        ".",
      priority: "Normal",
      link: "/"
    });

  if (getCommunityPlayerArmyListCount(user.leaguePlayer) === 0)
    actions.push({
      label: "Submit your first Army List.",
      priority: "Normal",
      link: "/army-lists/submit"
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

function buildCommunityQuickActions() {

  return [
    {
      label: "Submit Game",
      link: "/"
    },
    {
      label: "Submit Army List",
      link: "/army-lists/submit"
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
