/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * EventLifecycleApi.gs
 *
 * Version 3.1.2 Event Lifecycle Control System.
 *******************************************************/

const EVENT_LIFECYCLE_STAGES = [
  "Planning",
  "Registration Open",
  "Registration Closed",
  "Roster Locked",
  "Schedule Generated",
  "Active",
  "Midseason",
  "Final Week",
  "Awards",
  "Archived"
];

const EVENT_LIFECYCLE_AUDIT_HEADERS = [
  "Timestamp",
  "Commissioner",
  "Event ID",
  "Event Name",
  "Previous Stage",
  "New Stage",
  "Reason",
  "Automation Result",
  "Problem",
  "Repair"
];

function getEventLifecycle(e) {

  const params =
    getEventLifecycleParams(e);

  const eventId =
    resolveEventId(params.eventId);

  return jsonOutput({
    success: true,
    lifecycle:
      buildEventLifecycleDashboard(eventId)
  });

}

function transitionEventLifecycle(e, auth) {

  const params =
    getEventLifecycleParams(e);

  const eventId =
    resolveEventId(params.eventId);

  const direction =
    getEventLifecycleString(params.direction) || "advance";

  const reason =
    getEventLifecycleString(params.reason) ||
    "Commissioner lifecycle operation.";

  const lifecycle =
    buildEventLifecycleDashboard(eventId);

  if (direction === "repair")
    return repairEventLifecycle(
      eventId,
      params,
      auth,
      lifecycle
    );

  const transition =
    direction === "rollback"
      ? lifecycle.rollback
      : lifecycle.nextTransition;

  if (!transition || !transition.available)
    return jsonOutput({
      success: false,
      error:
        direction === "rollback"
          ? "Rollback is not available for this event."
          : "No lifecycle transition is available for this event."
    });

  const updated =
    updateEventLifecycleStage(
      eventId,
      transition.targetStage
    );

  const automationResult =
    publishEventLifecycleAutomation(
      updated,
      lifecycle.currentStage,
      transition.targetStage,
      reason
    );

  appendEventLifecycleAudit({
    automationResult: automationResult,
    commissioner:
      auth && auth.user
        ? auth.user.email || auth.user.displayName
        : "",
    event: updated,
    newStage: transition.targetStage,
    previousStage: lifecycle.currentStage,
    reason: reason
  });

  invalidatePortalCacheGroup("events");
  invalidatePortalCacheGroup("operations");
  invalidatePortalCacheGroup("all");

  return jsonOutput({
    success: true,
    lifecycle:
      buildEventLifecycleDashboard(eventId),
    transition: {
      previousStage: lifecycle.currentStage,
      newStage: transition.targetStage,
      automationResult: automationResult
    }
  });

}

function buildEventLifecycleDashboard(eventId) {

  ensureEventEngine();

  const event =
    getEventById(eventId) ||
    getCurrentLeagueEvent();

  const participants =
    getEventParticipantObjects(event.id);

  const seasons =
    getEventSeasonObjects()
      .filter(function(season) {
        return season.eventId === event.id;
      });

  const rounds =
    getEventRoundObjects()
      .filter(function(round) {
        return round.eventId === event.id;
      });

  const currentSeason =
    seasons[0] || null;

  const currentRound =
    rounds
      .filter(function(round) {
        return round.status === "Active";
      })[0] ||
    rounds[0] ||
    null;

  const health =
    buildEventLifecycleHealth(event, participants, rounds);

  const currentStage =
    normalizeEventLifecycleStage(event.lifecycleStage || event.status);

  const validation =
    buildEventLifecycleValidation(
      event,
      participants,
      rounds,
      health,
      currentStage
    );

  return {
    auditLog:
      getEventLifecycleAuditRows(event.id).slice(0, 10),
    automation:
      buildEventLifecycleAutomationStatus(event),
    currentRound:
      currentRound
        ? currentRound.name
        : "",
    currentSeason:
      currentSeason
        ? currentSeason.name
        : "",
    currentStage: currentStage,
    discord:
      buildEventLifecycleDiscordStatus(),
    endDate: event.endDate,
    event: event,
    health: health,
    nextTransition:
      buildEventLifecycleNextTransition(
        currentStage,
        validation
      ),
    participants: participants.length,
    registration: event.registration,
    rollback:
      buildEventLifecycleRollback(currentStage, health),
    rounds: rounds.length,
    startDate: event.startDate,
    status: event.status,
    supportedStages:
      EVENT_LIFECYCLE_STAGES,
    validation: validation,
    warnings:
      buildEventLifecycleWarnings(event, participants, rounds, health)
  };

}

