/*******************************************************
 * LOBO INFINITY LEAGUE 6.0.3
 * EventHomeApi.gs
 *
 * Event Engine-owned Event Home experience.
 *******************************************************/

function getEventHome(e) {

  const params =
    getApiParameters(e);

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

  ensureEventEngine();

  const event =
    getEventHomeSyntheticEvent(eventId) ||
    getEventByIdSnapshot(eventId) ||
    getCurrentLeagueEventSnapshot();

  const rounds =
    getEventEngineSnapshot()
      .rounds
      .filter(function(round) {
        return round.eventId === event.id;
      });

  const currentRound =
    getEventHomeCurrentRound(rounds);

  const registrations =
    getEventRegistrationRows(event.id);

  const auth =
    getRequestUser(e);

  const currentPlayer =
    auth.authenticated && auth.user.leaguePlayer
      ? getEventRegistrationForPlayer(event.id, auth.user.leaguePlayer)
      : null;

  const games =
    getAllRecentGameObjectsForEvent(event.id);

  const registration =
    buildEventRegistrationPayload(event, registrations, currentPlayer);

  return jsonOutput({
    success: true,
    home: {
      event: event,
      registration: registration,
      currentRound: currentRound,
      rounds: rounds,
      statistics: buildEventHomeStatistics(event, registration, games, rounds),
      timeline: buildEventHomeTimeline(event, registration, rounds, games),
      news: buildEventHomeNews(event, registration, rounds, games),
      quickActions: buildEventHomeQuickActions(event, registration, currentPlayer),
      playerStatus: buildEventHomePlayerStatus(registration, currentPlayer),
      navigation: buildEventHomeNavigation(event)
    }
  });

}

function getEventHomeSyntheticEvent(eventId) {

  const scope =
    String(eventId || "").toLowerCase();

  if (scope !== "lifetime" && scope !== "all")
    return null;

  return {
    id: scope,
    communityId: EVENT_ENGINE_COMMUNITY_ID,
    seriesId: EVENT_ENGINE_DEFAULT_SERIES_ID,
    templateId: "template-lifetime",
    name: scope === "lifetime" ? "Lifetime" : "All Events",
    description: "Aggregate historical view across Event Engine-scoped games.",
    type: "Aggregate",
    lifecycleStage: "Historical",
    status: "Read Only",
    owner: "Commissioner",
    commissioners: "",
    startDate: "",
    endDate: "",
    registration: "Registration Closed",
    participants: "All Events",
    rules: "Aggregate statistics only.",
    scoringModel: "Lifetime aggregate",
    standingsModel: "Career records",
    automation: "",
    discord: "",
    achievements: "Career achievements",
    history: "Lifetime history",
    archive: "Aggregate",
    createdAt: "",
    updatedAt: ""
  };

}

function buildEventHomeStatistics(event, registration, games, rounds) {

  const completedGames =
    games.length;

  return {
    registeredPlayers: registration.registeredCount,
    teams: registration.teamCount,
    completedGames: completedGames,
    gamesRemaining: 0,
    currentRound:
      rounds.length > 0
        ? rounds[0].name
        : "",
    completionPercentage:
      completedGames > 0 ? 100 : 0,
    lifecycleStage: event.lifecycleStage || event.status || "",
    registrationStatus: registration.status
  };

}

function buildEventHomeTimeline(event, registration, rounds, games) {

  const timeline = [
    {
      title: event.name + " created",
      body: event.description || "Event created in the Event Engine.",
      timestamp: event.createdAt || event.updatedAt || "",
      type: "Event"
    }
  ];

  if (event.registration)
    timeline.push({
      title: event.registration,
      body: "Registration status is " + event.registration + ".",
      timestamp: event.updatedAt || "",
      type: "Registration"
    });

  rounds.forEach(function(round) {
    timeline.push({
      title: round.name,
      body: round.status || round.type || "Round configured.",
      timestamp: round.updatedAt || round.createdAt || "",
      type: "Round"
    });
  });

  games.slice(0, 5).forEach(function(game) {
    timeline.push({
      title: game.winnerDisplayName + " defeated " + game.loserDisplayName,
      body: game.mission || "Event game submitted.",
      timestamp: game.date || "",
      type: "Result"
    });
  });

  if (registration.registeredCount > 0)
    timeline.push({
      title: registration.registeredCount + " players registered",
      body: "Registration list updated for " + event.name + ".",
      timestamp: getEventHomeTimestamp(),
      type: "Registration"
    });

  return timeline;

}

