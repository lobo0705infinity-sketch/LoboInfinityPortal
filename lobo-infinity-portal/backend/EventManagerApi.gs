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
    const result = saveCanonicalEventDefinition(params, {
      actor: auth,
      mode: "upsert"
    });

    if (!result.success)
      return jsonOutput(result);

    return buildEventManagerResponse(result.eventId);
  });

}

function provisionEvent(e) {

  if (!isAuthorizedArmyIntelligenceWorkerRequest(e))
    return jsonOutput({
      success: false,
      error: "Event provisioning authorization is required.",
      code: "PROVISIONING_UNAUTHORIZED"
    });

  const params = getApiParameters(e);
  const operation = getEventManagerString(params.operation).toLowerCase();

  if (["create", "update", "read", "validate"].indexOf(operation) === -1)
    return jsonOutput({ success: false, error: "Invalid provisioning operation." });

  const eventId =
    getEventManagerString(params.eventId || params.id) ||
    buildEventManagerEventId(params.name, params.type);

  if (operation === "read")
    return buildEventProvisioningReadResponse(eventId);

  const validation = validateEventProvisioningDefinition(params, operation);
  if (!validation.success)
    return jsonOutput(validation);

  if (operation === "validate")
    return jsonOutput({
      success: true,
      eventId: validation.eventId,
      definition: validation.definition,
      persisted: false
    });

  const result = saveCanonicalEventDefinition(validation.definition, {
    actor: {
      machine: true,
      user: { email: "event-provisioning", role: "Provisioner" }
    },
    mode: operation
  });

  if (!result.success)
    return jsonOutput(result);

  return buildEventProvisioningReadResponse(result.eventId);
}

function validateEventProvisioningDefinition(params, operation) {

  const supportedTypes = [
    "League",
    "Team Tournament",
    "Individual Double Elimination",
    "ITS Tournament",
    "Narrative Campaign",
    "Casual Event",
    "Custom"
  ];
  const lifecycleStages = [
    "Planning", "Registration Open", "Registration Closed", "Roster Locked",
    "Round 1", "Round 2", "Final Round", "Awards", "Archived"
  ];
  const registrationStates = ["Registration Open", "Registration Closed"];
  const name = getEventManagerString(params.name);
  const type = getEventManagerString(params.type);
  const lifecycleStage = getEventManagerString(params.lifecycleStage || params.status) || "Planning";
  const status = getEventManagerString(params.status || params.lifecycleStage) || "Planning";
  const registration = getEventManagerString(params.registration) || "Registration Closed";
  const maximumPlayers = Number(params.maximumPlayers || 0);
  const startDate = getEventManagerString(params.startDate);
  const endDate = getEventManagerString(params.endDate);
  const eventId = buildEventManagerEventId(name, type);

  if (!name)
    return { success: false, error: "Event name is required." };
  if (supportedTypes.indexOf(type) === -1)
    return { success: false, error: "Unsupported event type." };
  if (lifecycleStages.indexOf(lifecycleStage) === -1 || lifecycleStages.indexOf(status) === -1)
    return { success: false, error: "Invalid event lifecycle or status." };
  if (registrationStates.indexOf(registration) === -1)
    return { success: false, error: "Invalid registration state." };
  if (!Number.isInteger(maximumPlayers) || maximumPlayers <= 0)
    return { success: false, error: "Maximum Players must be a positive whole number." };
  if ((startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) ||
      (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) ||
      (startDate && endDate && endDate < startDate))
    return { success: false, error: "Event dates are invalid." };
  if (!eventId)
    return { success: false, error: "Canonical event ID could not be generated." };

  return {
    success: true,
    eventId: eventId,
    definition: {
      eventId: eventId,
      name: name,
      type: type,
      description: getEventManagerString(params.description),
      lifecycleStage: lifecycleStage,
      status: status,
      registration: registration,
      startDate: startDate,
      endDate: endDate,
      rules: "Maximum Players: " + maximumPlayers,
      maximumPlayers: maximumPlayers
    }
  };
}