function buildEventLifecycleNextTransition(stage, validation) {

  if (
    validation &&
    validation.blockingIssues &&
    validation.blockingIssues.length > 0
  ) {
    const issue =
      validation.blockingIssues[0];

    return {
      available: false,
      label:
        issue.repairLabel || "Repair Lifecycle First",
      targetStage:
        issue.targetStage || "",
      confirmationTitle: "",
      confirmationBody: [
        issue.problem,
        issue.recommendedAction
      ],
      blockedReason:
        issue.problem +
        " " +
        issue.recommendedAction,
      repairAction:
        issue.repairAction || ""
    };
  }

  const index =
    EVENT_LIFECYCLE_STAGES.indexOf(stage);

  if (
    index === -1 ||
    index >= EVENT_LIFECYCLE_STAGES.length - 1
  )
    return {
      available: false,
      label: "No Transition Available",
      targetStage: "",
      confirmationTitle: "",
      confirmationBody: [],
      blockedReason: "",
      repairAction: ""
    };

  const target =
    EVENT_LIFECYCLE_STAGES[index + 1];

  return {
    available: true,
    label:
      getEventLifecycleTransitionLabel(stage, target),
    targetStage: target,
    confirmationTitle:
      getEventLifecycleTransitionLabel(stage, target) + "?",
    confirmationBody:
      getEventLifecycleConfirmationBody(stage, target),
    blockedReason: "",
    repairAction: ""
  };

}

