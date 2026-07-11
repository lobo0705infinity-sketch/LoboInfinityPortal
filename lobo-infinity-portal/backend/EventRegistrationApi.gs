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

  const runtimeValidation =
    validateEventEngineRuntime();

  if (!runtimeValidation.initialized)
    return jsonOutput(
      buildEventEngineInitializationRequiredResponse(runtimeValidation)
    );

  const event =
    getEventByIdSnapshot(eventId) ||
    getCurrentLeagueEventSnapshot();

  const registrations =
    getEventRegistrationRows(eventId);

  const auth =
    getRequestUser(e);

  const currentPlayer =
    auth.authenticated
      ? getEventRegistrationForPlayer(
          eventId,
          getEventParticipantKey(event, auth.user)
        )
      : null;

  return jsonOutput({
    success: true,
    registration:
      buildEventRegistrationPayload(
        event,
        registrations,
        currentPlayer,
        {
          includeRegistrationDetails: canViewEventRegistrationDetails(auth)
        }
      )
  });

}

function registerForEvent(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated)
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

  if (!canUserParticipateInEvent(event, auth.user))
    return jsonOutput({
      success: false,
      error: "League membership is required for this Event."
    });

  if (!isEventRegistrationOpen(event))
    return jsonOutput({
      success: false,
      error: "Registration is closed for this Event."
    });

  const status =
    resolveEventRegistrationStatus(
      eventId,
      event,
      getEventParticipantKey(event, auth.user)
    );

  upsertEventRegistrationRow(
    eventId,
    buildEventParticipantUser(event, auth.user),
    params,
    status
  );

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

  if (!auth.authenticated)
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

  if (!canUserParticipateInEvent(event, auth.user))
    return jsonOutput({
      success: false,
      error: "League membership is required for this Event."
    });

  if (!isEventRegistrationOpen(event))
    return jsonOutput({
      success: false,
      error: "Registration is closed for this Event."
    });

  const registration =
    getEventRegistrationForPlayer(
      eventId,
      getEventParticipantKey(event, auth.user)
    );

  if (!registration)
    return jsonOutput({
      success: false,
      error: "You are not registered for this Event."
    });

  upsertEventRegistrationRow(
    eventId,
    buildEventParticipantUser(event, auth.user),
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

function canUserParticipateInEvent(event, user) {

  if (!eventRequiresLeagueMembership(event))
    return true;

  return getEventRegistrationString(user && user.leaguePlayer) !== "";

}

function eventRequiresLeagueMembership(event) {

  if (!event)
    return true;

  if (event.requiresLeagueMembership === true)
    return true;

  if (event.requiresLeagueMembership === false)
    return false;

  const text =
    [
      event.permissions && event.permissions.requiresLeagueMembership === false
        ? "requiresLeagueMembership=false"
        : "",
      event.permissions && event.permissions.requiresLeagueMembership === true
        ? "requiresLeagueMembership=true"
        : "",
      event.type,
      event.templateId,
      event.rules
    ].join(" ").toLowerCase();

  if (text.indexOf("requiresleaguemembership=false") !== -1)
    return false;

  if (text.indexOf("requiresleaguemembership=true") !== -1)
    return true;

  return (
    getEventRegistrationString(event.type).toLowerCase() === "league" ||
    getEventRegistrationString(event.templateId).toLowerCase() ===
      EVENT_ENGINE_DEFAULT_TEMPLATE_ID
  );

}

function getEventParticipantKey(event, user) {

  if (!user)
    return "";

  const leaguePlayer =
    getEventRegistrationString(user.leaguePlayer);

  if (leaguePlayer !== "")
    return leaguePlayer;

  if (eventRequiresLeagueMembership(event))
    return "";

  return getEventRegistrationString(user.email).toLowerCase();

}

function buildEventParticipantUser(event, user) {

  const participantKey =
    getEventParticipantKey(event, user);

  return {
    email: getEventRegistrationString(user.email),
    leaguePlayer: participantKey,
    playerDisplayName:
      getEventRegistrationString(user.playerDisplayName) ||
      getEventRegistrationString(user.displayName) ||
      participantKey
  };

}

function manageEventRegistration(e) {

  return requireApiPermission(e, "runSeasonControl", function() {
    const approvalStart =
      startEventApprovalSubStage(
        "approval.total"
      );

    const params =
      measureEventApprovalOperation(
        "approval.requestParameters",
        function() {
          return getApiParameters(e);
        },
        {}
      );

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

    measureEventApprovalOperation(
      "approval.statusUpdate.upsertRegistrationRow",
      function() {
        upsertEventRegistrationRow(
          eventId,
          user,
          params,
          getEventRegistrationString(params.status) || "Registered"
        );
      },
      {
        eventId: eventId,
        player: player,
        status: getEventRegistrationString(params.status) || "Registered"
      }
    );

    measureEventApprovalOperation(
      "approval.cacheInvalidation.eventRegistrationCaches",
      function() {
        invalidateEventRegistrationCaches();
      },
      {
        eventId: eventId
      }
    );

    const compactResponse =
      getEventRegistrationString(params.responseMode).toLowerCase() ===
      "mutation";

    const response =
      compactResponse
        ? jsonOutput({
            success: true,
            mutation: {
              kind: "registrationStatus",
              eventId: eventId,
              player: player,
              status: getEventRegistrationString(params.status) || "Registered"
            }
          })
        : measureEventApprovalOperation(
            "approval.uiRefresh.getEventRegistration",
            function() {
              return getEventRegistration({
                parameter: {
                  eventId: eventId
                }
              });
            },
            {
              eventId: eventId
            }
          );

    endEventApprovalSubStage(
      "approval.total",
      approvalStart,
      {
        eventId: eventId,
        player: player,
        status: getEventRegistrationString(params.status) || "Registered"
      }
    );

    return response;
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

function buildEventRegistrationPayload(event, registrations, currentPlayer, options) {

  const includeRegistrationDetails =
    options && options.includeRegistrationDetails === true;

  const activeRegistrations =
    measureEventHomeOperationIfAvailable(
      "eventHome.registrationLookup.filter.activeRegistrations",
      function() {
        return registrations.filter(function(registration) {
          return measureEventHomeLoopIterationIfAvailable(
            "eventHome.loop.registration.activeFilter",
            function() {
              return registration.status !== "Withdrawn";
            }
          );
        });
      },
      {
        inputRegistrations: registrations.length
      }
    );

  const registered =
    measureEventHomeOperationIfAvailable(
      "eventHome.registrationLookup.filter.registered",
      function() {
        return activeRegistrations.filter(function(registration) {
          return measureEventHomeLoopIterationIfAvailable(
            "eventHome.loop.registration.registeredFilter",
            function() {
              return registration.status === "Registered";
            }
          );
        });
      },
      {
        activeRegistrations: activeRegistrations.length
      }
    );

  const waitlisted =
    measureEventHomeOperationIfAvailable(
      "eventHome.registrationLookup.filter.waitlisted",
      function() {
        return activeRegistrations.filter(function(registration) {
          return measureEventHomeLoopIterationIfAvailable(
            "eventHome.loop.registration.waitlistedFilter",
            function() {
              return registration.status === "Waitlisted";
            }
          );
        });
      },
      {
        activeRegistrations: activeRegistrations.length
      }
    );

  const teams =
    measureEventHomeOperationIfAvailable(
      "eventHome.registrationLookup.teamSummary",
      function() {
        return getEventRegistrationTeamSummary(activeRegistrations);
      },
      {
        activeRegistrations: activeRegistrations.length
      }
    );

  const capacity =
    measureEventHomeOperationIfAvailable(
      "eventHome.registrationLookup.capacity",
      function() {
        return getEventRegistrationCapacity(event);
      },
      {}
    );

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
    registrations: includeRegistrationDetails
      ? registrations
      : currentPlayer
        ? [currentPlayer]
        : [],
    teams: includeRegistrationDetails ? teams : [],
    freeAgents:
      includeRegistrationDetails
        ? measureEventHomeOperationIfAvailable(
            "eventHome.registrationLookup.filter.freeAgents",
            function() {
              return activeRegistrations.filter(function(registration) {
                return measureEventHomeLoopIterationIfAvailable(
                  "eventHome.loop.registration.freeAgentFilter",
                  function() {
                    return registration.freeAgent === true;
                  }
                );
              });
            },
            {
              activeRegistrations: activeRegistrations.length
            }
          )
        : [],
    captains:
      includeRegistrationDetails
        ? measureEventHomeOperationIfAvailable(
            "eventHome.registrationLookup.filter.captains",
            function() {
              return activeRegistrations.filter(function(registration) {
                return measureEventHomeLoopIterationIfAvailable(
                  "eventHome.loop.registration.captainFilter",
                  function() {
                    return registration.captain === true;
                  }
                );
              });
            },
            {
              activeRegistrations: activeRegistrations.length
            }
          )
        : []
  };

}

function canViewEventRegistrationDetails(auth) {

  return (
    auth &&
    auth.authenticated &&
    auth.user &&
    userHasPermission(auth.user.role, "runSeasonControl")
  );

}

function upsertEventRegistrationRow(eventId, user, params, status) {

  const sheet =
    measureEventApprovalOperation(
      "approval.sheetLookup.eventParticipants.ensureSheet",
      function() {
        return ensureEventEngineSheet(
          CONFIG.SHEETS.EVENT_PARTICIPANTS,
          EVENT_ENGINE_PARTICIPANT_HEADERS
        );
      },
      {
        sheet: CONFIG.SHEETS.EVENT_PARTICIPANTS
      }
    );

  const now =
    getEventRegistrationTimestamp();

  const existing =
    measureEventApprovalOperation(
      "approval.registrationLookup.existingRegistration",
      function() {
        return getEventRegistrationForPlayer(eventId, user.leaguePlayer);
      },
      {
        eventId: eventId,
        player: user.leaguePlayer
      }
    );

  const registeredAt =
    existing && existing.registeredAt
      ? existing.registeredAt
      : now;

  const team =
    getEventRegistrationString(params.teamName || params.team);

  const preferredTeam =
    getEventRegistrationString(params.preferredTeam || team);

  measureEventApprovalOperation(
    "approval.spreadsheetWrite.upsertCompositeRow",
    function() {
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
    },
    {
      eventId: eventId,
      player: user.leaguePlayer,
      status: status
    }
  );

}

function getEventRegistrationRows(eventId) {

  const target =
    getEventRegistrationString(eventId);

  const sheet =
    measureEventHomeOperationIfAvailable(
      "eventHome.sheetLookup.eventParticipants.runtimeSheet",
      function() {
        return getEventEngineRuntimeSheet(CONFIG.SHEETS.EVENT_PARTICIPANTS);
      },
      {
        sheet: CONFIG.SHEETS.EVENT_PARTICIPANTS
      }
    );

  if (!sheet)
    return [];

  const rows =
    measureEventHomeOperationIfAvailable(
      "eventHome.participantLoading.eventParticipants.getEventEngineRows",
      function() {
        return getEventEngineRows(sheet);
      },
      {
        sheet: CONFIG.SHEETS.EVENT_PARTICIPANTS
      }
    );

  return rows
    .filter(function(row) {
      return measureEventHomeLoopIterationIfAvailable(
        "eventHome.loop.registration.rowsFilterByEvent",
        function() {
          return row["Event ID"] === target;
        }
      );
    })
    .map(function(row) {
      return measureEventHomeLoopIterationIfAvailable(
        "eventHome.loop.registration.mapRows",
        function() {
          return mapEventRegistrationRow(row);
        }
      );
    });

}

function getEventRegistrationForPlayer(eventId, player) {

  const target =
    getEventRegistrationString(player).toLowerCase();

  return measureEventHomeOperationIfAvailable(
    "eventHome.participantLoading.currentPlayer.getEventRegistrationRowsAgain",
    function() {
      return getEventRegistrationRows(eventId)
        .filter(function(registration) {
          return measureEventHomeLoopIterationIfAvailable(
            "eventHome.loop.registration.currentPlayerFilter",
            function() {
              return registration.player.toLowerCase() === target;
            }
          );
        })[0] || null;
    },
    {
      eventId: eventId,
      player: player
    }
  );

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
    measureEventHomeLoopIterationIfAvailable(
      "eventHome.loop.registration.teamSummary.group",
      function() {
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
      }
    );
  });

  return Object.keys(byTeam)
    .sort()
    .map(function(teamName) {
      return measureEventHomeLoopIterationIfAvailable(
        "eventHome.loop.registration.teamSummary.map",
        function() {
          return byTeam[teamName];
        }
      );
    });

}

function measureEventHomeOperationIfAvailable(stageName, callback, details) {

  if (typeof measureEventHomeOperation === "function")
    return measureEventHomeOperation(stageName, callback, details || {});

  return callback();

}

function measureEventHomeLoopIterationIfAvailable(stageName, callback) {

  if (typeof measureEventHomeLoopIteration === "function")
    return measureEventHomeLoopIteration(stageName, callback);

  return callback();

}

function startEventApprovalSubStage(stageName) {

  if (
    typeof API_PIPELINE_CONTEXT === "undefined" ||
    !API_PIPELINE_CONTEXT ||
    API_PIPELINE_CONTEXT.action !== "manageEventRegistration"
  )
    return 0;

  return Date.now();

}

function endEventApprovalSubStage(stageName, startTime, details) {

  if (
    typeof API_PIPELINE_CONTEXT === "undefined" ||
    !API_PIPELINE_CONTEXT ||
    API_PIPELINE_CONTEXT.action !== "manageEventRegistration" ||
    !startTime ||
    typeof recordApiPipelineSubStage !== "function"
  )
    return;

  recordApiPipelineSubStage(
    stageName,
    startTime,
    details || {}
  );

}

function measureEventApprovalOperation(stageName, callback, details) {

  const start =
    startEventApprovalSubStage(stageName);

  try {
    return callback();
  }
  finally {
    endEventApprovalSubStage(
      stageName,
      start,
      details || {}
    );
  }

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