function saveCanonicalEventDefinition(params, options) {

  const mode = getEventManagerString(options && options.mode).toLowerCase() || "upsert";
  const existingId = getEventManagerString(params.eventId || params.id);
  const eventId = existingId || buildEventManagerEventId(params.name, params.type);

  if (!eventId)
    return { success: false, error: "Event name is required." };

  const existing = getEventByIdSnapshot(eventId);
  if (mode === "create" && existing)
    return { success: false, error: "Event already exists." };
  if (mode === "update" && !existing)
    return { success: false, error: "Event not found." };

  const now = getEventManagerTimestamp();
  const eventName = getEventManagerString(params.name) || (existing ? existing.name : "");
  if (!eventName)
    return { success: false, error: "Event name is required." };

  const eventType = getEventManagerString(params.type) || (existing ? existing.type : "Custom");
  const templateId = getEventManagerTemplateId(eventType);

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
      getEventManagerString(params.description) || (existing ? existing.description : ""),
      eventType,
      getEventManagerString(params.lifecycleStage) || (existing ? existing.lifecycleStage : "Planning"),
      getEventManagerString(params.status) || (existing ? existing.status : "Planning"),
      getEventManagerString(params.owner) || (existing ? existing.owner : "Commissioner"),
      getEventManagerString(params.commissioners) || (existing ? existing.commissioners : ""),
      getEventManagerString(params.startDate) || (existing ? existing.startDate : ""),
      getEventManagerString(params.endDate) || (existing ? existing.endDate : ""),
      getEventManagerString(params.registration) || (existing ? existing.registration : "Registration Closed"),
      getEventManagerString(params.participants) || (existing ? existing.participants : "Event Participants"),
      getEventManagerString(params.rules) || (existing ? existing.rules : eventType + " rules"),
      getEventManagerString(params.scoringModel) || (existing ? existing.scoringModel : "Event scoring"),
      getEventManagerString(params.standingsModel) || (existing ? existing.standingsModel : "Event standings"),
      getEventManagerString(params.automation) || (existing ? existing.automation : "Existing Automation Center"),
      getEventManagerString(params.discord) || (existing ? existing.discord : "Existing Discord configuration"),
      getEventManagerString(params.achievements) || (existing ? existing.achievements : "Event scoped achievements"),
      getEventManagerString(params.history) || (existing ? existing.history : eventType + " history"),
      getEventManagerString(params.archive) || (existing ? existing.archive : "Not archived"),
      existing && existing.createdAt ? existing.createdAt : now,
      now
    ]
  );

  ensureEventManagerEventDefaults(eventId, eventName, eventType);
  recordEventManagerAudit(options && options.actor, eventId, "Event saved", eventName);
  invalidateEventManagerCaches();

  return { success: true, eventId: eventId };
}