function buildEventLifecycleValidation(event, participants, rounds, health, currentStage) {

  const issues = [];
  const registration =
    getEventLifecycleString(event.registration);
  const status =
    getEventLifecycleString(event.status);

  if (
    registration === "Registration Open" &&
    [
      "Active",
      "Midseason",
      "Final Week",
      "Awards",
      "Archived",
      "Roster Locked",
      "Schedule Generated"
    ].indexOf(currentStage) !== -1
  )
    issues.push(
      buildEventLifecycleValidationIssue(
        "critical",
        "Registration is open while the event is " + currentStage + ".",
        "Registration should close before rosters lock, schedules generate, or games begin.",
        "Players may register after operational play has already started.",
        "Close registration for this event.",
        "syncRegistration",
        "Close Registration",
        "",
        true
      )
    );

  if (
    currentStage === "Archived" &&
    registration !== "Registration Closed"
  )
    issues.push(
      buildEventLifecycleValidationIssue(
        "critical",
        "Archived event has an invalid registration state.",
        "Archived events must be immutable and closed.",
        "Historical records may continue to appear operational.",
        "Close registration and synchronize the archived state.",
        "syncRegistration",
        "Synchronize Archive",
        "",
        true
      )
    );

  if (
    currentStage === "Awards" &&
    health.gamesRemaining > 0
  )
    issues.push(
      buildEventLifecycleValidationIssue(
        "critical",
        "Awards stage reached before the season is complete.",
        "Awards should not generate while games remain outstanding.",
        "Awards, achievements, and Hall of Fame records may be premature.",
        "Return the event to Final Week until remaining games are resolved.",
        "returnFinalWeek",
        "Return to Final Week",
        "Final Week",
        true
      )
    );

  if (
    currentStage === "Schedule Generated" &&
    participants.length === 0
  )
    issues.push(
      buildEventLifecycleValidationIssue(
        "critical",
        "Schedule generated without participants.",
        "A schedule cannot be valid without a participant roster.",
        "Pairings and notifications cannot be trusted.",
        "Reopen registration and build a participant roster.",
        "reopenRegistration",
        "Reopen Registration",
        "Registration Open",
        true
      )
    );

  if (
    [
      "Active",
      "Midseason",
      "Final Week",
      "Awards"
    ].indexOf(currentStage) !== -1 &&
    rounds.length === 0
  )
    issues.push(
      buildEventLifecycleValidationIssue(
        "critical",
        "Event is active without a generated schedule.",
        "Active play requires generated rounds or verified pairings.",
        "Players may not know which games are valid.",
        "Return to Schedule Generated and verify pairings.",
        "returnScheduleGenerated",
        "Return to Schedule Generated",
        "Schedule Generated",
        true
      )
    );

  if (
    status === "Active" &&
    [
      "Planning",
      "Registration Open",
      "Registration Closed",
      "Roster Locked",
      "Schedule Generated"
    ].indexOf(currentStage) !== -1
  )
    issues.push(
      buildEventLifecycleValidationIssue(
        "warning",
        "Event status is Active before lifecycle play begins.",
        "Status should reflect the lifecycle stage.",
        "Dashboards may show this event as playable too early.",
        "Synchronize status with the current lifecycle stage.",
        "syncStatus",
        "Synchronize Status",
        "",
        false
      )
    );

  const critical =
    issues.filter(function(issue) {
      return issue.severity === "critical";
    }).length;

  const warnings =
    issues.filter(function(issue) {
      return issue.severity === "warning";
    }).length;

  const score =
    Math.max(
      0,
      100 - critical * 25 - warnings * 10
    );

  return {
    healthScore: score,
    overallStatus:
      score >= 95
        ? "Healthy"
        : score >= 75
          ? "Needs Attention"
          : score >= 50
            ? "Action Required"
            : "Critical",
    color:
      score >= 95
        ? "Green"
        : score >= 75
          ? "Yellow"
          : score >= 50
            ? "Orange"
            : "Red",
    blockingIssues:
      issues.filter(function(issue) {
        return issue.blocksTransition;
      }),
    issues: issues,
    repairable:
      issues.filter(function(issue) {
        return issue.repairAction !== "";
      }).length
  };

}

function buildEventLifecycleValidationIssue(
  severity,
  problem,
  reason,
  impact,
  recommendedAction,
  repairAction,
  repairLabel,
  targetStage,
  blocksTransition
) {

  return {
    id:
      [
        severity,
        problem,
        repairAction
      ]
        .join("|")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    severity: severity,
    problem: problem,
    reason: reason,
    impact: impact,
    recommendedAction: recommendedAction,
    repairAction: repairAction,
    repairLabel: repairLabel,
    targetStage: targetStage,
    blocksTransition: blocksTransition === true
  };

}

function repairEventLifecycle(eventId, params, auth, lifecycle) {

  const repairAction =
    getEventLifecycleString(params.repairAction);

  const issue =
    lifecycle.validation.issues.filter(function(item) {
      return item.repairAction === repairAction;
    })[0];

  if (!issue)
    return jsonOutput({
      success: false,
      error: "Lifecycle repair is not available for the current event state."
    });

  const previousEvent =
    lifecycle.event;

  const updated =
    applyEventLifecycleRepair(
      eventId,
      issue
    );

  const automationResult =
    publishEventLifecycleAutomation(
      updated,
      lifecycle.currentStage,
      normalizeEventLifecycleStage(updated.lifecycleStage || updated.status),
      issue.recommendedAction
    );

  appendEventLifecycleAudit({
    automationResult: automationResult,
    commissioner:
      auth && auth.user
        ? auth.user.email || auth.user.displayName
        : "",
    event: updated,
    newStage:
      normalizeEventLifecycleStage(updated.lifecycleStage || updated.status),
    previousStage: lifecycle.currentStage,
    problem: issue.problem,
    reason:
      getEventLifecycleString(params.reason) ||
      issue.recommendedAction,
    repair: issue.repairLabel,
    previousState:
      JSON.stringify({
        lifecycleStage: previousEvent.lifecycleStage,
        status: previousEvent.status,
        registration: previousEvent.registration
      }),
    newState:
      JSON.stringify({
        lifecycleStage: updated.lifecycleStage,
        status: updated.status,
        registration: updated.registration
      })
  });

  invalidatePortalCacheGroup("events");
  invalidatePortalCacheGroup("operations");
  invalidatePortalCacheGroup("integrity");
  invalidatePortalCacheGroup("all");

  return jsonOutput({
    success: true,
    lifecycle:
      buildEventLifecycleDashboard(eventId),
    repair: {
      action: repairAction,
      problem: issue.problem,
      automationResult: automationResult
    }
  });

}

