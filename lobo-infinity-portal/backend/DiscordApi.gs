/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * DiscordApi.gs
 *
 * Commissioner-controlled Discord automation service.
 *******************************************************/

const DISCORD_CONFIG_HEADERS = [
  "Key",
  "Value",
  "Description"
];

const DISCORD_LOG_HEADERS = [
  "Timestamp",
  "Event",
  "Title",
  "Webhook",
  "Success",
  "Failure",
  "Retry Count",
  "Payload",
  "Response",
  "Status"
];

const DISCORD_DEFAULT_CONFIG = [
  [
    "enabled",
    "false",
    "Enable automatic Discord announcements."
  ],
  [
    "webhookUrl",
    "",
    "Discord webhook URL. Never returned by public APIs."
  ],
  [
    "announcementChannel",
    "announcements",
    "Human-readable announcement channel label."
  ],
  [
    "adminChannel",
    "league-admin",
    "Human-readable admin channel label."
  ],
  [
    "rateLimitPerHour",
    "12",
    "Maximum automated Discord sends per hour."
  ],
  [
    "automationEvents",
    "gameSubmitted,achievementUnlocked,promotion,relegation,seasonStart,seasonEnd,leagueNews,commissionerNews,newStream,armyListOfTheWeek,playerOfTheWeek,missionRotation,factionLeaderChanges,hallOfFameInduction,leagueRecordsBroken",
    "Comma-separated enabled automation event keys."
  ],
  [
    "retryLimit",
    "3",
    "Maximum retry attempts for failed sends."
  ],
  [
    "brandingColor",
    "12653087",
    "Discord embed color decimal."
  ],
  [
    "thumbnailUrl",
    "",
    "Optional default embed thumbnail URL."
  ],
  [
    "lastAutomationRun",
    "",
    "Last scheduled automation run timestamp."
  ]
];

const DISCORD_EVENT_LABELS = {
  gameSubmitted: "Game Submitted",
  achievementUnlocked: "Achievement Unlocked",
  promotion: "Promotion",
  relegation: "Relegation",
  seasonStart: "Season Start",
  seasonEnd: "Season End",
  leagueNews: "League News",
  commissionerNews: "Commissioner News",
  newStream: "New Stream",
  armyListOfTheWeek: "Army List of the Week",
  playerOfTheWeek: "Player of the Week",
  missionRotation: "Mission Rotation",
  factionLeaderChanges: "Faction Leader Changes",
  hallOfFameInduction: "Hall of Fame Induction",
  leagueRecordsBroken: "League Records Broken",
  weeklyStandings: "Weekly Standings",
  upcomingGamesReminder: "Upcoming Games Reminder",
  seasonCountdown: "Season Countdown",
  test: "Test Connection",
  manual: "Manual Announcement"
};

function getDiscordOperationsStatus() {

  const config =
    getDiscordConfig();

  const log =
    getDiscordLogEntries(25);

  return {
    enabled:
      getDiscordBoolean(config.enabled),
    configured:
      getDiscordString(config.webhookUrl) !== "",
    webhookMasked:
      maskDiscordWebhook(config.webhookUrl),
    announcementChannel:
      getDiscordString(config.announcementChannel),
    adminChannel:
      getDiscordString(config.adminChannel),
    rateLimitPerHour:
      Number(config.rateLimitPerHour) || 12,
    retryLimit:
      Number(config.retryLimit) || 3,
    automationEvents:
      getDiscordEventList(config.automationEvents),
    lastAutomationRun:
      getDiscordString(config.lastAutomationRun),
    queueDepth:
      log.filter(function(entry) {
        return entry.status === "Queued" || entry.status === "Retry";
      }).length,
    failures:
      log.filter(function(entry) {
        return !entry.success;
      }).length,
    lastResult:
      log[0] || null,
    log: log,
    preview:
      previewDiscordAnnouncement({
        event: "gameSubmitted"
      }).preview
  };

}

