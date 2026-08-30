/*******************************************************
 * Durable generation-safe prepared projection obligations.
 *******************************************************/

function markPublicProjectionRequired_(propertyName, keys) {
  return withPublicProjectionStateLock_(function() {
    const state = readPublicProjectionState_(propertyName);
    const now = new Date().toISOString();
    (keys || ["default"]).forEach(function(key) {
      const name = String(key || "default");
      const current = state.obligations[name] || {};
      const generation = Math.max(
        Date.now(),
        Number(current.requiredGeneration) + 1 || 1,
        Number(current.lastSuccessGeneration) + 1 || 1
      );
      state.obligations[name] = Object.assign({}, current, {
        dirty: true,
        requiredAt: now,
        requiredGeneration: generation
      });
    });
    writePublicProjectionState_(propertyName, state);
    return state;
  });
}

function getNextPublicProjectionObligation_(propertyName) {
  const state = readPublicProjectionState_(propertyName);
  const keys = Object.keys(state.obligations).filter(function(key) {
    return state.obligations[key] && state.obligations[key].dirty === true;
  }).sort();
  if (!keys.length) return null;
  const key = keys[0];
  const obligation = state.obligations[key];
  obligation.key = key;
  return JSON.parse(JSON.stringify(obligation));
}

function beginPublicProjectionAttempt_(propertyName, obligation) {
  return updatePublicProjectionObligation_(propertyName, obligation, function(current) {
    current.lastAttemptAt = new Date().toISOString();
    current.lastAttemptGeneration = obligation.requiredGeneration;
  });
}

function failPublicProjectionAttempt_(propertyName, obligation, stage, error) {
  return updatePublicProjectionObligation_(propertyName, obligation, function(current) {
    current.dirty = true;
    current.lastFailureAt = new Date().toISOString();
    current.lastFailureStage = String(stage || "publication").slice(0, 100);
    current.lastFailureMessage = String(error && error.message || error || "Unknown failure").slice(0, 500);
  });
}

function acknowledgePublicProjection_(propertyName, obligation, artifact) {
  return withPublicProjectionStateLock_(function() {
    const state = readPublicProjectionState_(propertyName);
    const current = state.obligations[obligation.key];
    if (!current || current.dirty !== true)
      return { acknowledged: false, reason: "not-dirty" };
    if (Number(current.requiredGeneration) !== Number(obligation.requiredGeneration))
      return { acknowledged: false, reason: "newer-generation" };
    if (Number(artifact && artifact.publicationGeneration) < Number(obligation.requiredGeneration))
      throw new Error("Published artifact does not satisfy the required generation.");
    current.dirty = false;
    current.lastSuccessAt = new Date().toISOString();
    current.lastSuccessGeneration = Number(artifact.publicationGeneration);
    current.lastFailureAt = "";
    current.lastFailureStage = "";
    current.lastFailureMessage = "";
    writePublicProjectionState_(propertyName, state);
    return { acknowledged: true, generation: current.lastSuccessGeneration };
  });
}

function writeAndValidatePublicProjectionArtifact_(file, artifact, generation) {
  artifact.publicationGeneration = Number(generation) || Date.now();
  const json = JSON.stringify(artifact);
  const previous = file.getBlob().getDataAsString();
  try {
    file.setContent(json);
    const persisted = JSON.parse(file.getBlob().getDataAsString() || "{}");
    if (Number(persisted.publicationGeneration) !== Number(artifact.publicationGeneration))
      throw new Error("Prepared projection artifact read-back validation failed.");
    return persisted;
  }
  catch (error) {
    try { file.setContent(previous); }
    catch (restoreError) { console.error("PUBLIC_PROJECTION_LAST_KNOWN_GOOD_RESTORE_FAILED " + String(restoreError)); }
    throw error;
  }
}

function countPendingPublicProjectionObligations_(propertyName) {
  const state = readPublicProjectionState_(propertyName);
  return Object.keys(state.obligations).filter(function(key) {
    return state.obligations[key] && state.obligations[key].dirty === true;
  }).length;
}

function updatePublicProjectionObligation_(propertyName, obligation, callback) {
  return withPublicProjectionStateLock_(function() {
    const state = readPublicProjectionState_(propertyName);
    const current = state.obligations[obligation.key];
    if (current && Number(current.requiredGeneration) === Number(obligation.requiredGeneration)) {
      callback(current);
      writePublicProjectionState_(propertyName, state);
    }
    return current || null;
  });
}

function readPublicProjectionState_(propertyName) {
  const raw = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!raw) return { schemaVersion: 1, obligations: {} };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.obligations) return parsed;
    const legacy = Array.isArray(parsed) ? parsed : ["default"];
    const state = { schemaVersion: 1, obligations: {} };
    legacy.forEach(function(key) {
      state.obligations[String(key)] = { dirty: true, requiredAt: new Date().toISOString(), requiredGeneration: Date.now() };
    });
    return state;
  }
  catch (error) {
    return { schemaVersion: 1, obligations: { default: { dirty: true, requiredAt: new Date().toISOString(), requiredGeneration: Date.now() } } };
  }
}

function writePublicProjectionState_(propertyName, state) {
  PropertiesService.getScriptProperties().setProperty(propertyName, JSON.stringify(state));
}

function withPublicProjectionStateLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return callback(); }
  finally { lock.releaseLock(); }
}

function requestPreparedProjectionRecovery(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    markPublicAnalyticsProjectionDirty_(EVENT_ENGINE_DEFAULT_EVENT_ID);
    markPublicPlayersProjectionDirty_();
    markPublicLeagueWorkspaceProjectionDirty_();
    markPublicArmyWorkspaceProjectionDirty_(["armyLists", "intelligence"]);
    markPublicDetailProjectionDirty_(["games", "players", "factions", "missions"]);
    markPublicTeamTournamentProjectionDirty_(PUBLIC_TEAM_TOURNAMENT_EVENT_ID);
    markPublicProjectionRequired_(TOP40_PUBLIC_PROJECTION_DIRTY_PROPERTY, [TOP40_PUBLIC_EVENT_ID]);
    return jsonOutput({ success: true, obligations: getPreparedProjectionReliabilityStatus_() });
  });
}

function getPreparedProjectionReliabilityStatus(e) {
  return requireArmyIntelligenceWorkerOrPermission(e, function() {
    return jsonOutput({ success: true, obligations: getPreparedProjectionReliabilityStatus_() });
  });
}

function getPreparedProjectionReliabilityStatus_() {
  const families = {
    analytics: PUBLIC_ANALYTICS_DIRTY_EVENTS_PROPERTY,
    army: PUBLIC_ARMY_WORKSPACE_DIRTY_PROPERTY,
    detail: PUBLIC_DETAIL_PROJECTION_DIRTY_PROPERTY,
    league: PUBLIC_LEAGUE_WORKSPACE_PROJECTION_DIRTY_PROPERTY,
    players: PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY,
    teamTournament: PUBLIC_TEAM_TOURNAMENT_DIRTY_PROPERTY,
    top40: TOP40_PUBLIC_PROJECTION_DIRTY_PROPERTY
  };
  const output = {};
  Object.keys(families).forEach(function(name) {
    output[name] = readPublicProjectionState_(families[name]);
  });
  return output;
}