function applyEventLifecycleRepair(eventId, issue) {

  if (
    issue.repairAction === "syncRegistration" ||
    issue.repairAction === "syncStatus"
  )
    return synchronizeEventLifecycleState(eventId);

  if (issue.targetStage)
    return updateEventLifecycleStage(
      eventId,
      issue.targetStage
    );

  return synchronizeEventLifecycleState(eventId);

}

function synchronizeEventLifecycleState(eventId) {

  const event =
    getEventById(eventId);

  const stage =
    normalizeEventLifecycleStage(
      event.lifecycleStage || event.status
    );

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENTS,
      EVENT_ENGINE_EVENT_HEADERS
    );

  const values =
    sheet
      .getDataRange()
      .getValues();

  const idColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("ID");

  const statusColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("Status");

  const registrationColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("Registration");

  const updatedAtColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("Updated At");

  for (let index = 1; index < values.length; index++) {
    if (getEventLifecycleString(values[index][idColumn]) !== eventId)
      continue;

    sheet
      .getRange(index + 1, statusColumn + 1)
      .setValue(getEventLifecycleStatus(stage));

    sheet
      .getRange(index + 1, registrationColumn + 1)
      .setValue(getEventLifecycleRegistration(stage));

    sheet
      .getRange(index + 1, updatedAtColumn + 1)
      .setValue(getEventLifecycleTimestamp());

    break;
  }

  synchronizeEventLifecycleSeasonAndRound(
    eventId,
    stage
  );

  return getEventById(eventId);

}

function buildEventLifecycleRollback(stage, health) {

  const index =
    EVENT_LIFECYCLE_STAGES.indexOf(stage);

  if (index <= 0)
    return {
      available: false,
      label: "Rollback Unavailable",
      targetStage: "",
      reason: "This event is already at the first lifecycle stage."
    };

  if (!isEventLifecycleRollbackSafe(stage, health))
    return {
      available: false,
      label: "Rollback Unsafe",
      targetStage: EVENT_LIFECYCLE_STAGES[index - 1],
      reason: "Rollback is unsafe after schedule generation or submitted games."
    };

  return {
    available: true,
    label:
      "Rollback to " +
      EVENT_LIFECYCLE_STAGES[index - 1],
    targetStage:
      EVENT_LIFECYCLE_STAGES[index - 1],
    reason: "No pairings or submitted games block this rollback."
  };

}

function isEventLifecycleRollbackSafe(stage, health) {

  return (
    stage === "Registration Open" ||
    stage === "Registration Closed" ||
    (
      stage === "Roster Locked" &&
      health.gamesCompleted === 0 &&
      health.rounds === 0
    )
  );

}