function updateDiscordSettings(e) {

  const params =
    getOperationsParams(e);

  const updates = {};

  if (params.enabled !== undefined)
    updates.enabled =
      getDiscordBoolean(params.enabled)
        ? "true"
        : "false";

  if (params.webhookUrl !== undefined) {
    const webhookUrl =
      getDiscordString(params.webhookUrl);

    if (
      webhookUrl !== "" &&
      !isDiscordWebhookUrl(webhookUrl)
    )
      return jsonOutput({
        success: false,
        error: "Discord webhook URL must be a Discord webhook https URL."
      });

    if (webhookUrl !== "")
      updates.webhookUrl = webhookUrl;
  }

  [
    "announcementChannel",
    "adminChannel",
    "rateLimitPerHour",
    "retryLimit",
    "automationEvents",
    "thumbnailUrl",
    "brandingColor"
  ].forEach(function(key) {

    if (params[key] !== undefined)
      updates[key] =
        getDiscordString(params[key]);

  });

  setDiscordConfigValues(updates);

  return jsonOutput({
    success: true,
    discord: getDiscordOperationsStatus()
  });

}

function testDiscordWebhook(e) {

  const params =
    getOperationsParams(e);

  return jsonOutput(
    sendDiscordAnnouncementPayload(
      "test",
      buildDiscordTestPayload(
        params.message ||
        "Discord automation is connected."
      ),
      {
        allowDisabled: true
      }
    )
  );

}

function previewDiscordAnnouncement(e) {

  const params =
    e && e.parameter
      ? e.parameter
      : e || {};

  const event =
    getDiscordString(params.event) ||
    "gameSubmitted";

  const payload =
    buildDiscordAnnouncementPayload(
      event,
      params
    );

  return {
    success: true,
    preview: {
      event: event,
      label:
        DISCORD_EVENT_LABELS[event] ||
        event,
      content:
        payload.content || "",
      embeds:
        payload.embeds || []
    }
  };

}

function sendDiscordAnnouncement(e) {

  const params =
    getOperationsParams(e);

  const event =
    getDiscordString(params.event) ||
    "manual";

  const payload =
    event === "manual"
      ? buildDiscordManualPayload(params)
      : buildDiscordAnnouncementPayload(
          event,
          params
        );

  return jsonOutput(
    sendDiscordAnnouncementPayload(
      event,
      payload,
      {}
    )
  );

}

function resendDiscordAnnouncement(e) {

  const params =
    getOperationsParams(e);

  const rowNumber =
    Number(params.rowNumber) || 0;

  const entry =
    getDiscordLogEntryByRow(rowNumber);

  if (!entry)
    return jsonOutput({
      success: false,
      error: "Discord log entry not found."
    });

  return jsonOutput(
    sendDiscordAnnouncementPayload(
      entry.event,
      JSON.parse(entry.payload || "{}"),
      {
        force: true,
        retryCount:
          entry.retryCount + 1
      }
    )
  );

}

function disableDiscordAutomation() {

  setDiscordConfigValues({
    enabled: "false"
  });

  return jsonOutput({
    success: true
  });

}

function runDiscordAutomationJob(e) {

  const params =
    getOperationsParams(e);

  const cadence =
    getDiscordString(params.cadence) ||
    "weekly";

  const events =
    cadence === "daily"
      ? ["upcomingGamesReminder"]
      : cadence === "monthly"
        ? ["seasonCountdown", "hallOfFameInduction"]
        : ["weeklyStandings", "playerOfTheWeek", "leagueRecordsBroken"];

  const results =
    events.map(function(event) {
      return sendDiscordAnnouncementPayload(
        event,
        buildDiscordAnnouncementPayload(event, params),
        {}
      );
    });

  setDiscordConfigValues({
    lastAutomationRun:
      getDiscordTimestamp()
  });

  return jsonOutput({
    success: true,
    results: results
  });

}

function announceDiscordGameSubmitted(game) {

  return sendDiscordAnnouncementPayload(
    "gameSubmitted",
    buildDiscordGamePayload(game),
    {}
  );

}

function announceDiscordAchievement(player, achievement) {

  const tier =
    getDiscordString(achievement.tier)
      .toLowerCase();

  if (
    tier !== "legendary" &&
    tier !== "epic" &&
    !achievement.commissionerAward &&
    getDiscordString(achievement.category) !== "Hall of Fame"
  )
    return {
      success: true,
      skipped: true
    };

  return sendDiscordAnnouncementPayload(
    "achievementUnlocked",
    buildDiscordAchievementPayload(
      player,
      achievement
    ),
    {}
  );

}

