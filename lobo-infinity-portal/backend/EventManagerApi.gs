/*******************************************************
 * LOBO INFINITY LEAGUE 6.0.3
 * EventManagerApi.gs
 *
 * Commissioner Event Manager for the Multi-Event Platform.
 *******************************************************/

function getEventManager(e) {

  return requireApiPermission(e, "viewOperations", function() {
    const params =
      getApiParameters(e);

    const selectedEventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

    return buildEventManagerResponse(selectedEventId);
  });

}

function saveEventManagerEvent(e) {

  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params =
      getApiParameters(e);

    const existingId =
      getEventManagerString(params.eventId || params.id);

    const eventId =
      existingId ||
      buildEventManagerEventId(params.name, params.type);

    if (eventId === "")
      return jsonOutput({
        success: false,
        error: "Event name is required."
      });

    const existing =
      getEventByIdSnapshot(eventId);

    const now =
      getEventManagerTimestamp();

    const eventName =
      getEventManagerString(params.name) ||
      (existing ? existing.name : "");

    if (eventName === "")
      return jsonOutput({
        success: false,
        error: "Event name is required."
      });

    const eventType =
      getEventManagerString(params.type) ||
      (existing ? existing.type : "Custom");

    const templateId =
      getEventManagerTemplateId(eventType);

    upsertEventEngineRow(
      ensureEventEngineSheet(CONFIG.SHEETS.EVENTS, EVENT_ENGINE_EVENT_HEADERS),
      EVENT_ENGINE_EVENT_HEADERS,
      "ID",
      eventId,
      [
        eventId,
        existing ? existing.communityId : EVENT_ENGINE_COMMUNITY_ID,
        existing ? existing.seriesId : EVENT_ENGINE_DEFAULT_SERIES_ID,
        existing ? existing.templateId : templateId,
        eventName,
        getEventManagerString(params.description) ||
          (existing ? existing.description : ""),
        eventType,
        getEventManagerString(params.lifecycleStage) ||
          (existing ? existing.lifecycleStage : "Planning"),
        getEventManagerString(params.status) ||
          (existing ? existing.status : "Planning"),
        getEventManagerString(params.owner) ||
          (existing ? existing.owner : "Commissioner"),
        getEventManagerString(params.commissioners) ||
          (existing ? existing.commissioners : ""),
        getEventManagerString(params.startDate) ||
          (existing ? existing.startDate : ""),
        getEventManagerString(params.endDate) ||
          (existing ? existing.endDate : ""),
        getEventManagerString(params.registration) ||
          (existing ? existing.registration : "Registration Closed"),
        getEventManagerString(params.participants) ||
          (existing ? existing.participants : "Event Participants"),
        getEventManagerString(params.rules) ||
          (existing ? existing.rules : eventType + " rules"),
        getEventManagerString(params.scoringModel) ||
          (existing ? existing.scoringModel : "Event scoring"),
        getEventManagerString(params.standingsModel) ||
          (existing ? existing.standingsModel : "Event standings"),
        getEventManagerString(params.automation) ||
          (existing ? existing.automation : "Existing Automation Center"),
        getEventManagerString(params.discord) ||
          (existing ? existing.discord : "Existing Discord configuration"),
        getEventManagerString(params.achievements) ||
          (existing ? existing.achievements : "Event scoped achievements"),
        getEventManagerString(params.history) ||
          (existing ? existing.history : eventType + " history"),
        getEventManagerString(params.archive) ||
          (existing ? existing.archive : "Not archived"),
        existing && existing.createdAt ? existing.createdAt : now,
        now
      ]
    );

    ensureEventManagerEventDefaults(eventId, eventName, eventType);
    recordEventManagerAudit(auth, eventId, "Event saved", eventName);
    invalidateEventManagerCaches();

    return buildEventManagerResponse(eventId);
  });

}

function setEventManagerRegistration(e) {

  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

    const registration =
      getEventManagerString(params.registration) ||
      "Registration Closed";

    const fields = {
      "Registration": registration
    };

    if (registration === "Registration Open") {
      fields["Lifecycle Stage"] = "Registration Open";
      fields["Status"] = "Registration Open";
    }

    if (registration === "Registration Closed") {
      fields["Lifecycle Stage"] = "Registration Closed";
      fields["Status"] = "Registration Closed";
    }

    updateEventManagerEventFields(eventId, fields);

    recordEventManagerAudit(auth, eventId, "Registration updated", registration);
    invalidateEventManagerCaches();

    return buildEventManagerResponse(eventId);
  });

}

