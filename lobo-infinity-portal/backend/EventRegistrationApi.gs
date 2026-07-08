/*******************************************************
 * LOBO INFINITY LEAGUE 6.0.2
 * EventRegistrationApi.gs
 *
 * Event Engine-owned registration workflow.
 *******************************************************/

function getEventRegistration(e) {

  const params =
    getApiParameters(e);

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

  ensureEventEngine();

  const event =
    getEventByIdSnapshot(eventId) ||
    getCurrentLeagueEventSnapshot();

  const registrations =
    getEventRegistrationRows(eventId);

  const auth =
    getRequestUser(e);

  const currentPlayer =
    auth.authenticated && auth.user.leaguePlayer
      ? getEventRegistrationForPlayer(eventId, auth.user.leaguePlayer)
      : null;

  return jsonOutput({
    success: true,
    registration: buildEventRegistrationPayload(event, registrations, currentPlayer)
  });

}

function registerForEvent(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const params =
    getApiParameters(e);

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

  const event =
    getEventByIdSnapshot(eventId) ||
    getCurrentLeagueEventSnapshot();

  if (!isEventRegistrationOpen(event))
    return jsonOutput({
      success: false,
      error: "Registration is closed for this Event."
    });

  const status =
    resolveEventRegistrationStatus(eventId, event, auth.user.leaguePlayer);

  upsertEventRegistrationRow(eventId, auth.user, params, status);

  invalidateEventRegistrationCaches();

  return getEventRegistration({
    parameter: {
      eventId: eventId
    }
  });

}

function withdrawEventRegistration(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const params =
    getApiParameters(e);

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

  const event =
    getEventByIdSnapshot(eventId) ||
    getCurrentLeagueEventSnapshot();

  if (!isEventRegistrationOpen(event))
    return jsonOutput({
      success: false,
      error: "Registration is closed for this Event."
    });

  const registration =
    getEventRegistrationForPlayer(eventId, auth.user.leaguePlayer);

  if (!registration)
    return jsonOutput({
      success: false,
      error: "You are not registered for this Event."
    });

  upsertEventRegistrationRow(
    eventId,
    auth.user,
    {
      teamName: registration.team,
      preferredTeam: registration.preferredTeam,
      discord: registration.discord,
      captain: registration.captain,
      freeAgent: registration.freeAgent,
      faction: registration.faction,
      notes: registration.notes
    },
    "Withdrawn"
  );

  invalidateEventRegistrationCaches();

  return getEventRegistration({
    parameter: {
      eventId: eventId
    }
  });

}

function manageEventRegistration(e) {

  return requireApiPermission(e, "runSeasonControl", function() {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

    const player =
      getEventRegistrationString(params.player);

    if (player === "")
      return jsonOutput({
        success: false,
        error: "Player is required."
      });

    const user = {
      email: getEventRegistrationString(params.email),
      leaguePlayer: player,
      playerDisplayName:
        getEventRegistrationString(params.displayName) ||
        player
    };

    upsertEventRegistrationRow(
      eventId,
      user,
      params,
      getEventRegistrationString(params.status) || "Registered"
    );

    invalidateEventRegistrationCaches();

    return getEventRegistration({
      parameter: {
        eventId: eventId
      }
    });
  });

}

function exportEventRegistrations(e) {

  return requireApiPermission(e, "viewOperations", function() {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

    const registrations =
      getEventRegistrationRows(eventId);

    return jsonOutput({
      success: true,
      eventId: eventId,
      registrations: registrations
    });
  });

}