function buildDiscordAnnouncementPayload(event, params) {

  switch (event) {

    case "gameSubmitted":
      return buildDiscordGamePayload(
        getDiscordLatestGame()
      );

    case "achievementUnlocked":
      return buildDiscordAchievementPayload(
        params.player || getDiscordPlayerOfTheWeek().player,
        {
          name: params.achievement || "League Milestone",
          description: "A major league achievement was unlocked.",
          tier: params.tier || "Epic",
          points: params.points || 0,
          icon: "🏅"
        }
      );

    case "promotion":
    case "relegation":
      return buildDiscordMovementPayload(event);

    case "seasonStart":
    case "seasonEnd":
    case "seasonCountdown":
      return buildDiscordSeasonPayload(event);

    case "leagueNews":
    case "commissionerNews":
      return buildDiscordNewsPayload();

    case "newStream":
      return buildDiscordStreamPayload();

    case "armyListOfTheWeek":
      return buildDiscordArmyListPayload();

    case "playerOfTheWeek":
      return buildDiscordPlayerOfTheWeekPayload();

    case "missionRotation":
      return buildDiscordMissionPayload();

    case "factionLeaderChanges":
      return buildDiscordFactionPayload();

    case "hallOfFameInduction":
      return buildDiscordHallOfFamePayload();

    case "leagueRecordsBroken":
      return buildDiscordRecordsPayload();

    case "weeklyStandings":
      return buildDiscordWeeklyStandingsPayload();

    case "upcomingGamesReminder":
      return buildDiscordReminderPayload();

    default:
      return buildDiscordManualPayload(params);

  }

}

function buildDiscordGamePayload(game) {

  if (!game)
    return buildDiscordInfoPayload(
      "No Game Available",
      "No completed game is available for announcement."
    );

  const result =
    formatLeagueResult(game);

  const link =
    buildDeepLink("game", game);

  return {
    content:
      "⚔ " +
      result.division +
      " Division",
    embeds: [
      buildDiscordEmbed({
        title:
          result.winner +
          " defeated " +
          result.loser,
        description:
          "Mission: " +
          result.mission,
        fields: [
          buildDiscordField("Open", "[View Match](" + link.url + ")", false),
          buildDiscordField("Tournament Points", result.tp, true),
          buildDiscordField("Objective Points", result.op, true),
          buildDiscordField("Victory Points", result.vp, true),
          buildDiscordField("Winner Faction", game.winnerFaction || "Not recorded", true),
          buildDiscordField("Loser Faction", game.loserFaction || "Not recorded", true),
          buildDiscordField("Date", game.date || "Not recorded", true)
        ],
        url:
          link.url
      })
    ]
  };

}

function buildDiscordAchievementPayload(player, achievement) {

  const playerName =
    getPlayerDisplayName(player);

  const link =
    buildDeepLink("achievement", {
      achievementId: achievement.id || achievement.name || achievement.title,
      name: achievement.name || achievement.title,
      player: player,
      description: achievement.description
    });

  return {
    content:
      "🏅 Achievement unlocked",
    embeds: [
      buildDiscordEmbed({
        title:
          playerName +
          " unlocked " +
          getDiscordString(achievement.name || achievement.title),
        description:
          getDiscordString(achievement.description) ||
          "A major league achievement was recorded.",
        fields: [
          buildDiscordField("Open", "[View Achievement](" + link.url + ")", false),
          buildDiscordField("Tier", achievement.tier || "Achievement", true),
          buildDiscordField("Points", achievement.points || 0, true),
          buildDiscordField("Category", achievement.category || "League", true)
        ],
        thumbnail:
          achievement.thumbnailUrl ||
          achievement.icon ||
          "",
        url:
          link.url
      })
    ]
  };

}

function buildDiscordMovementPayload(event) {

  const intelligence =
    getIntelligenceObject();

  const item =
    event === "promotion"
      ? intelligence.promotionBattle[0]
      : intelligence.relegationBattle[0];

  if (!item)
    return buildDiscordInfoPayload(
      DISCORD_EVENT_LABELS[event],
      "No current movement watch item is available."
    );

  return {
    content:
      event === "promotion"
        ? "⬆ Promotion watch"
        : "⬇ Relegation watch",
    embeds: [
      buildDiscordEmbed({
        title:
          getPlayerDisplayName(item.player) +
          " movement update",
        description: item.story,
        fields: [
          buildDiscordField("Open", "[View Career](" + buildDeepLink(event, item).url + ")", false),
          buildDiscordField("Division", item.division, true),
          buildDiscordField("Rank", "#" + item.rank, true),
          buildDiscordField("TP", item.tp, true),
          buildDiscordField("OP", item.op, true),
          buildDiscordField("VP", item.vp, true)
        ],
        url:
          buildDeepLink(event, item).url
      })
    ]
  };

}