function setEventManagerLifecycle(e) {

  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

    const fields = {};

    if (getEventManagerString(params.lifecycleStage) !== "")
      fields["Lifecycle Stage"] = getEventManagerString(params.lifecycleStage);

    if (getEventManagerString(params.status) !== "")
      fields["Status"] = getEventManagerString(params.status);

    if (getEventManagerString(params.archive) !== "")
      fields["Archive"] = getEventManagerString(params.archive);

    if (Object.keys(fields).length === 0)
      return jsonOutput({
        success: false,
        error: "No lifecycle changes were provided."
      });

    updateEventManagerEventFields(eventId, fields);

    recordEventManagerAudit(
      auth,
      eventId,
      "Lifecycle updated",
      JSON.stringify(fields)
    );
    invalidateEventManagerCaches();

    return buildEventManagerResponse(eventId);
  });

}

function setEventManagerCurrentEvent(e) {

  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

    const sheet =
      ensureEventEngineSheet(CONFIG.SHEETS.EVENTS, EVENT_ENGINE_EVENT_HEADERS);

    const data =
      sheet.getDataRange().getValues();

    const headers =
      data[0].map(getEventManagerString);

    const idIndex =
      headers.indexOf("ID");

    const statusIndex =
      headers.indexOf("Status");

    const updatedAtIndex =
      headers.indexOf("Updated At");

    for (let row = 1; row < data.length; row++) {
      if (
        getEventManagerString(data[row][statusIndex]) ===
        "Current Active Event"
      ) {
        sheet
          .getRange(row + 1, statusIndex + 1)
          .setValue("Active");

        if (updatedAtIndex !== -1)
          sheet
            .getRange(row + 1, updatedAtIndex + 1)
            .setValue(getEventManagerTimestamp());
      }

      if (
        idIndex !== -1 &&
        getEventManagerString(data[row][idIndex]) === eventId
      ) {
        sheet
          .getRange(row + 1, statusIndex + 1)
          .setValue("Current Active Event");

        if (updatedAtIndex !== -1)
          sheet
            .getRange(row + 1, updatedAtIndex + 1)
            .setValue(getEventManagerTimestamp());
      }
    }

    recordEventManagerAudit(auth, eventId, "Current event selected", eventId);
    invalidateEventManagerCaches();

    return buildEventManagerResponse(eventId);
  });

}

function saveEventManagerParticipant(e) {

  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

    const player =
      getEventManagerString(params.player);

    if (player === "")
      return jsonOutput({
        success: false,
        error: "Player is required."
      });

    const user = {
      email: getEventManagerString(params.email),
      leaguePlayer: player,
      playerDisplayName:
        getEventManagerString(params.displayName) ||
        player
    };

    upsertEventRegistrationRow(
      eventId,
      user,
      params,
      getEventManagerString(params.status) || "Registered"
    );

    recordEventManagerAudit(auth, eventId, "Participant updated", player);
    invalidateEventManagerCaches();

    return buildEventManagerResponse(eventId);
  });

}

function saveEventManagerTeam(e) {

  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

    const teamName =
      getEventManagerString(params.teamName);

    if (teamName === "")
      return jsonOutput({
        success: false,
        error: "Team name is required."
      });

    const teamId =
      getEventManagerString(params.teamId) ||
      "team-" +
      Utilities.getUuid();

    upsertTeamTournamentCompositeRow(
      ensureTeamTournamentTeamsSheet(),
      TEAM_TOURNAMENT_TEAM_HEADERS,
      [
        "Event ID",
        "Team ID"
      ],
      [
        eventId,
        teamId
      ],
      [
        eventId,
        teamId,
        teamName,
        getEventManagerString(params.captain),
        getEventManagerString(params.players),
        getEventManagerString(params.factionRestrictions),
        getEventManagerString(params.logoUrl),
        getEventManagerString(params.discordContact),
        getEventManagerString(params.status) || "Registered",
        getEventManagerTimestamp(),
        getEventManagerTimestamp()
      ]
    );

    recordEventManagerAudit(auth, eventId, "Team saved", teamName);
    invalidateEventManagerCaches();

    return buildEventManagerResponse(eventId);
  });

}

