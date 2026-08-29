/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * AutomationApi.gs
 *
 * Event-driven League Automation Center.
 *******************************************************/

const AUTOMATION_EVENT_HEADERS = [
  "Event ID",
  "Event Type",
  "Category",
  "Priority",
  "Player",
  "Division",
  "Timestamp",
  "Message",
  "Payload",
  "Destinations",
  "Status"
];

const AUTOMATION_RULE_HEADERS = [
  "Event Type",
  "Enabled",
  "Portal",
  "Discord",
  "Timeline",
  "News",
  "Commissioner Feed",
  "Email",
  "Push",
  "Public API",
  "Priority",
  "Template ID"
];

const AUTOMATION_TEMPLATE_HEADERS = [
  "Template ID",
  "Event Type",
  "Name",
  "Title",
  "Body",
  "Discord Format",
  "Enabled"
];

const AUTOMATION_QUEUE_HEADERS = [
  "Queue ID",
  "Event ID",
  "Event Type",
  "Destination",
  "Status",
  "Timestamp",
  "Attempts",
  "Last Attempt",
  "Reason",
  "Payload"
];

const AUTOMATION_EVENT_DEFINITIONS = [
  ["gameSubmitted", "Match Results", "high", "Game Submitted"],
  ["gameCorrected", "Match Results", "high", "Game Corrected"],
  ["achievementUnlocked", "Achievements", "normal", "Achievement Unlocked"],
  ["promotion", "Season", "high", "Promotion"],
  ["relegation", "Season", "high", "Relegation"],
  ["seasonReminder", "Season", "normal", "Season Reminder"],
  ["seasonStarted", "Season", "high", "Season Started"],
  ["seasonEnded", "Season", "high", "Season Ended"],
  ["divisionChampion", "Hall of Fame", "high", "Division Champion"],
  ["leagueChampion", "Hall of Fame", "high", "League Champion"],
  ["hallOfFame", "Hall of Fame", "high", "Hall of Fame"],
  ["recordBroken", "Records", "high", "Record Broken"],
  ["playerJoined", "Identity", "normal", "Player Joined"],
  ["identityLinked", "Identity", "normal", "Identity Linked"],
  ["commissionerNews", "News", "normal", "Commissioner News"],
  ["streamScheduled", "Streams", "normal", "Stream Scheduled"],
  ["systemWarning", "System", "high", "System Warning"],
  ["integrityAlert", "Integrity", "critical", "Integrity Alert"],
  ["eventLifecycleTransition", "Event Lifecycle", "high", "Event Lifecycle Transition"],
  ["weeklyRecap", "Weekly Automation", "normal", "Weekly Recap"]
];

const AUTOMATION_DEFAULT_TEMPLATES = [
  ["gameSubmitted", "Game Result", "{{message}}", "{{player}} recorded a league result in {{division}}.", "embed"],
  ["achievementUnlocked", "Achievement", "{{player}} unlocked an achievement", "{{message}}", "embed"],
  ["promotion", "Promotion", "{{player}} promoted", "{{message}}", "embed"],
  ["relegation", "Relegation", "{{player}} relegated", "{{message}}", "embed"],
  ["seasonReminder", "Season Reminder", "{{player}} season reminder", "{{message}}", "embed"],
  ["weeklyRecap", "Weekly Recap", "Weekly League Recap", "{{message}}", "embed"],
  ["seasonSummary", "Season Summary", "Season Summary", "{{message}}", "embed"],
  ["hallOfFame", "Hall of Fame", "{{player}} enters the Hall of Fame", "{{message}}", "embed"],
  ["eventLifecycleTransition", "Event Lifecycle", "Event lifecycle updated", "{{message}}", "embed"],
  ["commissionerNews", "Commissioner News", "{{message}}", "{{message}}", "embed"]
];

const AUTOMATION_DESTINATIONS = [
  "portal",
  "discord",
  "timeline",
  "news",
  "commissionerFeed",
  "email",
  "push",
  "publicApi"
];

function getAutomationCenter() {

  const rules =
    getAutomationRules();

  const queue =
    getAutomationQueue(100);

  const events =
    getAutomationEvents(50);

  const discord =
    getDiscordOperationsStatus();

  return jsonOutput({
    success: true,
    automation: {
      status:
        buildAutomationStatus(
          queue,
          discord
        ),
      eventTypes:
        AUTOMATION_EVENT_DEFINITIONS.map(function(definition) {
          return buildAutomationEventType(definition, rules);
        }),
      destinations:
        AUTOMATION_DESTINATIONS,
      rules: rules,
      templates:
        getAutomationTemplates(),
      queue: queue,
      events: events,
      discord: discord
    }
  });

}