function buildDiscordSeasonPayload(event) {

  const season =
    getSeasonStatusObject();

  return {
    content:
      "📅 " +
      DISCORD_EVENT_LABELS[event],
    embeds: [
      buildDiscordEmbed({
        title: season.currentSeasonName,
        description:
          event === "seasonEnd"
            ? "The current season has reached its closing window."
            : "The league season is active.",
        fields: [
          buildDiscordField("Open", "[View Season](" + buildDeepLink(event, season).url + ")", false),
          buildDiscordField("Start", season.startDate || "Not set", true),
          buildDiscordField("End", season.endDate || "Not set", true),
          buildDiscordField("Matches Played", season.matchesPlayed, true),
          buildDiscordField("Remaining Matches", season.remainingMatches, true)
        ],
        url:
          buildDeepLink(event, season).url
      })
    ]
  };

}

function buildDiscordNewsPayload() {

  const news =
    JSON.parse(
      getCommissionerNews().getContent()
    ).news || [];

  const item =
    news[0];

  if (!item)
    return buildDiscordInfoPayload(
      "League News",
      "No league news is available."
    );

  return {
    content: "📣 League news",
    embeds: [
      buildDiscordEmbed({
        title: item.title,
        description: item.body,
        fields: [
          buildDiscordField("Open", "[View News](" + buildDeepLink("news", item).url + ")", false),
          buildDiscordField("Date", item.date || "Live", true)
        ],
        url:
          item.link || buildDeepLink("news", item).url
      })
    ]
  };

}

function buildDiscordStreamPayload() {

  const streams =
    getOperationsStreams();

  const stream =
    streams.filter(function(item) {
      return item.featured;
    })[0] ||
    streams[0];

  if (!stream)
    return buildDiscordInfoPayload(
      "New Stream",
      "No stream is configured."
    );

  return {
    content: "📺 Stream spotlight",
    embeds: [
      buildDiscordEmbed({
        title:
          stream.player1 +
          " vs " +
          stream.player2,
        description:
          stream.mission ||
          "League stream",
        fields: [
          buildDiscordField("Open", "[View Stream](" + buildDeepLink("stream", stream).url + ")", false),
          buildDiscordField("Division", stream.division || "Not recorded", true),
          buildDiscordField("Player 1 Faction", stream.player1Faction || "Not recorded", true),
          buildDiscordField("Player 2 Faction", stream.player2Faction || "Not recorded", true)
        ],
        url:
          buildDeepLink("stream", stream).url
      })
    ]
  };

}

function buildDiscordArmyListPayload() {

  const data =
    JSON.parse(
      getArmyLists().getContent()
    );

  const list =
    data.community &&
    data.community.trendingLists
      ? data.community.trendingLists[0]
      : null;

  if (!list)
    return buildDiscordInfoPayload(
      "Army List of the Week",
      "No approved army list is available."
    );

  return {
    content: "🧰 Army List of the Week",
    embeds: [
      buildDiscordEmbed({
        title: list.armyName,
        description:
          list.description ||
          "Approved community army list.",
        fields: [
          buildDiscordField("Open", "[View Army List](" + buildDeepLink("armyList", list).url + ")", false),
          buildDiscordField("Player", getPlayerDisplayName(list.player), true),
          buildDiscordField("Faction", list.faction, true),
          buildDiscordField("Score", list.score, true)
        ],
        url:
          buildDeepLink("armyList", list).url
      })
    ]
  };

}

function buildDiscordPlayerOfTheWeekPayload() {

  const player =
    getDiscordPlayerOfTheWeek();

  return {
    content: "⭐ Player of the Week",
    embeds: [
      buildDiscordEmbed({
        title:
          getPlayerDisplayName(player.player),
        description:
          player.story,
        fields: [
          buildDiscordField("Open", "[View Profile](" + buildDeepLink("player", player).url + ")", false),
          buildDiscordField("Division", player.division, true),
          buildDiscordField("Current Streak", player.games + " games", true)
        ],
        url:
          buildDeepLink("player", player).url
      })
    ]
  };

}