function buildEventRegistrationPayload(event, registrations, currentPlayer) {

  const activeRegistrations =
    registrations.filter(function(registration) {
      return registration.status !== "Withdrawn";
    });

  const registered =
    activeRegistrations.filter(function(registration) {
      return registration.status === "Registered";
    });

  const waitlisted =
    activeRegistrations.filter(function(registration) {
      return registration.status === "Waitlisted";
    });

  const teams =
    getEventRegistrationTeamSummary(activeRegistrations);

  const capacity =
    getEventRegistrationCapacity(event);

  return {
    eventId: event.id,
    eventName: event.name,
    eventType: event.type,
    status: getEventRegistrationStatusLabel(event, capacity, registered.length),
    registrationOpen: isEventRegistrationOpen(event),
    registrationWindow: {
      startDate: event.startDate || "",
      endDate: event.endDate || ""
    },
    capacity: capacity,
    registeredCount: registered.length,
    waitlistCount: waitlisted.length,
    teamCount: teams.length,
    currentPlayer: currentPlayer,
    registrations: registrations,
    teams: teams,
    freeAgents:
      activeRegistrations.filter(function(registration) {
        return registration.freeAgent === true;
      }),
    captains:
      activeRegistrations.filter(function(registration) {
        return registration.captain === true;
      })
  };

}

function upsertEventRegistrationRow(eventId, user, params, status) {

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_PARTICIPANTS,
      EVENT_ENGINE_PARTICIPANT_HEADERS
    );

  const now =
    getEventRegistrationTimestamp();

  const existing =
    getEventRegistrationForPlayer(eventId, user.leaguePlayer);

  const registeredAt =
    existing && existing.registeredAt
      ? existing.registeredAt
      : now;

  const team =
    getEventRegistrationString(params.teamName || params.team);

  const preferredTeam =
    getEventRegistrationString(params.preferredTeam || team);

  upsertEventRegistrationCompositeRow(
    sheet,
    EVENT_ENGINE_PARTICIPANT_HEADERS,
    [
      "Event ID",
      "Player"
    ],
    [
      eventId,
      user.leaguePlayer
    ],
    [
      eventId,
      user.leaguePlayer,
      user.playerDisplayName || user.leaguePlayer,
      getEventRegistrationString(params.role) || "Player",
      status,
      registeredAt,
      getEventRegistrationString(params.seed),
      team,
      getEventRegistrationString(params.notes),
      getEventRegistrationString(user.email),
      getEventRegistrationString(params.discord),
      preferredTeam,
      getEventRegistrationBoolean(params.captain),
      getEventRegistrationBoolean(params.freeAgent),
      getEventRegistrationString(params.faction),
      now
    ]
  );

}

function getEventRegistrationRows(eventId) {

  const target =
    getEventRegistrationString(eventId);

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_PARTICIPANTS,
      EVENT_ENGINE_PARTICIPANT_HEADERS
    );

  return getEventEngineRows(sheet)
    .filter(function(row) {
      return row["Event ID"] === target;
    })
    .map(function(row) {
      return mapEventRegistrationRow(row);
    });

}

function getEventRegistrationForPlayer(eventId, player) {

  const target =
    getEventRegistrationString(player).toLowerCase();

  return getEventRegistrationRows(eventId)
    .filter(function(registration) {
      return registration.player.toLowerCase() === target;
    })[0] || null;

}

function mapEventRegistrationRow(row) {

  return {
    eventId: row["Event ID"],
    player: row["Player"],
    displayName: row["Display Name"] || row["Player"],
    role: row["Role"] || "Player",
    status: row["Status"] || "Registered",
    registeredAt: row["Registered At"],
    seed: row["Seed"],
    team: row["Team"],
    notes: row["Notes"],
    email: row["Email"],
    discord: row["Discord"],
    preferredTeam: row["Preferred Team"] || row["Team"],
    captain: getEventRegistrationBoolean(row["Captain"]),
    freeAgent: getEventRegistrationBoolean(row["Free Agent"]),
    faction: row["Faction"],
    updatedAt: row["Updated At"] || row["Registered At"]
  };

}