function saveEventManagerPairing(e) {

  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

    const teamA =
      getEventManagerString(params.teamA);

    const teamB =
      getEventManagerString(params.teamB);

    if (teamA === "" || teamB === "")
      return jsonOutput({
        success: false,
        error: "Both teams are required."
      });

    const roundId =
      getEventManagerString(params.roundId) ||
      EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ROUND_ID;

    upsertTeamTournamentCompositeRow(
      ensureTeamTournamentPairingsSheet(),
      TEAM_TOURNAMENT_PAIRING_HEADERS,
      [
        "Event ID",
        "Round ID",
        "Team A",
        "Team B"
      ],
      [
        eventId,
        roundId,
        teamA,
        teamB
      ],
      [
        eventId,
        roundId,
        getEventManagerString(params.round) || "Round 1",
        teamA,
        teamB,
        getEventManagerString(params.playerPairings),
        getEventManagerString(params.status) || "Scheduled",
        getEventManagerString(params.results),
        getEventManagerTimestamp(),
        getEventManagerTimestamp()
      ]
    );

    recordEventManagerAudit(
      auth,
      eventId,
      "Pairing saved",
      teamA + " vs " + teamB
    );
    invalidateEventManagerCaches();

    return buildEventManagerResponse(eventId);
  });

}

function buildEventManagerResponse(selectedEventId) {

  ensureEventEngine();

  if (typeof SpreadsheetApp !== "undefined")
    SpreadsheetApp.flush();

  if (typeof ensureTeamTournamentSheets === "function")
    ensureTeamTournamentSheets();

  const engine =
    getEventEngineSnapshot();

  const selectedEvent =
    getEventByIdSnapshot(selectedEventId) ||
    getCurrentLeagueEventSnapshot(engine);

  return jsonOutput({
    success: true,
    manager: buildEventManagerPayload(engine, selectedEvent)
  });

}

function buildEventManagerPayload(engine, selectedEvent) {

  const events =
    engine.events
      .map(function(event) {
        return buildEventManagerEventSummary(event, engine);
      });

  const selected =
    selectedEvent || engine.events[0] || buildDefaultCurrentLeagueEventObject();

  const registrations =
    getEventRegistrationRows(selected.id);

  const registration =
    buildEventRegistrationPayload(selected, registrations, null);

  const teams =
    selected.type === "Team Tournament" && typeof getTeamTournamentTeams === "function"
      ? getTeamTournamentTeams(selected.id)
      : [];

  const pairings =
    selected.type === "Team Tournament" && typeof getTeamTournamentPairings === "function"
      ? getTeamTournamentPairings(selected.id)
      : [];

  const rounds =
    engine.rounds
      .filter(function(round) {
        return round.eventId === selected.id;
      });

  const completedGames =
    getAllRecentGameObjectsForEvent(selected.id).length;

  return {
    generatedAt: getEventManagerTimestamp(),
    currentEvent:
      getCurrentLeagueEventSnapshot(engine),
    selectedEvent: selected,
    events: events,
    registration: registration,
    participants: registrations,
    teams: teams,
    pairings: pairings,
    rounds: rounds,
    quickActions: buildEventManagerQuickActions(selected),
    diagnostics: {
      eventId: selected.id,
      lifecycleStage: selected.lifecycleStage,
      registrationStatus: selected.registration,
      participantCount: registrations.length,
      teamCount: teams.length,
      pairingCount: pairings.length,
      completedGames: completedGames,
      cacheGroup: "events",
      eventHealth:
        selected.archive === "Archived"
          ? "Archived"
          : "Operational",
      lastUpdate: selected.updatedAt || selected.createdAt || ""
    }
  };

}

function buildEventManagerEventSummary(event, engine) {

  const registrations =
    getEventRegistrationRows(event.id);

  const teams =
    event.type === "Team Tournament" && typeof getTeamTournamentTeams === "function"
      ? getTeamTournamentTeams(event.id)
      : [];

  const rounds =
    engine.rounds
      .filter(function(round) {
        return round.eventId === event.id;
      });

  const completedGames =
    getAllRecentGameObjectsForEvent(event.id).length;

  return {
    event: event,
    registrationStatus: event.registration,
    participantCount: registrations.filter(function(registration) {
      return registration.status !== "Withdrawn";
    }).length,
    teamCount: teams.length,
    currentRound:
      rounds.length > 0
        ? rounds[0]
        : null,
    completionPercentage:
      registrations.length > 0
        ? Math.min(100, Math.round((completedGames / registrations.length) * 100))
        : 0,
    completedGames: completedGames
  };

}