function publishAutomationEvent(e) {

  const params =
    getOperationsParams(e);

  return jsonOutput(
    publishLeagueAutomationEvent({
      eventType:
        getAutomationString(params.eventType) ||
        getAutomationString(params.event) ||
        "commissionerNews",
      category:
        getAutomationString(params.category),
      priority:
        getAutomationString(params.priority),
      player:
        getAutomationString(params.player),
      division:
        getAutomationString(params.division),
      message:
        getAutomationString(params.message) ||
        getAutomationString(params.content),
      payload:
        params.payload || "",
      replay:
        getAutomationBoolean(params.replay)
    })
  );

}

function updateAutomationRule(e) {

  const params =
    getOperationsParams(e);

  const eventType =
    getAutomationString(params.eventType);

  if (eventType === "")
    return jsonOutput({
      success: false,
      error: "Event type is required."
    });

  setAutomationRuleValues(eventType, {
    enabled: getAutomationBoolean(params.enabled),
    portal: getAutomationBoolean(params.portal),
    discord: getAutomationBoolean(params.discord),
    timeline: getAutomationBoolean(params.timeline),
    news: getAutomationBoolean(params.news),
    commissionerFeed: getAutomationBoolean(params.commissionerFeed),
    email: getAutomationBoolean(params.email),
    push: getAutomationBoolean(params.push),
    publicApi: getAutomationBoolean(params.publicApi),
    priority:
      getAutomationString(params.priority),
    templateId:
      getAutomationString(params.templateId)
  });

  return getAutomationCenter();

}

function updateAutomationTemplate(e) {

  const params =
    getOperationsParams(e);

  const templateId =
    getAutomationString(params.templateId);

  if (templateId === "")
    return jsonOutput({
      success: false,
      error: "Template ID is required."
    });

  setAutomationTemplateValues(templateId, {
    eventType: getAutomationString(params.eventType),
    name: getAutomationString(params.name),
    title: getAutomationString(params.title),
    body: getAutomationString(params.body),
    discordFormat: getAutomationString(params.discordFormat) || "embed",
    enabled: getAutomationBoolean(params.enabled)
  });

  return getAutomationCenter();

}

function runAutomation(e) {

  const params =
    getOperationsParams(e);

  const cadence =
    getAutomationString(params.cadence) ||
    "weekly";

  const results = [
    publishLeagueAutomationEvent({
      eventType: "weeklyRecap",
      category: "Weekly Automation",
      priority: "normal",
      message: "Weekly standings, player of the week, promotion race, relegation race, league health, and commissioner summary generated.",
      payload: JSON.stringify({
        cadence: cadence,
        standings: getStandingsSnapshot(),
        health: getAutomationHealthSummary()
      })
    }),
    publishLeagueAutomationEvent({
      eventType: "recordBroken",
      category: "Records",
      priority: "normal",
      message: "League records reviewed for the weekly recap.",
      payload: JSON.stringify({
        records: safeAutomationJson(getRecords)
      })
    }),
    publishLeagueAutomationEvent({
      eventType: "integrityAlert",
      category: "Integrity",
      priority: "high",
      message: "League health summary generated for commissioner review.",
      payload: JSON.stringify(getAutomationHealthSummary())
    })
  ];

  setDiscordConfigValues({
    lastAutomationRun:
      getAutomationTimestamp()
  });

  return jsonOutput({
    success: true,
    results: results,
    automation:
      buildAutomationCenterObject()
  });

}

function pauseAutomation() {

  setDiscordConfigValues({
    enabled: "false"
  });

  return getAutomationCenter();

}

function resumeAutomation() {

  setDiscordConfigValues({
    enabled: "true"
  });

  return getAutomationCenter();

}

function replayLastAutomationEvent() {

  const events =
    getAutomationEvents(1);

  if (events.length === 0)
    return jsonOutput({
      success: false,
      error: "No automation events are available to replay."
    });

  return jsonOutput(
    replayAutomationEvent(events[0])
  );

}

function replayAutomationWeek() {

  return runAutomation({
    parameter: {
      cadence: "weekly"
    }
  });

}