function buildEventLifecycleHealth(event, participants, rounds) {

  const seasonStatus =
    getSeasonStatusObject();

  const commissioner =
    buildEventLifecycleCommissionerStatus();

  const identity =
    getOperationsIdentityStatus();

  const discord =
    getDiscordOperationsStatus();

  return {
    automationHealth:
      getAutomationRules().eventLifecycleTransition &&
      getAutomationRules().eventLifecycleTransition.enabled
        ? "Enabled"
        : "Default",
    discordStatus:
      discord.enabled && discord.configured
        ? "Connected"
        : "Needs Setup",
    gamesCompleted:
      seasonStatus.matchesPlayed,
    gamesRemaining:
      seasonStatus.remainingMatches,
    latePlayers:
      commissioner.latePlayers,
    missingPairings:
      commissioner.missingPairings,
    participants:
      participants.length,
    registrationProgress:
      event.registration,
    rounds:
      rounds.length,
    playersWithoutIdentity:
      identity.playersWithoutEmail + identity.playersWithoutUser
  };

}

function buildEventLifecycleCommissionerStatus() {

  try {
    const player =
      getOperationsPlayers()[0];

    if (!player)
      return {
        latePlayers: [],
        missingPairings: 0
      };

    const context =
      buildSeasonCommandContext(player.player);

    return buildCommissionerSeasonStatus(context);
  }
  catch (err) {
    return {
      latePlayers: [],
      missingPairings: 0
    };
  }

}

function buildEventLifecycleWarnings(event, participants, rounds, health) {

  const warnings = [];
  const now =
    new Date();

  const startDate =
    getEventLifecycleDate(event.startDate);

  if (
    event.registration === "Registration Open" &&
    startDate &&
    now.getTime() > startDate.getTime()
  )
    warnings.push(
      buildEventLifecycleWarning(
        "warning",
        "Registration still open after Start Date.",
        "Close registration or update the event start date."
      )
    );

  if (
    normalizeEventLifecycleStage(event.lifecycleStage) === "Active" &&
    rounds.length === 0
  )
    warnings.push(
      buildEventLifecycleWarning(
        "critical",
        "No schedule generated.",
        "Generate or verify event rounds before continuing."
      )
    );

  if (health.missingPairings > 0)
    warnings.push(
      buildEventLifecycleWarning(
        "warning",
        health.missingPairings + " missing pairings.",
        "Review division completion before advancing."
      )
    );

  if (health.playersWithoutIdentity > 0)
    warnings.push(
      buildEventLifecycleWarning(
        "warning",
        health.playersWithoutIdentity + " players need identity review.",
        "Open Identity Management before locking rosters."
      )
    );

  if (health.discordStatus !== "Connected")
    warnings.push(
      buildEventLifecycleWarning(
        "warning",
        "Discord webhook disconnected or disabled.",
        "Configure Discord before relying on public announcements."
      )
    );

  if (participants.length === 0)
    warnings.push(
      buildEventLifecycleWarning(
        "warning",
        "No participants are registered.",
        "Verify Event Participants before opening play."
      )
    );

  return warnings;

}

function buildEventLifecycleWarning(severity, message, suggestedFix) {

  return {
    severity: severity,
    message: message,
    suggestedFix: suggestedFix
  };

}

function buildEventLifecycleAutomationStatus(event) {

  const rule =
    getAutomationRules().eventLifecycleTransition ||
    buildDefaultAutomationRule("eventLifecycleTransition");

  return {
    destinations:
      getRuleDestinations(rule),
    enabled: rule.enabled,
    eventType: "eventLifecycleTransition",
    template:
      buildEventLifecycleTemplatePreview(event)
  };

}

function buildEventLifecycleDiscordStatus() {

  const discord =
    getDiscordOperationsStatus();

  return {
    configured: discord.configured,
    enabled: discord.enabled,
    preview:
      discord.preview,
    status:
      discord.enabled && discord.configured
        ? "Connected"
        : "Needs Setup",
    webhookMasked:
      discord.webhookMasked
  };

}

function buildEventLifecycleTemplatePreview(event) {

  const template =
    getAutomationTemplateForEvent("eventLifecycleTransition");

  return {
    body:
      template
        ? template.body
        : "{{message}}",
    enabled:
      template
        ? template.enabled
        : false,
    title:
      template
        ? template.title
        : "Event Lifecycle Updated"
  };

}

