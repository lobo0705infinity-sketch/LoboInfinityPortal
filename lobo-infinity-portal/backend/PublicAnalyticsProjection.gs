/*******************************************************
 * Prepared public Statistics projections.
 *
 * Canonical Apps Script data remains authoritative. The
 * automation worker publishes one validated, public JSON
 * artifact; normal browser reads are served by Vercel.
 *******************************************************/

const PUBLIC_ANALYTICS_PROJECTION_FILE_PROPERTY =
  "PUBLIC_ANALYTICS_PROJECTION_FILE_ID";
const PUBLIC_ANALYTICS_PROJECTION_FILE_NAME =
  "Lobo Infinity Portal - Public Analytics Projection.json";
const PUBLIC_ANALYTICS_DIRTY_EVENTS_PROPERTY =
  "PUBLIC_ANALYTICS_DIRTY_EVENT_IDS";

function refreshPublicAnalyticsProjection(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    const projection = publishPublicAnalyticsProjection_();
    return jsonOutput({
      success: true,
      generatedAt: projection.generatedAt,
      eventCount: Object.keys(projection.events).length,
      fileId: getPublicAnalyticsProjectionFileId_()
    });
  });
}

function markPublicAnalyticsProjectionDirty_(eventId) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const current = parsePublicAnalyticsDirtyEvents_(
      properties.getProperty(PUBLIC_ANALYTICS_DIRTY_EVENTS_PROPERTY)
    );
    const resolved = getEventAnalyticsString(eventId) || EVENT_ENGINE_DEFAULT_EVENT_ID;
    current[resolved] = true;
    properties.setProperty(
      PUBLIC_ANALYTICS_DIRTY_EVENTS_PROPERTY,
      JSON.stringify(Object.keys(current).sort())
    );
  }
  catch (error) {
    console.error("PUBLIC_ANALYTICS_DIRTY_MARK_FAILED " + String(error));
  }
}

function publishDirtyPublicAnalyticsProjectionsBestEffort_() {
  const properties = PropertiesService.getScriptProperties();
  const dirty = parsePublicAnalyticsDirtyEvents_(
    properties.getProperty(PUBLIC_ANALYTICS_DIRTY_EVENTS_PROPERTY)
  );

  if (Object.keys(dirty).length === 0)
    return { refreshed: false, success: true };

  try {
    const projection = publishPublicAnalyticsProjection_();
    properties.deleteProperty(PUBLIC_ANALYTICS_DIRTY_EVENTS_PROPERTY);
    return {
      refreshed: true,
      generatedAt: projection.generatedAt,
      success: true
    };
  }
  catch (error) {
    console.error(
      "PUBLIC_ANALYTICS_PROJECTION_REFRESH_FAILED " +
      JSON.stringify({
        eventIds: Object.keys(dirty),
        message: error && error.message ? String(error.message) : String(error)
      })
    );
    return {
      error: error && error.message ? String(error.message) : String(error),
      refreshed: false,
      success: false
    };
  }
}

function publishPublicAnalyticsProjection_() {
  const projection = buildPublicAnalyticsProjection_();
  validatePublicAnalyticsProjection_(projection);
  const json = JSON.stringify(projection);
  const file = getOrCreatePublicAnalyticsProjectionFile_();

  file.setContent(json);
  file.setDescription(
    "Prepared public Statistics projection. Canonical data remains in the Lobo Apps Script project."
  );

  return projection;
}