function replayAutomationSeason() {

  const results = [
    publishLeagueAutomationEvent({
      eventType: "seasonEnded",
      category: "Season",
      priority: "high",
      message: "Season automation replay generated.",
      payload: JSON.stringify({
        season: getSeasonStatusObject(),
        standings: getStandingsSnapshot()
      }),
      replay: true
    }),
    publishLeagueAutomationEvent({
      eventType: "hallOfFame",
      category: "Hall of Fame",
      priority: "high",
      message: "Hall of Fame automation replay generated.",
      payload: JSON.stringify({
        hallOfFame: safeAutomationJson(getHallOfFame)
      }),
      replay: true
    })
  ];

  return jsonOutput({
    success: true,
    results: results,
    automation:
      buildAutomationCenterObject()
  });

}

function clearAutomationQueue() {

  const sheet =
    ensureAutomationQueueSheet();

  if (sheet.getLastRow() > 1)
    sheet.deleteRows(
      2,
      sheet.getLastRow() - 1
    );

  return getAutomationCenter();

}

function retryAutomationFailed() {

  const failed =
    getAutomationQueue(250)
      .filter(function(item) {
        return item.status === "Failed" || item.status === "Retry";
      });

  const results =
    failed.map(function(item) {
      return processAutomationQueueItem(item, true);
    });

  return jsonOutput({
    success: true,
    results: results,
    automation:
      buildAutomationCenterObject()
  });

}

function publishLeagueAutomationEvent(event) {

  const rules =
    getAutomationRules();

  const rule =
    rules[event.eventType] ||
    buildDefaultAutomationRule(event.eventType);

  if (!rule.enabled)
    return {
      success: true,
      skipped: true,
      reason: "Automation rule disabled.",
      eventType: event.eventType
    };

  const eventRecord =
    appendAutomationEvent(event, rule);

  const destinations =
    getRuleDestinations(rule);

  const queueItems =
    destinations.map(function(destination) {
      return enqueueAutomationDestination(
        eventRecord,
        destination
      );
    });

  const results =
    queueItems.map(function(item) {
      return processAutomationQueueItem(
        item,
        false
      );
    });

  return {
    success: true,
    event: eventRecord,
    queued: queueItems.length,
    results: results
  };

}

const AUTOMATION_QUEUE_BATCH_LIMIT = 4;
const AUTOMATION_QUEUE_SELECTION_WINDOW = 100;
const AUTOMATION_GAME_EVENT_LOOKBACK = 100;

function enqueueGameSubmittedAutomationEvent(identity) {

  const gameId = Number(identity && identity.gameId);

  if (!Number.isInteger(gameId) || gameId <= 0)
    throw new Error("A canonical Game ID is required for game automation.");

  const eventId = "gameSubmitted-game-" + gameId;

  if (typeof markPublicAnalyticsProjectionDirty_ === "function")
    markPublicAnalyticsProjectionDirty_(identity && identity.eventId);
  if (typeof markPublicTeamTournamentProjectionDirty_ === "function")
    markPublicTeamTournamentProjectionDirty_(identity && identity.eventId);

  if (hasRecentAutomationEventId_(eventId))
    return {
      duplicate: true,
      eventId: eventId,
      success: true
    };

  const rules = getAutomationRules();
  const rule = rules.gameSubmitted || buildDefaultAutomationRule("gameSubmitted");

  if (!rule.enabled)
    return {
      eventId: eventId,
      reason: "Automation rule disabled.",
      skipped: true,
      success: true
    };

  const payload = JSON.stringify({
    eventId: getAutomationString(identity.eventId),
    gameId: gameId,
    gameType: getAutomationString(identity.gameType)
  });
  const destinations = getRuleDestinations(rule);
  const timestamp = getAutomationTimestamp();
  const eventRecord = {
      category: "Match Results",
      destinations: destinations.join(","),
      division: "",
      eventId: eventId,
      eventType: "gameSubmitted",
      message: "A game was submitted.",
      payload: payload,
      player: "",
      priority: "high",
      status: "Published",
      timestamp: timestamp
  };

  ensureAutomationEventsSheet().appendRow([
      eventRecord.eventId,
      eventRecord.eventType,
      eventRecord.category,
      eventRecord.priority,
      eventRecord.player,
      eventRecord.division,
      eventRecord.timestamp,
      eventRecord.message,
      eventRecord.payload,
      eventRecord.destinations,
      eventRecord.status
  ]);

  if (destinations.length > 0) {
    const queueRows = destinations.map(function(destination) {
      const queueId = eventId + "-" + destination;
      return [
          queueId,
          eventId,
          "gameSubmitted",
          destination,
          "Pending",
          timestamp,
          0,
          "",
          "",
          JSON.stringify({
            payload: JSON.parse(payload)
          })
      ];
    });
    const queueSheet = ensureAutomationQueueSheet();
    queueSheet
      .getRange(
        queueSheet.getLastRow() + 1,
        1,
        queueRows.length,
        AUTOMATION_QUEUE_HEADERS.length
      )
      .setValues(queueRows);
  }

  return {
    eventId: eventId,
    queued: destinations.length,
    success: true
  };

}