function buildEventProvisioningReadResponse(eventId) {

  if (!eventId)
    return jsonOutput({ success: false, error: "Event name or event ID is required." });

  const event = getEventByIdSnapshot(eventId);
  if (!event)
    return jsonOutput({ success: false, error: "Event not found." });

  const participants = getEventRegistrationRows(eventId).filter(function(entry) {
    return entry.status !== "Withdrawn";
  });
  const capacity = typeof getEventRegistrationCapacity === "function"
    ? getEventRegistrationCapacity(event)
    : { maximumPlayers: 0 };

  return jsonOutput({
    success: true,
    event: event,
    eventId: event.id,
    maximumPlayers: capacity.maximumPlayers,
    participantCount: participants.length
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

    if (getEventManagerString(params.seedAssignments) !== "")
      return saveEventManagerSeeding_(eventId, params.seedAssignments, auth);

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

function saveEventManagerSeeding_(eventId, serializedAssignments, auth) {

  const event = getEventById(eventId);

  if (!event || event.type !== "Individual Double Elimination")
    throw new Error("Tournament seeding is only available for Individual Double Elimination events.");

  let assignments;

  try {
    assignments = JSON.parse(serializedAssignments);
  } catch (error) {
    throw new Error("Seed assignments are invalid.");
  }

  if (!Array.isArray(assignments))
    throw new Error("Seed assignments are invalid.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_PARTICIPANTS,
      EVENT_ENGINE_PARTICIPANT_HEADERS
    );
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(getEventManagerString);
    const eventIdIndex = headers.indexOf("Event ID");
    const playerIndex = headers.indexOf("Player");
    const seedIndex = headers.indexOf("Seed");
    const statusIndex = headers.indexOf("Status");
    const registeredPlayers = [];

    for (let row = 1; row < data.length; row++) {
      if (
        getEventManagerString(data[row][eventIdIndex]) === eventId &&
        getEventManagerString(data[row][statusIndex]) === "Registered"
      )
        registeredPlayers.push(getEventManagerString(data[row][playerIndex]));
    }

    const validationError = validateEventManagerSeedAssignments_(
      assignments,
      registeredPlayers
    );

    if (validationError !== "")
      throw new Error(validationError);

    const seedsByPlayer = {};
    assignments.forEach(function(assignment) {
      seedsByPlayer[getEventManagerString(assignment.player).toLowerCase()] =
        Number(assignment.seed);
    });

    const seedValues = [];
    for (let row = 1; row < data.length; row++) {
      const isTarget =
        getEventManagerString(data[row][eventIdIndex]) === eventId &&
        getEventManagerString(data[row][statusIndex]) === "Registered";
      const playerKey = getEventManagerString(data[row][playerIndex]).toLowerCase();
      seedValues.push([
        isTarget ? seedsByPlayer[playerKey] : data[row][seedIndex]
      ]);
    }

    if (seedValues.length > 0)
      sheet.getRange(2, seedIndex + 1, seedValues.length, 1).setValues(seedValues);

    SpreadsheetApp.flush();
    recordEventManagerAudit(auth, eventId, "Tournament seeding updated", assignments.length + " players");
    invalidateEventManagerCaches();
  } finally {
    lock.releaseLock();
  }

  return buildEventManagerResponse(eventId);

}

function validateEventManagerSeedAssignments_(assignments, registeredPlayers) {

  const playerKeys = {};
  const seedKeys = {};
  const registeredKeys = {};
  const count = registeredPlayers.length;
  const error = "Every registered player must have a unique seed from 1 to " + count + ".";

  if (count === 0)
    return "No registered players to seed.";

  registeredPlayers.forEach(function(player) {
    registeredKeys[getEventManagerString(player).toLowerCase()] = true;
  });

  if (assignments.length !== count)
    return error;

  for (let index = 0; index < assignments.length; index++) {
    const playerKey = getEventManagerString(assignments[index].player).toLowerCase();
    const seed = Number(assignments[index].seed);

    if (
      playerKey === "" ||
      !registeredKeys[playerKey] ||
      playerKeys[playerKey] ||
      !Number.isInteger(seed) ||
      seed < 1 ||
      seed > count ||
      seedKeys[seed]
    )
      return error;

    playerKeys[playerKey] = true;
    seedKeys[seed] = true;
  }

  return "";

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

    const existingPairings =
      getTeamTournamentPairings(eventId);

    const existingPairing =
      existingPairings.find(function(pairing) {
        return (
          getTeamTournamentString(pairing.roundId) === roundId &&
          getTeamTournamentString(pairing.teamA).toLowerCase() === teamA.toLowerCase() &&
          getTeamTournamentString(pairing.teamB).toLowerCase() === teamB.toLowerCase()
        );
      });

    const playerPairings =
      getEventManagerString(params.playerPairings) ||
      (existingPairing ? getTeamTournamentString(existingPairing.playerPairings) : "");

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
        playerPairings,
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
    buildEventRegistrationPayload(
      selected,
      registrations,
      null,
      {
        includeRegistrationDetails: true
      }
    );

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
    leagueOperations:
      typeof buildLeagueOperationsPayload === "function"
        ? buildLeagueOperationsPayload(getLeagueOperationsCurrentRow())
        : {},
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
      getEventManagerTimestamp(),
      ""
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

  if (typeof invalidateEventEngineSnapshotCache === "function")
    invalidateEventEngineSnapshotCache();

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
          ? auth.user.email || getCanonicalPlayerFromUser(auth.user) || "Commissioner"
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