function buildDiscordMissionPayload() {

  const missions =
    buildMissionApiSummaries();

  const mission =
    missions[0];

  if (!mission)
    return buildDiscordInfoPayload(
      "Mission Rotation",
      "No mission data is available."
    );

  return {
    content: "🗺 Mission rotation",
    embeds: [
      buildDiscordEmbed({
        title: mission.mission,
        description: "Current mission activity signal.",
        fields: [
          buildDiscordField("Open", "[View Mission](" + buildDeepLink("mission", mission).url + ")", false),
          buildDiscordField("Games", mission.games, true),
          buildDiscordField("Average OP", mission.averageOP, true),
          buildDiscordField("First Turn Win %", mission.firstTurnWinRate + "%", true)
        ],
        url:
          buildDeepLink("mission", mission).url
      })
    ]
  };

}

function buildDiscordFactionPayload() {

  const factions =
    buildFactionApiSummaries();

  const faction =
    factions[0];

  if (!faction)
    return buildDiscordInfoPayload(
      "Faction Leader Changes",
      "No faction data is available."
    );

  return {
    content: "🛰 Faction watch",
    embeds: [
      buildDiscordEmbed({
        title: faction.name,
        description: "Current faction leaderboard signal.",
        fields: [
          buildDiscordField("Open", "[View Faction](" + buildDeepLink("faction", faction).url + ")", false),
          buildDiscordField("Games", faction.games, true),
          buildDiscordField("Win Rate", faction.winRate + "%", true),
          buildDiscordField("Top Player", getPlayerDisplayName(faction.topPlayer), true)
        ],
        url:
          buildDeepLink("faction", faction).url
      })
    ]
  };

}

function buildDiscordHallOfFamePayload() {

  const hall =
    JSON.parse(
      getHallOfFame().getContent()
    );

  const leader =
    hall.playerCareers &&
    hall.playerCareers[0];

  if (!leader)
    return buildDiscordInfoPayload(
      "Hall of Fame",
      "No Hall of Fame entry is available."
    );

  return {
    content: "🏛 Hall of Fame",
    embeds: [
      buildDiscordEmbed({
        title:
          getPlayerDisplayName(leader.player),
        description:
          "Career leader with " +
          leader.achievementPoints +
          " achievement points.",
        fields: [
          buildDiscordField("Open", "[View Legacy](" + buildDeepLink("hallOfFame", leader).url + ")", false),
          buildDiscordField("Career Games", leader.games, true),
          buildDiscordField("Career Wins", leader.wins, true),
          buildDiscordField("Career TP", leader.tp, true)
        ],
        url:
          buildDeepLink("hallOfFame", leader).url
      })
    ]
  };

}

function buildDiscordRecordsPayload() {

  const records =
    getLeagueRecords(
      getAllRecentGameObjects()
    );

  const record =
    records.largestOPMargin ||
    records.highestScoringGame;

  if (!record)
    return buildDiscordInfoPayload(
      "League Records",
      "No record-breaking game is available."
    );

  return {
    content: "📈 League record watch",
    embeds: [
      buildDiscordEmbed({
        title:
          "Record tracked",
        description:
          record.story,
        fields: [
          buildDiscordField("Open", "[View Record](" + buildDeepLink(record.id ? "game" : "hallOfFame", record).url + ")", false),
          buildDiscordField("Mission", record.mission || "Not recorded", true),
          buildDiscordField("OP", record.op || "", true),
          buildDiscordField("VP", record.vp || "", true)
        ],
        url:
          buildDeepLink(record.id ? "game" : "hallOfFame", record).url
      })
    ]
  };

}

function buildDiscordWeeklyStandingsPayload() {

  const standings =
    buildStandingsResponse(
      getStandingsDivisionConfig("main")
    );

  return {
    content: "📊 Weekly standings",
    embeds: [
      buildDiscordEmbed({
        title: "Main Man Top Players",
        description:
          standings.standings
            .slice(0, 5)
            .map(function(player) {
              return (
                "#" +
                player.rank +
                " " +
                getPlayerDisplayName(player.player) +
                " — " +
                formatTournamentScore(player) +
                ", " +
                formatObjectiveScore(player)
              );
            })
            .join("\n"),
        url:
          buildDeepLink("weeklyReport", {}).url
      })
    ]
  };

}

function buildDiscordReminderPayload() {

  const season =
    getSeasonStatusObject();

  return buildDiscordInfoPayload(
    "Upcoming Games Reminder",
    "There are " +
      season.remainingMatches +
      " expected matches remaining in " +
      season.currentSeasonName +
      ".",
    buildDeepLink("weeklyReport", season).url
  );

}