function hasRecentAutomationEventId_(eventId) {

  const sheet = ensureAutomationEventsSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1)
    return false;

  const firstRow = Math.max(2, lastRow - AUTOMATION_GAME_EVENT_LOOKBACK + 1);
  const values = sheet
    .getRange(firstRow, 1, lastRow - firstRow + 1, 1)
    .getValues();

  return values.some(function(row) {
    return getAutomationString(row[0]) === eventId;
  });

}

function processAutomationQueueBatch(e) {

  const parameters = getApiParameters(e);
  const requestedLimit = Number(getApiParameter(parameters, "batchLimit"));
  const batchLimit = Math.max(
    1,
    Math.min(AUTOMATION_QUEUE_BATCH_LIMIT, requestedLimit || AUTOMATION_QUEUE_BATCH_LIMIT)
  );
  const items = selectPendingAutomationQueueItems_(batchLimit);
  const results = items.map(function(item) {
    try {
      return processAutomationQueueItem(item, false);
    }
    catch (error) {
      updateAutomationQueueItem(
        item.queueId,
        "Retry",
        Number(item.attempts) + 1,
        String(error && error.message ? error.message : error),
        item.rowNumber
      );
      return {
        error: String(error && error.message ? error.message : error),
        queueId: item.queueId,
        success: false
      };
    }
  });

  const analyticsProjection =
    typeof publishDirtyPublicAnalyticsProjectionsBestEffort_ === "function"
      ? publishDirtyPublicAnalyticsProjectionsBestEffort_()
      : { refreshed: false, success: true };

  const teamTournamentProjection =
    typeof publishDirtyPublicTeamTournamentProjectionBestEffort_ === "function"
      ? publishDirtyPublicTeamTournamentProjectionBestEffort_()
      : { refreshed: false, success: true };

  return jsonOutput({
    analyticsProjection: analyticsProjection,
    attempted: items.length,
    batchLimit: batchLimit,
    failed: results.filter(function(result) { return result.success === false; }).length,
    results: results,
    teamTournamentProjection: teamTournamentProjection,
    success: true
  });

}

function selectPendingAutomationQueueItems_(limit) {

  const sheet = ensureAutomationQueueSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1)
    return [];

  const firstRow = Math.max(2, lastRow - AUTOMATION_QUEUE_SELECTION_WINDOW + 1);
  const values = sheet
    .getRange(
      firstRow,
      1,
      lastRow - firstRow + 1,
      AUTOMATION_QUEUE_HEADERS.length
    )
    .getValues();
  const retryLimit = Number(getDiscordConfig().retryLimit) || 3;

  return values
    .map(function(row, index) {
      const item = buildAutomationQueueItem(row);
      item.rowNumber = firstRow + index;
      return item;
    })
    .filter(function(item) {
      return (
        (item.status === "Pending" || item.status === "Retry") &&
        Number(item.attempts) < retryLimit
      );
    })
    .slice(0, limit);

}

function processAutomationQueueItem(item, force) {

  if (item.destination === "discord")
    return processDiscordQueueItem(
      item,
      force
    );

  updateAutomationQueueItem(
    item.queueId,
    "Sent",
    Number(item.attempts) + 1,
    "Queued for " + item.destination + " destination.",
    item.rowNumber
  );

  return {
    success: true,
    destination:
      item.destination,
    status: "Sent"
  };

}

function processDiscordQueueItem(item, force) {

  const payload =
    buildAutomationDiscordPayload(item);

  const result =
    sendDiscordAnnouncementPayload(
      item.eventType,
      payload,
      {
        dedupeKey: item.queueId,
        automationEventId: item.eventId,
        force: force === true
      }
    );

  updateAutomationQueueItem(
    item.queueId,
    result.success ? "Sent" : "Retry",
    Number(item.attempts) + 1,
    result.error || result.failure || "",
    item.rowNumber
  );

  return result;

}