function buildPublicAnalyticsProjection_() {
  const events = {};
  const snapshots = getEventEngineSnapshot().events || [];

  snapshots.forEach(function(event) {
    const eventId = getEventAnalyticsString(event && event.id);
    if (!eventId)
      return;

    const isLeague =
      getEventAnalyticsString(event.type).toLowerCase() === "league";
    const gameTypes = isLeague
      ? ["all", "league", "tournament", "casual"]
      : ["all"];

    events[eventId] = {};
    gameTypes.forEach(function(gameType) {
      events[eventId][gameType] =
        buildPublicAnalyticsEventProjection_(eventId, gameType);
    });
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    defaultEventId: EVENT_ENGINE_DEFAULT_EVENT_ID,
    events: events
  };
}

function buildPublicAnalyticsEventProjection_(eventId, gameType) {
  const request = {
    parameter: {
      eventId: eventId,
      gameType: gameType
    }
  };
  const context = buildEventAnalyticsContext(request);

  // One shared context owns all four projections. Public navigation never
  // executes this work; it happens only in the projection publisher.
  return {
    eventId: context.eventId,
    eventType: context.eventType,
    gameType: context.gameType,
    players: buildPublicAnalyticsPlayers_(getEventAnalyticsPlayers(context)),
    factions: buildPublicAnalyticsFactions_(getEventAnalyticsFactions(context)),
    missions: buildPublicAnalyticsMissions_(getEventAnalyticsMissions(context)),
    records: buildPublicAnalyticsRecordBook_(buildPublicAnalyticsRecords_(context))
  };
}

function buildPublicAnalyticsPlayers_(divisions) {
  return (divisions || []).map(function(division) {
    return {
      division: division.division,
      divisionLabel: division.divisionLabel,
      standings: (division.standings || []).map(function(player) {
        return {
          displayName: player.displayName || player.player,
          games: Number(player.games) || 0,
          player: player.player,
          tp: Number(player.tp) || 0,
          wins: Number(player.wins) || 0
        };
      })
    };
  });
}

function buildPublicAnalyticsFactions_(factions) {
  return (factions || []).map(function(faction) {
    return {
      averageOP: Number(faction.averageOP) || 0,
      games: Number(faction.games) || 0,
      name: faction.name,
      winRate: Number(faction.winRate) || 0
    };
  });
}

function buildPublicAnalyticsMissions_(missions) {
  return (missions || []).map(function(mission) {
    return {
      averageOP: Number(mission.averageOP) || 0,
      firstTurnWinRate: Number(mission.firstTurnWinRate) || 0,
      games: Number(mission.games) || 0,
      mission: mission.mission
    };
  });
}

function buildPublicAnalyticsRecordBook_(records) {
  const selected = {};
  [
    "highestScoringGame",
    "largestOPMargin",
    "mostActiveFaction",
    "mostActiveMission"
  ].forEach(function(key) {
    const record = records && records[key];
    if (!record) {
      selected[key] = null;
      return;
    }
    selected[key] = {
      displayName: record.displayName || "",
      faction: record.faction || "",
      loser: record.loser || "",
      loserDisplayName: record.loserDisplayName || "",
      name: record.name || "",
      type: record.type || "",
      winner: record.winner || "",
      winnerDisplayName: record.winnerDisplayName || ""
    };
  });
  return selected;
}

function buildPublicAnalyticsRecords_(context) {
  if (!context.isLeague)
    return buildEventAnalyticsRecords(
      getEventAnalyticsResults(context.eventId),
      getEventAnalyticsTeamStandings(context)
    );

  if (context.gameType !== "league")
    return getEventAnalyticsGameTypeRecords(context);

  return getLeagueRecords(
    getAllRecentGameObjectsForEvent(context.eventId, context.gameType)
  );
}

function validatePublicAnalyticsProjection_(projection) {
  if (!projection || !projection.events || !projection.defaultEventId)
    throw new Error("Public analytics projection is invalid.");

  Object.keys(projection.events).forEach(function(eventId) {
    const variants = projection.events[eventId];
    Object.keys(variants).forEach(function(gameType) {
      const value = variants[gameType];
      if (
        !value ||
        value.eventId !== eventId ||
        !Array.isArray(value.players) ||
        !Array.isArray(value.factions) ||
        !Array.isArray(value.missions) ||
        !value.records
      )
        throw new Error(
          "Public analytics event isolation failed for " + eventId + "."
        );
    });
  });
}

function getOrCreatePublicAnalyticsProjectionFile_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(
    PUBLIC_ANALYTICS_PROJECTION_FILE_PROPERTY
  );

  if (existingId) {
    try {
      return DriveApp.getFileById(existingId);
    }
    catch (error) {
      properties.deleteProperty(PUBLIC_ANALYTICS_PROJECTION_FILE_PROPERTY);
    }
  }

  const file = DriveApp.createFile(
    PUBLIC_ANALYTICS_PROJECTION_FILE_NAME,
    "{}",
    MimeType.PLAIN_TEXT
  );
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  properties.setProperty(PUBLIC_ANALYTICS_PROJECTION_FILE_PROPERTY, file.getId());
  return file;
}

function getPublicAnalyticsProjectionFileId_() {
  return PropertiesService.getScriptProperties().getProperty(
    PUBLIC_ANALYTICS_PROJECTION_FILE_PROPERTY
  ) || "";
}

function parsePublicAnalyticsDirtyEvents_(value) {
  const result = {};
  try {
    const parsed = JSON.parse(String(value || "[]"));
    (Array.isArray(parsed) ? parsed : []).forEach(function(eventId) {
      const normalized = getEventAnalyticsString(eventId);
      if (normalized)
        result[normalized] = true;
    });
  }
  catch (error) {
  }
  return result;
}