function buildDiscordManualPayload(params) {

  const link =
    getDiscordString(params.link) ||
    buildDeepLink(
      params.eventType ||
      params.event ||
      "commissionerNews",
      params
    ).url;

  return {
    content:
      getDiscordString(params.content),
    embeds: [
      buildDiscordEmbed({
        title:
          getDiscordString(params.title) ||
          "League Announcement",
        description:
          getDiscordString(params.message) ||
          "Commissioner announcement.",
        url:
          link
      })
    ]
  };

}

function buildDiscordTestPayload(message) {

  return {
    content: "Lobo Infinity League Discord test",
    embeds: [
      buildDiscordEmbed({
        title: "Discord automation online",
        description: message,
        fields: [
          buildDiscordField("Portal", "Connected", true),
          buildDiscordField("Timestamp", getDiscordTimestamp(), true)
        ],
        url:
          buildDeepLink("automation", {}).url
      })
    ]
  };

}

function buildDiscordInfoPayload(title, description, url) {

  return {
    content: title,
    embeds: [
      buildDiscordEmbed({
        title: title,
        description: description,
        url:
          url || buildDeepLink("standings", {}).url
      })
    ]
  };

}

function sendDiscordAnnouncementPayload(event, payload, options) {

  options = options || {};

  const config =
    getDiscordConfig();

  const webhookUrl =
    getDiscordString(config.webhookUrl);

  const enabled =
    getDiscordBoolean(config.enabled);

  if (
    !enabled &&
    !options.allowDisabled
  ) {
    const skipped =
      logDiscordAutomation(
        event,
        payload,
        webhookUrl,
        true,
        "Automation disabled.",
        options.retryCount || 0,
        "Skipped"
      );

    return {
      success: true,
      skipped: true,
      log: skipped
    };
  }

  if (webhookUrl === "") {
    const missing =
      logDiscordAutomation(
        event,
        payload,
        webhookUrl,
        false,
        "Webhook URL is not configured.",
        options.retryCount || 0,
        "Queued"
      );

    return {
      success: false,
      error: "Webhook URL is not configured.",
      log: missing
    };
  }

  if (
    !options.force &&
    isDuplicateDiscordAnnouncement(
      event,
      payload
    )
  ) {
    const duplicate =
      logDiscordAutomation(
        event,
        payload,
        webhookUrl,
        true,
        "Duplicate announcement skipped.",
        options.retryCount || 0,
        "Skipped"
      );

    return {
      success: true,
      skipped: true,
      duplicate: true,
      log: duplicate
    };
  }

  if (!canSendDiscordMessage(config)) {
    const limited =
      logDiscordAutomation(
        event,
        payload,
        webhookUrl,
        false,
        "Rate limit reached.",
        options.retryCount || 0,
        "Queued"
      );

    return {
      success: false,
      error: "Discord rate limit reached.",
      log: limited
    };
  }

  try {
    const response =
      UrlFetchApp.fetch(webhookUrl, {
        contentType: "application/json",
        method: "post",
        muteHttpExceptions: true,
        payload: JSON.stringify(payload)
      });

    const code =
      response.getResponseCode();

    const success =
      code >= 200 &&
      code < 300;

    const entry =
      logDiscordAutomation(
        event,
        payload,
        webhookUrl,
        success,
        success
          ? ""
          : "Discord returned HTTP " + code,
        options.retryCount || 0,
        success ? "Sent" : "Retry",
        response.getContentText()
      );

    return {
      success: success,
      statusCode: code,
      log: entry,
      error:
        success
          ? ""
          : "Discord returned HTTP " + code
    };
  }
  catch (err) {
    const entry =
      logDiscordAutomation(
        event,
        payload,
        webhookUrl,
        false,
        String(err && err.message ? err.message : err),
        options.retryCount || 0,
        "Retry"
      );

    return {
      success: false,
      error: entry.failure,
      log: entry
    };
  }

}

function isDuplicateDiscordAnnouncement(event, payload) {

  const title =
    getDiscordPayloadTitle(payload);

  return getDiscordLogEntries(100)
    .some(function(entry) {
      return (
        entry.event === event &&
        entry.title === title &&
        entry.success === true &&
        entry.status === "Sent"
      );
    });

}