function buildEventHomeNews(event, registration, rounds, games) {

  const news = [];

  news.push(event.name + " is currently " + (event.status || "active") + ".");

  if (registration.registrationOpen)
    news.push("Registration is open.");
  else
    news.push(registration.status + ".");

  if (rounds.length > 0)
    news.push(rounds[0].name + " is the current event round.");

  if (games.length > 0)
    news.push(games[0].winnerDisplayName + " submitted the latest event result.");

  return news;

}

function buildEventHomeQuickActions(event, registration, currentPlayer) {

  const actions = [];

  if (registration.registrationOpen && !currentPlayer)
    actions.push({
      label: "Register",
      action: "register",
      href: "/event/" + encodeURIComponent(event.id) + "#registration",
      enabled: true
    });

  if (registration.registrationOpen && currentPlayer)
    actions.push({
      label: "Edit Registration",
      action: "editRegistration",
      href: "/event/" + encodeURIComponent(event.id) + "#registration",
      enabled: true
    });

  actions.push({
    label: "Standings",
    action: "standings",
    href:
      event.type === "Team Tournament"
        ? "/event/" + encodeURIComponent(event.id) + "/tournament#team-tournament-standings"
        : "/standings?eventId=" + encodeURIComponent(event.id),
    enabled: true
  });

  actions.push({
    label: "Results",
    action: "results",
    href: "/event/" + encodeURIComponent(event.id) + "#results",
    enabled: true
  });

  if (event.type === "Team Tournament")
    actions.push({
      label: "Team Tournament",
      action: "teamTournament",
      href: "/event/" + encodeURIComponent(event.id) + "/tournament",
      enabled: true
    });

  return actions;

}

function buildEventHomePlayerStatus(registration, currentPlayer) {

  if (!currentPlayer)
    return {
      registrationStatus: "Not Registered",
      currentTeam: "",
      captain: false,
      upcomingMatch: "Pending Pairings",
      outstandingAction:
        registration.registrationOpen
          ? "Register for this Event."
          : "Registration is closed.",
      notifications: []
    };

  return {
    registrationStatus: currentPlayer.status,
    currentTeam:
      currentPlayer.preferredTeam ||
      currentPlayer.team ||
      "Looking for Team",
    captain: currentPlayer.captain,
    upcomingMatch: "Pending Pairings",
    outstandingAction:
      currentPlayer.status === "Registered"
        ? "Watch for pairings and event updates."
        : "Review your registration status.",
    notifications: []
  };

}

function buildEventHomeNavigation(event) {

  const base =
    "/event/" + encodeURIComponent(event.id);

  const items = [
    ["Overview", base],
    ["Registration", base + "#registration"],
    ["Standings", base + "#standings"],
    ["Results", base + "#results"],
    ["Rules", base + "#rules"],
    ["News", base + "#news"]
  ];

  if (event.type === "Team Tournament") {
    items.splice(2, 0, ["Teams", base + "/tournament#team-tournament-register"]);
    items.splice(3, 0, ["Pairings", base + "/tournament#team-tournament-pairings"]);
  }

  return items.map(function(item) {
    return {
      label: item[0],
      href: item[1]
    };
  });

}

function getEventHomeCurrentRound(rounds) {

  if (rounds.length === 0)
    return null;

  return rounds
    .slice()
    .sort(function(a, b) {
      return (Number(b.number) || 0) - (Number(a.number) || 0);
    })[0];

}

function getEventHomeTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}