function updateEventLifecycleStage(eventId, targetStage) {

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENTS,
      EVENT_ENGINE_EVENT_HEADERS
    );

  const values =
    sheet
      .getDataRange()
      .getValues();

  const idColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("ID");

  const stageColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("Lifecycle Stage");

  const statusColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("Status");

  const registrationColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("Registration");

  const updatedAtColumn =
    EVENT_ENGINE_EVENT_HEADERS.indexOf("Updated At");

  for (let index = 1; index < values.length; index++) {
    if (getEventLifecycleString(values[index][idColumn]) === eventId) {
      const rowNumber = index + 1;

      sheet
        .getRange(rowNumber, stageColumn + 1)
        .setValue(targetStage);

      sheet
        .getRange(rowNumber, statusColumn + 1)
        .setValue(getEventLifecycleStatus(targetStage));

      sheet
        .getRange(rowNumber, registrationColumn + 1)
        .setValue(getEventLifecycleRegistration(targetStage));

      sheet
        .getRange(rowNumber, updatedAtColumn + 1)
        .setValue(getEventLifecycleTimestamp());

      break;
    }
  }

  synchronizeEventLifecycleSeasonAndRound(
    eventId,
    targetStage
  );

  return getEventById(eventId);

}

function synchronizeEventLifecycleSeasonAndRound(eventId, targetStage) {

  const seasonStatus =
    getEventLifecycleStatus(targetStage);

  updateEventLifecycleScopedSheet(
    CONFIG.SHEETS.EVENT_SEASONS,
    EVENT_ENGINE_SEASON_HEADERS,
    "Event ID",
    eventId,
    {
      "Lifecycle Stage": targetStage,
      "Status": seasonStatus,
      "Updated At": getEventLifecycleTimestamp()
    }
  );

  updateEventLifecycleScopedSheet(
    CONFIG.SHEETS.EVENT_ROUNDS,
    EVENT_ENGINE_ROUND_HEADERS,
    "Event ID",
    eventId,
    {
      "Status": seasonStatus,
      "Updated At": getEventLifecycleTimestamp()
    }
  );

}

function updateEventLifecycleScopedSheet(sheetName, headers, keyHeader, keyValue, updates) {

  const sheet =
    ensureEventEngineSheet(
      sheetName,
      headers
    );

  const values =
    sheet
      .getDataRange()
      .getValues();

  const keyColumn =
    headers.indexOf(keyHeader);

  for (let index = 1; index < values.length; index++) {
    if (getEventLifecycleString(values[index][keyColumn]) !== keyValue)
      continue;

    Object.keys(updates)
      .forEach(function(header) {
        const column =
          headers.indexOf(header);

        if (column !== -1)
          sheet
            .getRange(index + 1, column + 1)
            .setValue(updates[header]);
      });
  }

}

function publishEventLifecycleAutomation(event, previousStage, newStage, reason) {

  try {
    if (typeof publishLeagueAutomationEvent !== "function")
      return {
        success: false,
        skipped: true,
        reason: "Automation service unavailable."
      };

    return publishLeagueAutomationEvent({
      eventType: "eventLifecycleTransition",
      category: "Event Lifecycle",
      priority:
        newStage === "Active" ||
        newStage === "Final Week" ||
        newStage === "Archived"
          ? "high"
          : "normal",
      player: "",
      division: event.type || "",
      message:
        event.name +
        " moved from " +
        previousStage +
        " to " +
        newStage +
        ".",
      payload: {
        eventId: event.id,
        eventName: event.name,
        previousStage: previousStage,
        newStage: newStage,
        reason: reason
      }
    });
  }
  catch (err) {
    return {
      success: false,
      error:
        String(err && err.message ? err.message : err)
    };
  }

}