function buildDiscordEmbed(options) {

  const config =
    getDiscordConfig();

  const embed = {
    title:
      getDiscordString(options.title),
    description:
      getDiscordString(options.description),
    color:
      Number(config.brandingColor) || 12653087,
    fields:
      options.fields || [],
    footer: {
      text: "Lobo Infinity League"
    },
    timestamp:
      new Date().toISOString()
  };

  const url =
    getDiscordString(options.url);

  if (url !== "")
    embed.url = url;

  const thumbnail =
    getDiscordString(options.thumbnail) ||
    getDiscordString(config.thumbnailUrl);

  if (/^https?:\/\//i.test(thumbnail))
    embed.thumbnail = {
      url: thumbnail
    };

  return embed;

}

function buildDiscordField(name, value, inline) {

  return {
    name: getDiscordString(name),
    value:
      getDiscordString(value) ||
      "Not recorded",
    inline: inline === true
  };

}

function getDiscordConfig() {

  const sheet =
    ensureDiscordConfigSheet();

  const columns =
    getDiscordConfigColumns(sheet);

  const values =
    sheet
      .getDataRange()
      .getValues();

  const config = {};

  values
    .slice(1)
    .forEach(function(row) {
      const key =
        getDiscordString(row[columns.key]);

      if (key !== "")
        config[key] =
          getDiscordString(row[columns.value]);
    });

  return config;

}

function setDiscordConfigValues(updates) {

  const sheet =
    ensureDiscordConfigSheet();

  const columns =
    getDiscordConfigColumns(sheet);

  Object.keys(updates)
    .forEach(function(key) {
      setDiscordConfigValue(
        sheet,
        columns,
        key,
        updates[key]
      );
    });

}

function ensureDiscordConfigSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.DISCORD_CONFIG);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.DISCORD_CONFIG);

  ensureDiscordConfigColumns(sheet);
  ensureDiscordDefaultConfig(sheet);

  return sheet;

}

function ensureDiscordConfigColumns(sheet) {

  const width =
    Math.max(sheet.getLastColumn(), 1);

  const headers =
    sheet
      .getRange(1, 1, 1, width)
      .getValues()[0]
      .map(getDiscordString);

  let nextColumn =
    headers.length === 1 &&
    headers[0] === ""
      ? 0
      : headers.length;

  DISCORD_CONFIG_HEADERS.forEach(function(header) {
    if (headers.indexOf(header) !== -1)
      return;

    sheet
      .getRange(1, nextColumn + 1)
      .setValue(header);

    nextColumn++;
  });

}

function ensureDiscordDefaultConfig(sheet) {

  const columns =
    getDiscordConfigColumns(sheet);

  const values =
    sheet
      .getDataRange()
      .getValues();

  const existing = {};

  values
    .slice(1)
    .forEach(function(row) {
      const key =
        getDiscordString(row[columns.key]);

      if (key !== "")
        existing[key] = true;
    });

  DISCORD_DEFAULT_CONFIG.forEach(function(row) {
    if (existing[row[0]])
      return;

    const targetRow =
      sheet.getLastRow() + 1;

    sheet
      .getRange(targetRow, columns.key + 1)
      .setValue(row[0]);

    sheet
      .getRange(targetRow, columns.value + 1)
      .setValue(row[1]);

    sheet
      .getRange(targetRow, columns.description + 1)
      .setValue(row[2]);
  });

}

function getDiscordConfigColumns(sheet) {

  const headers =
    sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(getDiscordString);

  return {
    key: headers.indexOf("Key"),
    value: headers.indexOf("Value"),
    description: headers.indexOf("Description")
  };

}

function setDiscordConfigValue(sheet, columns, key, value) {

  const values =
    sheet
      .getDataRange()
      .getValues();

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    if (
      getDiscordString(values[index][columns.key]) === key
    ) {
      sheet
        .getRange(index + 1, columns.value + 1)
        .setValue(value);
      return;
    }
  }

  const row =
    sheet.getLastRow() + 1;

  sheet
    .getRange(row, columns.key + 1)
    .setValue(key);

  sheet
    .getRange(row, columns.value + 1)
    .setValue(value);

}

function getDiscordLogEntries(limit) {

  const sheet =
    ensureDiscordLogSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  return values
    .slice(1)
    .map(function(row, index) {
      return buildDiscordLogEntry(
        row,
        index + 2
      );
    })
    .reverse()
    .slice(0, limit || 25);

}