function buildAutomationDiscordPayload(item) {

  const payload =
    parseAutomationPayload(item.payload);

  const eventPayload =
    parseAutomationPayload(payload.payload);

  if (
    item.eventType === "gameSubmitted" &&
    (eventPayload.gameId || eventPayload.id)
  ) {
    const game = buildAutomationGamePayloadById_(
      eventPayload.gameId || eventPayload.id
    );
    return buildDiscordGamePayload(game || eventPayload);
  }

  const template =
    getAutomationTemplateForEvent(item.eventType);

  const context = {
    player: getAutomationString(payload.player),
    division: getAutomationString(payload.division),
    message:
      getAutomationString(payload.message) ||
      item.eventType
  };

  const message =
    template
      ? renderAutomationTemplate(
          template.body,
          context
        )
      : context.message;

  const title =
    template
      ? renderAutomationTemplate(
          template.title,
          context
        )
      : getAutomationEventLabel(item.eventType);

  const content =
    getAutomationString(payload.message) ||
    item.eventType;

  const link =
    buildDeepLink(
      item.eventType,
      {
        id: payload.id,
        gameId: payload.gameId,
        listId: payload.listId,
        streamId: payload.streamId,
        newsId: payload.newsId,
        achievementId: payload.achievementId,
        player: context.player,
        division: context.division,
        message: context.message,
        payload: payload
      }
    );

  return buildDiscordManualPayload({
    content: content,
    eventType: item.eventType,
    link: link.url,
    title: title,
    message: message
  });

}