function resolveEventRegistrationStatus(eventId, event, player) {

  const existing =
    getEventRegistrationForPlayer(eventId, player);

  if (existing && existing.status === "Waitlisted")
    return "Waitlisted";

  const capacity =
    getEventRegistrationCapacity(event);

  if (
    capacity.maximumPlayers > 0 &&
    getEventRegistrationRows(eventId).filter(function(registration) {
      return registration.status === "Registered";
    }).length >= capacity.maximumPlayers
  )
    return capacity.waitlistEnabled ? "Waitlisted" : "Capacity Full";

  return "Registered";

}

function getEventRegistrationCapacity(event) {

  const rules =
    getEventRegistrationString(event.rules);

  const playerMatch =
    rules.match(/max(?:imum)? players\s*[:=]\s*(\d+)/i);

  const teamMatch =
    rules.match(/max(?:imum)? teams\s*[:=]\s*(\d+)/i);

  return {
    unlimited: !playerMatch && !teamMatch,
    maximumPlayers: playerMatch ? Number(playerMatch[1]) || 0 : 0,
    maximumTeams: teamMatch ? Number(teamMatch[1]) || 0 : 0,
    waitlistEnabled: /waitlist/i.test(rules)
  };

}

function isEventRegistrationOpen(event) {

  return (
    getEventRegistrationString(event.registration).toLowerCase() ===
    "registration open"
  );

}

function getEventRegistrationStatusLabel(event, capacity, registeredCount) {

  if (!isEventRegistrationOpen(event))
    return "Registration Closed";

  if (
    capacity.maximumPlayers > 0 &&
    registeredCount >= capacity.maximumPlayers
  )
    return capacity.waitlistEnabled ? "Waitlist Open" : "Capacity Full";

  return "Registration Open";

}

function getEventRegistrationTeamSummary(registrations) {

  const byTeam = {};

  registrations.forEach(function(registration) {
    const team =
      registration.team ||
      registration.preferredTeam ||
      "Looking for Team";

    if (!byTeam[team])
      byTeam[team] = {
        teamName: team,
        players: [],
        captains: 0
      };

    byTeam[team].players.push(registration);

    if (registration.captain)
      byTeam[team].captains++;
  });

  return Object.keys(byTeam)
    .sort()
    .map(function(teamName) {
      return byTeam[teamName];
    });

}

function upsertEventRegistrationCompositeRow(
  sheet,
  headers,
  keyHeaders,
  keyValues,
  row
) {

  const data =
    sheet.getDataRange().getValues();

  const headerRow =
    data[0].map(getEventRegistrationString);

  const keyIndexes =
    keyHeaders.map(function(header) {
      return headerRow.indexOf(header);
    });

  let existingRow =
    -1;

  for (let index = 1; index < data.length; index++) {
    const candidate =
      data[index];

    const matches =
      keyIndexes.every(function(keyIndex, keyIndexPosition) {
        return (
          keyIndex !== -1 &&
          getEventRegistrationString(candidate[keyIndex]) ===
            getEventRegistrationString(keyValues[keyIndexPosition])
        );
      });

    if (matches) {
      existingRow =
        index + 1;
      break;
    }
  }

  const rowByHeader = {};

  headers.forEach(function(header, index) {
    rowByHeader[header] = row[index];
  });

  const finalRow =
    headerRow.map(function(header) {
      return rowByHeader[header] !== undefined ? rowByHeader[header] : "";
    });

  if (existingRow === -1) {
    sheet.appendRow(finalRow);
    return;
  }

  sheet
    .getRange(existingRow, 1, 1, finalRow.length)
    .setValues([finalRow]);

}

function invalidateEventRegistrationCaches() {

  invalidatePortalCacheGroup("events");
  invalidatePortalCacheGroup("seasonCommand");
  invalidatePortalCacheGroup("scheduling");
  invalidatePortalCacheGroup("news");

}

function getEventRegistrationTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getEventRegistrationString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}

function getEventRegistrationBoolean(value) {

  if (value === true)
    return true;

  const text =
    getEventRegistrationString(value).toLowerCase();

  return (
    text === "true" ||
    text === "yes" ||
    text === "on" ||
    text === "1"
  );

}