function getDiscordLogEntryByRow(rowNumber) {

  const sheet =
    ensureDiscordLogSheet();

  if (
    rowNumber < 2 ||
    rowNumber > sheet.getLastRow()
  )
    return null;

  return buildDiscordLogEntry(
    sheet
      .getRange(rowNumber, 1, 1, DISCORD_LOG_HEADERS.length)
      .getValues()[0],
    rowNumber
  );

}

function logDiscordAutomation(event, payload, webhookUrl, success, failure, retryCount, status, responseText) {

  const sheet =
    ensureDiscordLogSheet();

  const entry = {
    rowNumber: sheet.getLastRow() + 1,
    timestamp: getDiscordTimestamp(),
    event: event,
    title: getDiscordPayloadTitle(payload),
    webhook: maskDiscordWebhook(webhookUrl),
    success: success === true,
    failure: failure || "",
    retryCount: Number(retryCount) || 0,
    payload: JSON.stringify(payload),
    response: responseText || "",
    status: status || (success ? "Sent" : "Retry")
  };

  sheet.appendRow([
    entry.timestamp,
    entry.event,
    entry.title,
    entry.webhook,
    entry.success,
    entry.failure,
    entry.retryCount,
    entry.payload,
    entry.response,
    entry.status
  ]);

  return entry;

}

function ensureDiscordLogSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.DISCORD_LOG);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.DISCORD_LOG);

  sheet
    .getRange(1, 1, 1, DISCORD_LOG_HEADERS.length)
    .setValues([DISCORD_LOG_HEADERS]);

  return sheet;

}

function buildDiscordLogEntry(row, rowNumber) {

  return {
    rowNumber: rowNumber,
    timestamp: getDiscordString(row[0]),
    event: getDiscordString(row[1]),
    title: getDiscordString(row[2]),
    webhook: getDiscordString(row[3]),
    success:
      row[4] === true ||
      getDiscordString(row[4]).toLowerCase() === "true",
    failure: getDiscordString(row[5]),
    retryCount: Number(row[6]) || 0,
    payload: getDiscordString(row[7]),
    response: getDiscordString(row[8]),
    status: getDiscordString(row[9])
  };

}

function getDiscordLatestGame() {

  return getAllRecentGameObjects()[0] || null;

}

function getDiscordPlayerOfTheWeek() {

  const streak =
    getLeagueWinStreaks("W")[0];

  if (streak)
    return {
      player: streak.player,
      division: "",
      games: streak.games,
      story: streak.story
    };

  const standings =
    getHallOfFameStandings();

  const leader =
    standings[0] || {
      player: "League",
      division: "",
      games: 0
    };

  return {
    player: leader.player,
    division: leader.division || "",
    games: leader.games || 0,
    story:
      getPlayerDisplayName(leader.player) +
      " is currently setting the league pace."
  };

}

function getIntelligenceObject() {

  return JSON.parse(
    getIntelligence().getContent()
  );

}

function getDiscordPortalUrl(path) {

  return getPortalCanonicalUrl(path);

}

function canSendDiscordMessage(config) {

  const limit =
    Number(config.rateLimitPerHour) || 12;

  const since =
    Date.now() - 60 * 60 * 1000;

  const sent =
    getDiscordLogEntries(100)
      .filter(function(entry) {
        return (
          entry.success &&
          getRecentGameDate(entry.timestamp).getTime() >= since
        );
      }).length;

  return sent < limit;

}

function getDiscordPayloadTitle(payload) {

  if (
    payload &&
    payload.embeds &&
    payload.embeds[0] &&
    payload.embeds[0].title
  )
    return payload.embeds[0].title;

  return getDiscordString(
    payload && payload.content
  );

}

function getDiscordEventList(value) {

  return getDiscordString(value)
    .split(",")
    .map(function(item) {
      return getDiscordString(item);
    })
    .filter(function(item) {
      return item !== "";
    });

}

function maskDiscordWebhook(value) {

  const text =
    getDiscordString(value);

  if (text === "")
    return "";

  return text.slice(0, 32) + "...";

}

function isDiscordWebhookUrl(value) {

  return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/[^\s]+$/i
    .test(getDiscordString(value));

}

function getDiscordBoolean(value) {

  return (
    value === true ||
    getDiscordString(value).toLowerCase() === "true" ||
    getDiscordString(value).toLowerCase() === "yes" ||
    getDiscordString(value) === "1"
  );

}

function getDiscordTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getDiscordString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