function buildEventManagerQuickActions(event) {

  return [
    {
      action: "openRegistration",
      label: "Open Registration",
      enabled: event.registration !== "Registration Open"
    },
    {
      action: "closeRegistration",
      label: "Close Registration",
      enabled: event.registration !== "Registration Closed"
    },
    {
      action: "activateEvent",
      label: "Set Current Active Event",
      enabled: event.status !== "Current Active Event"
    },
    {
      action: "archiveEvent",
      label: "Archive Event",
      enabled: event.archive !== "Archived"
    }
  ];

}

function updateEventManagerEventFields(eventId, fields) {

  const sheet =
    ensureEventEngineSheet(CONFIG.SHEETS.EVENTS, EVENT_ENGINE_EVENT_HEADERS);

  const data =
    sheet.getDataRange().getValues();

  const headers =
    data[0].map(getEventManagerString);

  const idIndex =
    headers.indexOf("ID");

  let targetRow =
    -1;

  for (let row = 1; row < data.length; row++) {
    if (getEventManagerString(data[row][idIndex]) === eventId) {
      targetRow =
        row + 1;
      break;
    }
  }

  if (targetRow === -1)
    throw new Error("Event not found: " + eventId);

  Object.keys(fields).forEach(function(header) {
    const index =
      headers.indexOf(header);

    if (index !== -1)
      sheet
        .getRange(targetRow, index + 1)
        .setValue(fields[header]);
  });

  const updatedAtIndex =
    headers.indexOf("Updated At");

  if (updatedAtIndex !== -1)
    sheet
      .getRange(targetRow, updatedAtIndex + 1)
      .setValue(getEventManagerTimestamp());

}

function ensureEventManagerEventDefaults(eventId, eventName, eventType) {

  const seasonId =
    "season-" + eventId.replace(/^event-/, "");

  const roundId =
    "round-" + eventId.replace(/^event-/, "") + "-1";

  upsertEventEngineRow(
    ensureEventEngineSheet(CONFIG.SHEETS.EVENT_SEASONS, EVENT_ENGINE_SEASON_HEADERS),
    EVENT_ENGINE_SEASON_HEADERS,
    "ID",
    seasonId,
    [
      seasonId,
      eventId,
      eventName,
      1,
      "",
      "",
      "Planning",
      "Planning",
      eventType + " season rules",
      "Event reminders",
      getEventManagerTimestamp(),
      getEventManagerTimestamp()
    ]
  );

  upsertEventEngineRow(
    ensureEventEngineSheet(CONFIG.SHEETS.EVENT_ROUNDS, EVENT_ENGINE_ROUND_HEADERS),
    EVENT_ENGINE_ROUND_HEADERS,
    "ID",
    roundId,
    [
      roundId,
      eventId,
      seasonId,
      "Round 1",
      1,
      eventType === "Team Tournament" ? "Team Round" : "Event Round",
      "",
      "",
      "Planning",
      "Pairings and games resolve here.",
      "Event automation",
      getEventManagerTimestamp(),
      getEventManagerTimestamp()
    ]
  );

}

function getEventManagerTemplateId(eventType) {

  const normalized =
    getEventManagerString(eventType).toLowerCase();

  if (normalized === "league")
    return EVENT_ENGINE_DEFAULT_TEMPLATE_ID;

  if (normalized === "team tournament")
    return "template-team-tournament";

  return "template-custom-event";

}

function buildEventManagerEventId(name, type) {

  const base =
    getEventManagerString(name || type)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  if (base === "")
    return "";

  return "event-" + base;

}

function invalidateEventManagerCaches() {

  invalidatePortalCacheGroup("events");

  if (typeof invalidateEventRegistrationCaches === "function")
    invalidateEventRegistrationCaches();

}

function recordEventManagerAudit(auth, eventId, action, detail) {

  if (typeof recordReliabilityAuditEntry !== "function")
    return;

  recordReliabilityAuditEntry(
    action,
    "success",
    "Event Manager",
    {
      eventId: eventId,
      detail: detail,
      actor:
        auth && auth.user
          ? auth.user.email || auth.user.leaguePlayer || "Commissioner"
          : "Commissioner"
    }
  );

}

function getEventManagerTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getEventManagerString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