function buildAutomationGamePayloadById_(gameId) {

  const target = Number(gameId);

  if (!Number.isInteger(target) || target <= 0)
    return null;

  const sheet = lifGetTargetSpreadsheet_().getSheetByName(CONFIG.SHEETS.FORM);

  if (!sheet || target + 1 > sheet.getLastRow())
    return null;

  const row = sheet
    .getRange(target + 1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  if (!row || !validateGame(row))
    return null;

  const winner = determineWinner(row);
  const analyticsRow = buildAnalyticsRow(row, winner);
  return buildRecentGame(
    analyticsRow,
    target,
    getRecentGameColumns(getGameAnalyticsHeaders()[0])
  );

}

function appendAutomationEvent(event, rule) {

  const sheet =
    ensureAutomationEventsSheet();

  const eventId =
    "evt-" +
    new Date().getTime() +
    "-" +
    Math.floor(Math.random() * 10000);

  const payload =
    typeof event.payload === "string"
      ? event.payload
      : JSON.stringify(event.payload || {});

  const record = {
    eventId: eventId,
    category:
      event.category ||
      getAutomationEventCategory(event.eventType),
    priority:
      event.priority ||
      rule.priority ||
      "normal",
    player:
      event.player || "",
    division:
      event.division || "",
    timestamp:
      getAutomationTimestamp(),
    message:
      event.message || getAutomationEventLabel(event.eventType),
    payload: payload,
    destinations:
      getRuleDestinations(rule).join(","),
    status:
      event.replay ? "Replayed" : "Published",
    eventType:
      event.eventType
  };

  sheet.appendRow([
    record.eventId,
    record.eventType,
    record.category,
    record.priority,
    record.player,
    record.division,
    record.timestamp,
    record.message,
    record.payload,
    record.destinations,
    record.status
  ]);

  return record;

}

function enqueueAutomationDestination(eventRecord, destination) {

  const sheet =
    ensureAutomationQueueSheet();

  const queueId =
    "queue-" +
    new Date().getTime() +
    "-" +
    Math.floor(Math.random() * 10000);

  const item = {
    queueId: queueId,
    eventId: eventRecord.eventId,
    eventType: eventRecord.eventType,
    destination: destination,
    status: "Pending",
    timestamp: getAutomationTimestamp(),
    attempts: 0,
    lastAttempt: "",
    reason: "",
    payload:
      JSON.stringify({
        title: getAutomationEventLabel(eventRecord.eventType),
        message: eventRecord.message,
        player: eventRecord.player,
        division: eventRecord.division,
        payload: parseAutomationPayload(eventRecord.payload)
      })
  };

  sheet.appendRow([
    item.queueId,
    item.eventId,
    item.eventType,
    item.destination,
    item.status,
    item.timestamp,
    item.attempts,
    item.lastAttempt,
    item.reason,
    item.payload
  ]);

  return item;

}

function replayAutomationEvent(event) {

  return publishLeagueAutomationEvent({
    eventType:
      getAutomationEventTypeFromRecord(event),
    category: event.category,
    priority: event.priority,
    player: event.player,
    division: event.division,
    message: event.message,
    payload: event.payload,
    replay: true
  });

}

function buildAutomationCenterObject() {

  const rules =
    getAutomationRules();

  const queue =
    getAutomationQueue(100);

  const discord =
    getDiscordOperationsStatus();

  return {
    status:
      buildAutomationStatus(queue, discord),
    eventTypes:
      AUTOMATION_EVENT_DEFINITIONS.map(function(definition) {
        return buildAutomationEventType(definition, rules);
      }),
    destinations:
      AUTOMATION_DESTINATIONS,
    rules: rules,
    templates:
      getAutomationTemplates(),
    queue: queue,
    events:
      getAutomationEvents(50),
    discord: discord
  };

}

function buildAutomationStatus(queue, discord) {

  const failed =
    queue.filter(function(item) {
      return item.status === "Failed" || item.status === "Retry";
    });

  const pending =
    queue.filter(function(item) {
      return item.status === "Pending";
    });

  return {
    enabled:
      discord.enabled,
    health:
      failed.length > 0
        ? "yellow"
        : discord.configured
          ? "green"
          : "red",
    discordConnected:
      discord.configured,
    webhookHealthy:
      discord.configured && failed.length === 0,
    lastMessage:
      discord.lastResult ? discord.lastResult.title : "",
    lastFailure:
      failed[0] ? failed[0].reason : "",
    queueSize:
      pending.length,
    retryQueue:
      failed.length,
    lastAutomationRun:
      discord.lastAutomationRun
  };

}

function buildAutomationEventType(definition, rules) {

  const eventType =
    definition[0];

  const rule =
    rules[eventType] ||
    buildDefaultAutomationRule(eventType);

  return {
    eventType: eventType,
    category: definition[1],
    priority: definition[2],
    label: definition[3],
    rule: rule
  };

}

function getAutomationRules() {

  const sheet =
    ensureAutomationRulesSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  const rules = {};

  values
    .slice(1)
    .forEach(function(row) {
      const rule =
        buildAutomationRule(row);

      if (rule.eventType !== "")
        rules[rule.eventType] = rule;
    });

  return rules;

}

function getAutomationTemplates() {

  const sheet =
    ensureAutomationTemplatesSheet();

  return sheet
    .getDataRange()
    .getValues()
    .slice(1)
    .map(buildAutomationTemplate)
    .filter(function(template) {
      return template.templateId !== "";
    });

}

function getAutomationQueue(limit) {

  const sheet =
    ensureAutomationQueueSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  return values
    .slice(1)
    .map(buildAutomationQueueItem)
    .reverse()
    .slice(0, limit || 50);

}

function getAutomationEvents(limit) {

  const sheet =
    ensureAutomationEventsSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  return values
    .slice(1)
    .map(buildAutomationEventRecord)
    .reverse()
    .slice(0, limit || 50);

}

function setAutomationRuleValues(eventType, updates) {

  const sheet =
    ensureAutomationRulesSheet();

  const rowNumber =
    findAutomationSheetRow(sheet, 1, eventType) ||
    sheet.getLastRow() + 1;

  sheet
    .getRange(rowNumber, 1, 1, AUTOMATION_RULE_HEADERS.length)
    .setValues([[
      eventType,
      updates.enabled,
      updates.portal,
      updates.discord,
      updates.timeline,
      updates.news,
      updates.commissionerFeed,
      updates.email,
      updates.push,
      updates.publicApi,
      updates.priority || "normal",
      updates.templateId || eventType
    ]]);

}

function setAutomationTemplateValues(templateId, updates) {

  const sheet =
    ensureAutomationTemplatesSheet();

  const rowNumber =
    findAutomationSheetRow(sheet, 1, templateId) ||
    sheet.getLastRow() + 1;

  sheet
    .getRange(rowNumber, 1, 1, AUTOMATION_TEMPLATE_HEADERS.length)
    .setValues([[
      templateId,
      updates.eventType,
      updates.name,
      updates.title,
      updates.body,
      updates.discordFormat,
      updates.enabled
    ]]);

}

function updateAutomationQueueItem(queueId, status, attempts, reason, knownRowNumber) {

  const sheet =
    ensureAutomationQueueSheet();

  const rowNumber = Number(knownRowNumber) ||
    findAutomationSheetRow(sheet, 1, queueId);

  if (!rowNumber)
    return;

  sheet
    .getRange(rowNumber, 5)
    .setValue(status);

  sheet
    .getRange(rowNumber, 7)
    .setValue(attempts);

  sheet
    .getRange(rowNumber, 8)
    .setValue(getAutomationTimestamp());

  sheet
    .getRange(rowNumber, 9)
    .setValue(reason || "");

}

function ensureAutomationEventsSheet() {

  return ensureAutomationSheet(
    CONFIG.SHEETS.AUTOMATION_EVENTS,
    AUTOMATION_EVENT_HEADERS
  );

}

function ensureAutomationRulesSheet() {

  const sheet =
    ensureAutomationSheet(
      CONFIG.SHEETS.AUTOMATION_RULES,
      AUTOMATION_RULE_HEADERS
    );

  ensureAutomationDefaultRules(sheet);

  return sheet;

}

function ensureAutomationTemplatesSheet() {

  const sheet =
    ensureAutomationSheet(
      CONFIG.SHEETS.AUTOMATION_TEMPLATES,
      AUTOMATION_TEMPLATE_HEADERS
    );

  ensureAutomationDefaultTemplates(sheet);

  return sheet;

}

function ensureAutomationQueueSheet() {

  return ensureAutomationSheet(
    CONFIG.SHEETS.AUTOMATION_QUEUE,
    AUTOMATION_QUEUE_HEADERS
  );

}

function ensureAutomationSheet(name, headers) {

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(name);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(name);

  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers]);

  return sheet;

}