function appendEventLifecycleAudit(record) {

  const sheet =
    ensureEventLifecycleAuditSheet();

  sheet.appendRow([
    getEventLifecycleTimestamp(),
    record.commissioner,
    record.event.id,
    record.event.name,
    record.previousStage,
    record.newStage,
    record.reason,
    JSON.stringify(record.automationResult || {}),
    record.problem || "",
    record.repair || ""
  ]);

}

function getEventLifecycleAuditRows(eventId) {

  const sheet =
    ensureEventLifecycleAuditSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  return values
    .slice(1)
    .map(function(row) {
      return {
        automationResult: getEventLifecycleString(row[7]),
        commissioner: getEventLifecycleString(row[1]),
        eventId: getEventLifecycleString(row[2]),
        eventName: getEventLifecycleString(row[3]),
        newStage: getEventLifecycleString(row[5]),
        problem: getEventLifecycleString(row[8]),
        previousStage: getEventLifecycleString(row[4]),
        repair: getEventLifecycleString(row[9]),
        reason: getEventLifecycleString(row[6]),
        timestamp: getEventLifecycleString(row[0])
      };
    })
    .filter(function(row) {
      return row.eventId === eventId;
    })
    .reverse();

}

function ensureEventLifecycleAuditSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.EVENT_LIFECYCLE_AUDIT
    );

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEETS.EVENT_LIFECYCLE_AUDIT
      );

  sheet
    .getRange(1, 1, 1, EVENT_LIFECYCLE_AUDIT_HEADERS.length)
    .setValues([EVENT_LIFECYCLE_AUDIT_HEADERS]);

  return sheet;

}

function getEventParticipantObjects(eventId) {

  const sheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_PARTICIPANTS,
      EVENT_ENGINE_PARTICIPANT_HEADERS
    );

  return getEventEngineRows(sheet)
    .filter(function(row) {
      return row["Event ID"] === eventId;
    })
    .map(function(row) {
      return {
        displayName: row["Display Name"],
        eventId: row["Event ID"],
        player: row["Player"],
        role: row["Role"],
        status: row["Status"]
      };
    });

}

function getEventLifecycleTransitionLabel(stage, target) {

  const labels = {
    "Planning>Registration Open": "Open Registration",
    "Registration Open>Registration Closed": "Close Registration",
    "Registration Closed>Roster Locked": "Lock Roster",
    "Roster Locked>Schedule Generated": "Generate Schedule",
    "Schedule Generated>Active": "Start Season",
    "Active>Midseason": "Advance to Midseason",
    "Midseason>Final Week": "Advance to Final Week",
    "Final Week>Awards": "Generate Awards",
    "Awards>Archived": "Archive Event"
  };

  return labels[stage + ">" + target] ||
    "Advance to " + target;

}

function getEventLifecycleConfirmationBody(stage, target) {

  return [
    "Move event from " + stage + " to " + target + ".",
    "Trigger automation.",
    "Notify configured destinations.",
    "Create an audit entry.",
    "Refresh event and operations cache."
  ];

}

function getEventLifecycleStatus(stage) {

  if (stage === "Archived")
    return "Archived";

  if (
    stage === "Planning" ||
    stage === "Registration Open" ||
    stage === "Registration Closed" ||
    stage === "Roster Locked" ||
    stage === "Schedule Generated"
  )
    return "Pending";

  return "Active";

}

function getEventLifecycleRegistration(stage) {

  if (stage === "Registration Open")
    return "Registration Open";

  if (stage === "Planning")
    return "Planning";

  return "Registration Closed";

}

function normalizeEventLifecycleStage(stage) {

  const value =
    getEventLifecycleString(stage);

  return EVENT_LIFECYCLE_STAGES.indexOf(value) !== -1
    ? value
    : "Active";

}

function getEventLifecycleParams(e) {

  if (e && e.parameter)
    return e.parameter;

  return {};

}

function getEventLifecycleDate(value) {

  const text =
    getEventLifecycleString(value);

  if (text === "")
    return null;

  const parsed =
    new Date(text);

  return isNaN(parsed.getTime())
    ? null
    : parsed;

}

function getEventLifecycleTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getEventLifecycleString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