function ensureAutomationDefaultRules(sheet) {

  AUTOMATION_EVENT_DEFINITIONS.forEach(function(definition) {
    const eventType =
      definition[0];

    if (findAutomationSheetRow(sheet, 1, eventType))
      return;

    const defaultRule =
      buildDefaultAutomationRule(eventType);

    sheet.appendRow([
      eventType,
      defaultRule.enabled,
      defaultRule.portal,
      defaultRule.discord,
      defaultRule.timeline,
      defaultRule.news,
      defaultRule.commissionerFeed,
      defaultRule.email,
      defaultRule.push,
      defaultRule.publicApi,
      defaultRule.priority,
      defaultRule.templateId
    ]);
  });

}

function ensureAutomationDefaultTemplates(sheet) {

  AUTOMATION_DEFAULT_TEMPLATES.forEach(function(row) {
    const templateId =
      row[0];

    if (findAutomationSheetRow(sheet, 1, templateId))
      return;

    sheet.appendRow([
      templateId,
      row[0],
      row[1],
      row[2],
      row[3],
      row[4],
      true
    ]);
  });

}

function buildDefaultAutomationRule(eventType) {

  const enabledByDefault =
    [
      "gameSubmitted",
      "achievementUnlocked",
      "promotion",
      "relegation",
      "seasonStarted",
      "seasonEnded",
      "hallOfFame",
      "recordBroken",
      "commissionerNews",
      "streamScheduled",
      "systemWarning",
      "integrityAlert",
      "eventLifecycleTransition",
      "weeklyRecap"
    ].indexOf(eventType) !== -1;

  return {
    eventType: eventType,
    enabled: enabledByDefault,
    portal: enabledByDefault,
    discord:
      [
        "gameSubmitted",
        "achievementUnlocked",
        "promotion",
        "relegation",
        "hallOfFame",
        "recordBroken",
        "commissionerNews",
        "streamScheduled",
        "eventLifecycleTransition",
        "weeklyRecap"
      ].indexOf(eventType) !== -1,
    timeline:
      [
        "gameSubmitted",
        "achievementUnlocked",
        "promotion",
        "relegation",
        "hallOfFame",
        "recordBroken",
        "eventLifecycleTransition"
      ].indexOf(eventType) !== -1,
    news:
      [
        "commissionerNews",
        "seasonStarted",
        "seasonEnded",
        "eventLifecycleTransition",
        "leagueChampion",
        "divisionChampion"
      ].indexOf(eventType) !== -1,
    commissionerFeed: enabledByDefault,
    email: false,
    push: false,
    publicApi: false,
    priority:
      getAutomationEventPriority(eventType),
    templateId: eventType
  };

}

function getAutomationTemplateForEvent(eventType) {

  return getAutomationTemplates()
    .filter(function(template) {
      return (
        template.enabled &&
        template.eventType === eventType
      );
    })[0] || null;

}

function renderAutomationTemplate(template, context) {

  return getAutomationString(template)
    .replace(/{{player}}/g, context.player || "League")
    .replace(/{{division}}/g, context.division || "All Divisions")
    .replace(/{{message}}/g, context.message || "");

}

function buildAutomationRule(row) {

  return {
    eventType: getAutomationString(row[0]),
    enabled: getAutomationBoolean(row[1]),
    portal: getAutomationBoolean(row[2]),
    discord: getAutomationBoolean(row[3]),
    timeline: getAutomationBoolean(row[4]),
    news: getAutomationBoolean(row[5]),
    commissionerFeed: getAutomationBoolean(row[6]),
    email: getAutomationBoolean(row[7]),
    push: getAutomationBoolean(row[8]),
    publicApi: getAutomationBoolean(row[9]),
    priority: getAutomationString(row[10]) || "normal",
    templateId: getAutomationString(row[11])
  };

}

function buildAutomationTemplate(row) {

  return {
    templateId: getAutomationString(row[0]),
    eventType: getAutomationString(row[1]),
    name: getAutomationString(row[2]),
    title: getAutomationString(row[3]),
    body: getAutomationString(row[4]),
    discordFormat: getAutomationString(row[5]) || "embed",
    enabled: getAutomationBoolean(row[6])
  };

}

function buildAutomationQueueItem(row) {

  return {
    queueId: getAutomationString(row[0]),
    eventId: getAutomationString(row[1]),
    eventType: getAutomationString(row[2]),
    destination: getAutomationString(row[3]),
    status: getAutomationString(row[4]),
    timestamp: getAutomationString(row[5]),
    attempts: Number(row[6]) || 0,
    lastAttempt: getAutomationString(row[7]),
    reason: getAutomationString(row[8]),
    payload: getAutomationString(row[9])
  };

}

function buildAutomationEventRecord(row) {

  return {
    eventId: getAutomationString(row[0]),
    eventType: getAutomationString(row[1]),
    category: getAutomationString(row[2]),
    priority: getAutomationString(row[3]),
    player: getAutomationString(row[4]),
    division: getAutomationString(row[5]),
    timestamp: getAutomationString(row[6]),
    message: getAutomationString(row[7]),
    payload: getAutomationString(row[8]),
    destinations: getAutomationString(row[9]),
    status: getAutomationString(row[10])
  };

}

function getRuleDestinations(rule) {

  return AUTOMATION_DESTINATIONS
    .filter(function(destination) {
      return rule[destination] === true;
    });

}

function getAutomationEventTypeFromRecord(event) {

  return getAutomationString(event.eventType) ||
    AUTOMATION_EVENT_DEFINITIONS
      .filter(function(definition) {
        return definition[1] === event.category;
      })
      .map(function(definition) {
        return definition[0];
      })[0] ||
    "commissionerNews";

}

function getAutomationEventLabel(eventType) {

  const match =
    AUTOMATION_EVENT_DEFINITIONS
      .filter(function(definition) {
        return definition[0] === eventType;
      })[0];

  return match
    ? match[3]
    : eventType;

}

function getAutomationEventCategory(eventType) {

  const match =
    AUTOMATION_EVENT_DEFINITIONS
      .filter(function(definition) {
        return definition[0] === eventType;
      })[0];

  return match
    ? match[1]
    : "Automation";

}

function getAutomationEventPriority(eventType) {

  const match =
    AUTOMATION_EVENT_DEFINITIONS
      .filter(function(definition) {
        return definition[0] === eventType;
      })[0];

  return match
    ? match[2]
    : "normal";

}

function getStandingsSnapshot() {

  return {
    main:
      JSON.parse(getStandings({ parameter: { division: "main" } }).getContent()),
    pga:
      JSON.parse(getStandings({ parameter: { division: "pga" } }).getContent()),
    pgb:
      JSON.parse(getStandings({ parameter: { division: "pgb" } }).getContent())
  };

}

function getAutomationHealthSummary() {

  const integrity =
    JSON.parse(getIntegrityDashboard().getContent());

  return {
    healthScore:
      integrity.integrity ? integrity.integrity.healthScore : 0,
    healthStatus:
      integrity.integrity ? integrity.integrity.healthStatus : "unknown",
    errors:
      integrity.integrity ? integrity.integrity.summary.errors : 0,
    warnings:
      integrity.integrity ? integrity.integrity.summary.warnings : 0
  };

}

function safeAutomationJson(callback) {

  try {
    return JSON.parse(callback().getContent());
  }
  catch (err) {
    return {
      error:
        String(err && err.message ? err.message : err)
    };
  }

}

function findAutomationSheetRow(sheet, column, value) {

  const values =
    sheet
      .getDataRange()
      .getValues();

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    if (getAutomationString(values[index][column - 1]) === value)
      return index + 1;
  }

  return 0;

}

function parseAutomationPayload(payload) {

  if (payload && typeof payload === "object")
    return payload;

  try {
    return JSON.parse(getAutomationString(payload) || "{}");
  }
  catch (err) {
    return {};
  }

}

function getAutomationTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getAutomationString(value) {

  if (value === null || value === undefined)
    return "";

  return String(value).trim();

}

function getAutomationBoolean(value) {

  if (value === true)
    return true;

  return [
    "true",
    "yes",
    "1",
    "on"
  ].indexOf(
    getAutomationString(value).toLowerCase()
  ) !== -1;

}
