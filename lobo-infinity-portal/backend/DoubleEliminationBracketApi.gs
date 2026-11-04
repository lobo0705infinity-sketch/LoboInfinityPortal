const DOUBLE_ELIMINATION_BRACKET_HEADERS = [
  "Event ID", "Match ID", "Bracket", "Bracket Round", "Position",
  "Player A", "Seed A", "Player B", "Seed B", "Player A Source", "Player B Source",
  "Status", "Winner", "Loser", "Next Winner Match", "Next Winner Slot",
  "Next Loser Match", "Next Loser Slot", "Created At", "Activated At", "Deadline", "Game ID", "Resolution"
];

const EVENT_BRACKET_MISSION_HEADERS = [
  "Event ID", "Bracket", "Bracket Round", "Mission", "Updated At", "Mission Geist ID", "Map"
];

function getEventBracket(e) {
  const params = getApiParameters(e);
  const eventId = getEventManagerString(params.eventId);
  if (eventId === "") throw new Error("Event ID is required.");
  if (!getEventByIdNoEnsure(eventId)) throw new Error("Event not found.");
  const event = getEventById(eventId);
  const participants = getEventRegistrationRows(eventId);
  return jsonOutput({ success: true, bracket: buildEventBracketProjection_(event, participants) });
}

function saveEventBracketMissions(e) {
  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params = getApiParameters(e);
    const eventId = getEventManagerString(params.eventId);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const event = getEventById(eventId);
      if (!event || event.type !== "Individual Double Elimination")
        throw new Error("Mission assignment is only available for Individual Double Elimination events.");
      const matches = readEventBracketMatches_(eventId);
      if (!matches.length) throw new Error("Generate the bracket before assigning missions.");
      let assignments;
      try { assignments = JSON.parse(getEventManagerString(params.assignments) || "[]"); }
      catch (error) { throw new Error("Mission assignments are invalid."); }
      const validated = validateEventBracketMissionAssignments_(eventId, matches, assignments);
      persistEventBracketMissionAssignments_(eventId, validated);
      if (matches.some(function(match){ return !!match.activatedAt; })) {
        if (eventId === "event-lobo-s-american-top-40") refreshTop40GameSubmissionForm(true);
      activatePlayableEventBracketMatches_(matches, new Date(), { requireAssignedMission:true });
        writeEventBracketMatches_(eventId, matches);
      }
      recordEventManagerAudit(auth, eventId, "Bracket missions saved", validated.filter(function(item){ return item.mission; }).length + " assigned rounds");
      invalidateEventManagerCaches(eventId);
      return jsonOutput({ success:true, bracket:buildEventBracketProjection_(getEventById(eventId), getEventRegistrationRows(eventId), matches) });
    } finally { lock.releaseLock(); }
  });
}

function submitTop40Result(e) {
  const auth = getRequestUser(e);
  const params = getApiParameters(e);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return jsonOutput(submitTop40ResultService_(params, auth, e));
  } catch (error) {
    return resultSubmissionFailure(String(error && error.message || error));
  } finally {
    lock.releaseLock();
  }
}

function submitTop40ResultService_(params, auth, requestEvent) {
  // Form imports and portal submissions share the same reentrant mutation lock.
  return withGamePipelineLock_(function() {
    const before = validateTop40BracketSubmission_(params);
    if (!before.valid) throw new Error(before.error);
    params.matchId = before.match.matchId;
    if (before.match.gameId) {
      completeTop40CanonicalCommit_(before.eventId, before.match.matchId, Number(before.match.gameId));
      invalidateEventManagerCaches(before.eventId);
      return { success:true, status:"Already Submitted", gameId:Number(before.match.gameId), matchId:before.match.matchId };
    }
    const commissionerContext = getResultSubmissionCommissionerContext(requestEvent || {}, auth || {}, params);
    if (commissionerContext.error) throw new Error(commissionerContext.error);
    params.mission = before.mission;
    const submission = submitCanonicalGame(createSubmissionCommand({ source:"portal", workflow:"top-40", params:params, auth:auth, commissionerContext:commissionerContext }));
    if (!submission.success) throw new Error(submission.error);
    const gameId = Number(submission.context.gameId);
    if (!gameId) throw new Error("Game recorded; bracket progression requires Commissioner attention.");
    // The canonical commit has already linked and advanced the bracket. Publication
    // is best effort and has a durable retry obligation independent of analytics.
    invalidateEventManagerCaches(before.eventId);
    return { success:true, status:"Submitted", gameId:gameId, matchId:before.match.matchId,
      bracket:buildEventBracketProjection_(getEventById(before.eventId), getEventRegistrationRows(before.eventId)) };
  });
}

function awardEventBracketForfeit(e) {
  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params = getApiParameters(e);
    const eventId = getEventManagerString(params.eventId);
    const matchId = getEventManagerString(params.matchId);
    const winner = getEventManagerString(params.winner);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const event = getEventById(eventId);
      if (!event || event.type !== "Individual Double Elimination")
        throw new Error("Forfeits are only available for Individual Double Elimination events.");
      const matches = readEventBracketMatches_(eventId);
      const match = matches.filter(function(item){ return item.matchId === matchId; })[0];
      if (!match) throw new Error("Bracket match not found.");
      if (match.status === "Completed") {
        if (match.resolution === "Forfeit" && match.winner === winner)
          return jsonOutput({ success:true, status:"Already Awarded", bracket:buildEventBracketProjection_(event, getEventRegistrationRows(eventId), matches) });
        throw new Error("Bracket match is already completed.");
      }
      if (match.status !== "Active") throw new Error("Only Active matches may be awarded by forfeit.");
      if (winner !== match.playerA && winner !== match.playerB)
        throw new Error("Forfeit winner must be Player A or Player B.");
      const loser = winner === match.playerA ? match.playerB : match.playerA;
      completeEventBracketMatch_(matches, match, winner, loser, "Forfeit", "", new Date());
      writeEventBracketMatches_(eventId, matches);
      recordEventManagerAudit(auth, eventId, "Bracket match awarded by forfeit", matchId + " awarded to " + winner);
      invalidateEventManagerCaches(eventId);
      return jsonOutput({ success:true, status:"Forfeit Awarded", bracket:buildEventBracketProjection_(event, getEventRegistrationRows(eventId), matches) });
    } finally { lock.releaseLock(); }
  });
}

function validateTop40BracketSubmission_(params) {
  const eventId = getEventManagerString(params.eventId);
  const event = getEventById(eventId);
  if (!event || event.type !== "Individual Double Elimination") return { valid:false, error:"Top 40 event was not found." };
  const player = getEventManagerString(params.player);
  const matches = readEventBracketMatches_(eventId);
  if (!matches.length) return { valid:false, error:"Tournament bracket has not been generated." };
  const requestedMatchId = getEventManagerString(params.matchId);
  const requestedMatch = requestedMatchId ? matches.filter(function(match){ return match.matchId === requestedMatchId; })[0] : null;
  if (requestedMatch && requestedMatch.status === "Completed" && requestedMatch.gameId && (requestedMatch.playerA === player || requestedMatch.playerB === player))
    return { valid:true, eventId:eventId, match:requestedMatch, player:player, opponent:requestedMatch.playerA === player ? requestedMatch.playerB : requestedMatch.playerA, winner:requestedMatch.winner, loser:requestedMatch.loser };
  const active = matches.filter(function(match) { return match.status === "Active" && (match.playerA === player || match.playerB === player); });
  if (active.length > 1) return { valid:false, error:"Multiple Active matches require Commissioner correction." };
  if (active.length !== 1) return { valid:false, error:"No Active bracket match was found for this player." };
  const match = active[0];
  if (requestedMatchId && requestedMatchId !== match.matchId) return { valid:false, error:"Bracket Match does not match the player's Active match." };
  if (!isRealEventBracketPlayer_(match.playerA) || !isRealEventBracketPlayer_(match.playerB)) return { valid:false, error:"Only real Active matches may be submitted." };
  const mission = getEventBracketMission_(eventId, match.bracket, match.bracketRound);
  if (!mission) return { valid:false, error:"A mission has not been assigned to this bracket round." };
  const opponent = match.playerA === player ? match.playerB : match.playerA;
  const winnerValue = getEventManagerString(params.winner);
  if (winnerValue === "Draw") return { valid:false, error:"Top 40 bracket matches require a winner." };
  let winner = "";
  if (winnerValue === "Player Victory" || winnerValue === player) winner = player;
  if (winnerValue === "Opponent Victory" || winnerValue === opponent) winner = opponent;
  if (!winner) return { valid:false, error:"Top 40 bracket matches require a winner." };
  return { valid:true, eventId:eventId, match:match, player:player, opponent:opponent, winner:winner, loser:winner === player ? opponent : player, mission:mission };
}

function applyTop40BracketProgression_(eventId, matchId, gameId, winner, loser, now) {
  const matches = readEventBracketMatches_(eventId);
  const byId = {}; matches.forEach(function(match){ byId[match.matchId]=match; });
  const match = byId[matchId];
  if (!match) throw new Error("Bracket match not found.");
  if (match.status === "Completed") {
    if (Number(match.gameId) === Number(gameId)) return buildEventBracketProjection_(getEventById(eventId), getEventRegistrationRows(eventId), matches);
    throw new Error("Bracket match is already linked to another Game.");
  }
  if (match.status !== "Active" || Number(match.gameId) !== Number(gameId)) throw new Error("Bracket match is not recoverable from this Game.");
  completeEventBracketMatch_(matches, match, winner, loser, "Played", gameId, now);
  writeEventBracketMatches_(eventId, matches);
  invalidateEventManagerCaches(eventId);
  return buildEventBracketProjection_(getEventById(eventId), getEventRegistrationRows(eventId), matches);
}

function completeEventBracketMatch_(matches, match, winner, loser, resolution, gameId, now) {
  const byId = {}; matches.forEach(function(item){ byId[item.matchId] = item; });
  if (match.status !== "Active") throw new Error("Only Active matches may be completed.");
  if (winner !== match.playerA && winner !== match.playerB) throw new Error("Winner must be a bracket participant.");
  if (loser !== match.playerA && loser !== match.playerB) throw new Error("Loser must be a bracket participant.");
  if (winner === loser) throw new Error("Winner and loser must be different players.");
  placeEventBracketPlayer_(byId, match.nextWinnerMatch, match.nextWinnerSlot, winner, getEventBracketPlayerSeed_(match, winner));
  placeEventBracketPlayer_(byId, match.nextLoserMatch, match.nextLoserSlot, loser, getEventBracketPlayerSeed_(match, loser));
  match.status = "Completed";
  match.winner = winner;
  match.loser = loser;
  match.resolution = resolution;
  match.gameId = gameId || "";
  if (match.matchId === "GF-M1") {
    const reset = byId["GF-M2"];
    if (reset && winner === match.playerB) {
      reset.playerA = match.playerA; reset.seedA = match.seedA;
      reset.playerB = match.playerB; reset.seedB = match.seedB;
      reset.status = "Pending";
    } else if (reset) { reset.status = "Not Required"; }
  }
  resolveEventBracketByes_(matches);
  activatePlayableEventBracketMatches_(matches, now, { requireAssignedMission:true });
  return matches;
}

function placeEventBracketPlayer_(byId, targetId, slot, player, seed) {
  if (!targetId || ["CHAMPION","RUNNER_UP","ELIMINATED"].indexOf(targetId) !== -1) return;
  const target=byId[targetId]; if (!target) throw new Error("Bracket destination is invalid.");
  const key=slot === "B" ? "playerB" : "playerA"; const seedKey=slot === "B" ? "seedB" : "seedA";
  if (target[key] && target[key] !== player) throw new Error("Bracket destination already contains a conflicting participant.");
  target[key]=player; target[seedKey]=seed;
}

function getEventBracketPlayerSeed_(match, player) { return match.playerA === player ? match.seedA : match.seedB; }

function resolveEventBracketByes_(matches) {
  const byId={}; matches.forEach(function(match){byId[match.matchId]=match;});
  let changed=true;
  while(changed){ changed=false; matches.forEach(function(match){
    if(match.status!=="Pending") return;
    const a=isRealEventBracketPlayer_(match.playerA), b=isRealEventBracketPlayer_(match.playerB);
    const aBye=match.playerA==="BYE" || (!match.playerA && match.playerASource==="BYE");
    const bBye=match.playerB==="BYE" || (!match.playerB && match.playerBSource==="BYE");
    if ((a && bBye) || (b && aBye) || (aBye && bBye)) {
      const winner=a?match.playerA:b?match.playerB:"BYE";
      match.status="Bye Advanced"; match.winner=winner; match.loser="BYE";
      placeEventBracketPlayer_(byId,match.nextWinnerMatch,match.nextWinnerSlot,winner,getEventBracketPlayerSeed_(match,winner));
      if (match.bracket === "Winners") placeEventBracketPlayer_(byId,match.nextLoserMatch,match.nextLoserSlot,"BYE","");
      changed=true;
    }
  }); }
}

function generateEventBracket(e) {
  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const eventId = getEventManagerString(getApiParameters(e).eventId);
    if (eventId === "") throw new Error("Event ID is required.");
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (!getEventByIdNoEnsure(eventId)) throw new Error("Event not found.");
      const event = getEventById(eventId);
      if (event.type !== "Individual Double Elimination")
        throw new Error("Bracket generation is only available for Individual Double Elimination events.");
      if (readEventBracketMatches_(eventId).length > 0)
        throw new Error("Bracket has already been generated.");

      const participants = getEventRegistrationRows(eventId);
      const readiness = buildEventBracketReadiness_(event, participants);
      if (!readiness.ready) throw new Error(readiness.reasons[0]);

      const entrants = participants
        .filter(function(entry) { return entry.status === "Registered"; })
        .map(function(entry) {
          return { player: entry.player, seed: Number(entry.seed), itsName: entry.itsName || "", faction: entry.faction || "" };
        });
      const matches = buildDoubleEliminationBracket_(eventId, entrants);
      validateDoubleEliminationBracket_(matches, entrants);
      validateEventBracketLifecycle_(matches);
      let persisted;
      try {
        persistEventBracketMatches_(eventId, matches);
        persisted = readEventBracketMatches_(eventId);
        validateDoubleEliminationBracket_(persisted, entrants);
        validateEventBracketLifecycle_(persisted);
      } catch (persistenceError) {
        removeEventBracketMatches_(eventId);
        throw persistenceError;
      }
      recordEventManagerAudit(auth, eventId, "Tournament bracket generated", matches.length + " matches");
      invalidateEventManagerCaches(eventId);
      return jsonOutput({ success: true, bracket: buildEventBracketProjection_(event, participants, persisted) });
    } finally {
      lock.releaseLock();
    }
  });
}

function updateEventBracketDeadline(e) {
  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params = getApiParameters(e);
    const eventId = getEventManagerString(params.eventId);
    const matchId = getEventManagerString(params.matchId);
    if (eventId === "" || matchId === "") throw new Error("Event ID and Match ID are required.");
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (!getEventByIdNoEnsure(eventId)) throw new Error("Event not found.");
      const sheet = ensureEventEngineSheet(CONFIG.SHEETS.EVENT_BRACKET_MATCHES, DOUBLE_ELIMINATION_BRACKET_HEADERS);
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) throw new Error("Bracket match not found.");
      const headers = values[0].map(getEventManagerString);
      const eventIndex = headers.indexOf("Event ID");
      const matchIndex = headers.indexOf("Match ID");
      const statusIndex = headers.indexOf("Status");
      const activatedIndex = headers.indexOf("Activated At");
      const deadlineIndex = headers.indexOf("Deadline");
      let rowIndex = -1;
      for (let row = 1; row < values.length; row++) {
        if (getEventManagerString(values[row][eventIndex]) === eventId && getEventManagerString(values[row][matchIndex]) === matchId) {
          rowIndex = row;
          break;
        }
      }
      if (rowIndex === -1) throw new Error("Bracket match not found.");
      if (getEventManagerString(values[rowIndex][statusIndex]) !== "Active") throw new Error("Only Active match deadlines can be edited.");
      const activatedAt = getEventManagerString(values[rowIndex][activatedIndex]);
      const deadline = validateEventBracketDeadline_(activatedAt, params.deadline);
      sheet.getRange(rowIndex + 1, deadlineIndex + 1).setValue(deadline);
      SpreadsheetApp.flush();
      recordEventManagerAudit(auth, eventId, "Bracket deadline updated", matchId + " deadline " + deadline);
      invalidateEventManagerCaches(eventId);
      const event = getEventById(eventId);
      return jsonOutput({ success: true, bracket: buildEventBracketProjection_(event, getEventRegistrationRows(eventId)) });
    } finally {
      lock.releaseLock();
    }
  });
}

function releaseEventBracket(e) {
  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const eventId = getEventManagerString(getApiParameters(e).eventId);
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const event = getEventById(eventId);
      if (!event || event.type !== "Individual Double Elimination") throw new Error("Tournament event not found.");
      const matches = readEventBracketMatches_(eventId);
      if (!matches.length) throw new Error("Prepare the bracket before releasing matches.");
      if (matches.some(function(match){ return !!match.activatedAt; }))
        return jsonOutput({ success:true, bracket:buildEventBracketProjection_(event, getEventRegistrationRows(eventId), matches) });
      const readiness = buildEventBracketReadiness_(event, getEventRegistrationRows(eventId));
      if (!readiness.ready) throw new Error(readiness.reasons[0]);
      const missing = discoverEventBracketRounds_(matches).filter(function(round){
        return !getEventBracketMission_(eventId, round.bracket, round.bracketRound);
      });
      if (missing.length) throw new Error("Assign the complete mission pool before releasing opening matches.");
      if (eventId === "event-lobo-s-american-top-40") refreshTop40GameSubmissionForm(true);
      activatePlayableEventBracketMatches_(matches, new Date(), { requireAssignedMission:true });
      validateEventBracketLifecycle_(matches);
      writeEventBracketMatches_(eventId, matches);
      recordEventManagerAudit(auth, eventId, "Opening bracket matches released", "Seven-day deadlines started");
      invalidateEventManagerCaches(eventId);
      return jsonOutput({ success:true, bracket:buildEventBracketProjection_(event, getEventRegistrationRows(eventId), matches) });
    } finally { lock.releaseLock(); }
  });
}

function activatePlayableEventBracketMatches_(matches, activatedAt, options) {
  const activationDate = activatedAt instanceof Date ? activatedAt : new Date(activatedAt);
  if (isNaN(activationDate.getTime())) throw new Error("Bracket activation timestamp is invalid.");
  const activatedText = formatEventBracketTimestamp_(activationDate);
  const deadlineText = formatEventBracketTimestamp_(new Date(activationDate.getTime() + 7 * 24 * 60 * 60 * 1000));
  matches.forEach(function(match) {
    const bothPlayersKnown = isRealEventBracketPlayer_(match.playerA) && isRealEventBracketPlayer_(match.playerB);
    const resolved = match.status === "Completed" || match.status === "Bye Advanced" || match.winner !== "";
    const missionReady = !(options && options.requireAssignedMission) || !!getEventBracketMission_(match.eventId, match.bracket, match.bracketRound);
    if (match.status === "Pending" && bothPlayersKnown && !resolved && !match.activatedAt && missionReady) {
      match.status = "Active";
      match.activatedAt = activatedText;
      match.deadline = deadlineText;
    }
  });
  return matches;
}

function isRealEventBracketPlayer_(player) {
  const value = getEventManagerString(player);
  return value !== "" && value !== "BYE";
}

function formatEventBracketTimestamp_(value) {
  return value.toISOString();
}

function parseEventBracketTimestamp_(value) {
  const text = getEventManagerString(value);
  if (text === "") return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text))
    return Utilities.parseDate(text, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function validateEventBracketDeadline_(activatedAt, proposedDeadline) {
  const activated = parseEventBracketTimestamp_(activatedAt);
  const deadline = parseEventBracketTimestamp_(proposedDeadline);
  if (!activated || !deadline) throw new Error("Enter a valid deadline.");
  if (deadline.getTime() - activated.getTime() < 7 * 24 * 60 * 60 * 1000) throw new Error("Deadline must allow at least seven full days after activation.");
  return formatEventBracketTimestamp_(deadline);
}

function validateEventBracketLifecycle_(matches) {
  matches.forEach(function(match) {
    if (match.status === "Active") {
      const activated = parseEventBracketTimestamp_(match.activatedAt);
      const deadline = parseEventBracketTimestamp_(match.deadline);
      if (!activated || !deadline || deadline.getTime() - activated.getTime() < 7 * 24 * 60 * 60 * 1000)
        throw new Error("Active bracket match lifecycle is invalid.");
      if (!isRealEventBracketPlayer_(match.playerA) || !isRealEventBracketPlayer_(match.playerB))
        throw new Error("Only matches with two real players may be Active.");
    }
    if (match.status === "Bye Advanced" && (match.activatedAt || match.deadline))
      throw new Error("Bye matches cannot have activation deadlines.");
  });
  return true;
}

function buildEventBracketProjection_(event, participants, suppliedMatches) {
  const matches = suppliedMatches || readEventBracketMatches_(event.id);
  const missions = readEventBracketMissionAssignments_(event.id);
  const projectedMatches = matches.map(function(match){
    const copy = {};
    Object.keys(match).forEach(function(key){ copy[key] = match[key]; });
    const assignment = missions.filter(function(item){ return item.bracket === match.bracket && Number(item.bracketRound) === Number(match.bracketRound); })[0] || (match.matchId === "GF-M2" ? missions.filter(function(item){ return item.bracket === "Grand Final" && Number(item.bracketRound) === 1; })[0] : null);
    copy.mission = assignment ? assignment.mission : "";
    copy.map = assignment ? assignment.map || "" : "";
    return copy;
  });
  const firstFinal = matches.filter(function(match){ return match.matchId === "GF-M1"; })[0] || null;
  const resetFinal = matches.filter(function(match){ return match.matchId === "GF-M2"; })[0] || null;
  const grandFinal = resetFinal && resetFinal.status !== "Not Required" ? resetFinal : firstFinal;
  return {
    eventId: event.id,
    generated: matches.length > 0,
    released: matches.some(function(match){ return !!match.activatedAt; }),
    readiness: buildEventBracketReadiness_(event, participants),
    matches: projectedMatches,
    missions: missions,
    champion: grandFinal && grandFinal.status === "Completed" ? grandFinal.winner : "",
    tournamentComplete: !!(grandFinal && grandFinal.status === "Completed")
  };
}

function eventBracketRoundKey_(bracket, bracketRound) {
  return getEventManagerString(bracket) + ":" + Number(bracketRound || 1);
}

function discoverEventBracketRounds_(matches) {
  const seen = {};
  return matches.map(function(match){ return { bracket:match.bracket, bracketRound:Number(match.bracketRound) }; }).filter(function(item){
    const key = eventBracketRoundKey_(item.bracket, item.bracketRound);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function validateEventBracketMissionAssignments_(eventId, matches, assignments) {
  if (!Array.isArray(assignments)) throw new Error("Mission assignments are invalid.");
  const rounds = discoverEventBracketRounds_(matches);
  const validRounds = {};
  rounds.forEach(function(item){ validRounds[eventBracketRoundKey_(item.bracket,item.bracketRound)] = item; });
  const existing = {};
  readEventBracketMissionAssignments_(eventId).forEach(function(item){ existing[eventBracketRoundKey_(item.bracket,item.bracketRound)] = item; });
  const supplied = {};
  assignments.forEach(function(item){
    const bracket = getEventManagerString(item && item.bracket);
    const bracketRound = Number(item && item.bracketRound);
    const key = eventBracketRoundKey_(bracket, bracketRound);
    if (!validRounds[key]) throw new Error("Bracket mission round is invalid.");
    if (Object.prototype.hasOwnProperty.call(supplied,key)) throw new Error("Bracket mission rounds must be unique.");
    const rawMission = getEventManagerString(item && item.mission);
    const mission = rawMission ? getCanonicalMissionName(rawMission) : "";
    if (rawMission && !mission) throw new Error("Select a mission from the canonical mission list.");
    const missionGeistId = validatePersistedMissionGeistSelection_(
      mission,
      getEventManagerString(item && item.missionGeistId)
    );
    const map = getEventManagerString(item && item.map || existing[key] && existing[key].map);
    if (map.length > 160 || /^[=+@]/.test(map) || /[\u0000-\u001f]/.test(map)) throw new Error("Map must be a plain-text map name.");
    supplied[key] = { mission: mission, missionGeistId: missionGeistId, map:map };
  });
  return rounds.map(function(round){
    const key = eventBracketRoundKey_(round.bracket,round.bracketRound);
    const existingAssignment = existing[key] || { mission:"", missionGeistId:"" };
    const assignment = Object.prototype.hasOwnProperty.call(supplied,key) ? supplied[key] : existingAssignment;
    const mission = assignment.mission;
    const changed = existingAssignment.mission !== mission || existingAssignment.missionGeistId !== assignment.missionGeistId || (existingAssignment.map || "") !== (assignment.map || "");
    if (changed && matches.some(function(match){ return eventBracketRoundKey_(match.bracket,match.bracketRound) === key && match.status === "Completed"; }))
      throw new Error("This mission cannot be changed because games in this bracket round have already been completed.");
    return { eventId:eventId, bracket:round.bracket, bracketRound:round.bracketRound, mission:mission, missionGeistId:assignment.missionGeistId || "", map:assignment.map || "" };
  });
}

function readEventBracketMissionAssignments_(eventId) {
  const sheet = getEventEngineRuntimeSheet(CONFIG.SHEETS.EVENT_BRACKET_MISSIONS);
  if (!sheet) return [];
  return getEventEngineRows(sheet).filter(function(row){ return getEventManagerString(row["Event ID"]) === eventId && getEventManagerString(row["Mission"]); }).map(function(row){
    return { eventId:eventId, bracket:getEventManagerString(row["Bracket"]), bracketRound:Number(row["Bracket Round"]), mission:getCanonicalMissionName(row["Mission"]), missionGeistId:getEventManagerString(row["Mission Geist ID"]), map:getEventManagerString(row["Map"]) };
  }).filter(function(item){ return item.mission; });
}

function getEventBracketMission_(eventId, bracket, bracketRound) {
  const key = eventBracketRoundKey_(bracket, bracketRound);
  const assignment = readEventBracketMissionAssignments_(eventId).filter(function(item){ return eventBracketRoundKey_(item.bracket,item.bracketRound) === key; })[0];
  return assignment ? assignment.mission : bracket === "Grand Final" && Number(bracketRound) === 2 ? getEventBracketMission_(eventId, bracket, 1) : "";
}

function persistEventBracketMissionAssignments_(eventId, assignments) {
  const sheet = ensureEventEngineSheet(CONFIG.SHEETS.EVENT_BRACKET_MISSIONS, EVENT_BRACKET_MISSION_HEADERS);
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0].map(getEventManagerString) : EVENT_BRACKET_MISSION_HEADERS.slice();
  const eventIndex = headers.indexOf("Event ID");
  const retained = values.slice(1).filter(function(row){ return getEventManagerString(row[eventIndex]) !== eventId && row.some(function(value){ return getEventManagerString(value); }); });
  const now = getEventManagerTimestamp();
  const eventRows = assignments.filter(function(item){ return item.mission; }).map(function(item){ const record = { "Event ID":eventId,"Bracket":item.bracket,"Bracket Round":item.bracketRound,"Mission":item.mission,"Updated At":now,"Mission Geist ID":item.missionGeistId || "","Map":item.map || "" }; return headers.map(function(header){return record[header] || "";}); });
  const finalRows = [headers].concat(retained,eventRows);
  const rowCount = Math.max(values.length, finalRows.length);
  while (finalRows.length < rowCount) finalRows.push(headers.map(function(){ return ""; }));
  sheet.getRange(1,1,rowCount,headers.length).setValues(finalRows);
  SpreadsheetApp.flush();
}

function buildEventBracketReadiness_(event, participants) {
  const registered = participants.filter(function(entry) { return entry.status === "Registered"; });
  const capacity = getEventRegistrationCapacity(event).maximumPlayers;
  const seeds = registered.map(function(entry) { return Number(entry.seed); });
  const validSeeds = seeds.filter(function(seed) { return Number.isInteger(seed) && seed >= 1 && seed <= registered.length; });
  const registrationClosed = String(event.registration || "").toLowerCase().indexOf("closed") !== -1;
  const reasons = [];
  if (!registrationClosed) reasons.push("Close registration before generating the bracket.");
  if (registered.length < 2) reasons.push("At least 2 registered players are required.");
  if (capacity > 0 && registered.length > capacity) reasons.push("Registered players exceed event capacity.");
  if (validSeeds.length !== registered.length) reasons.push("Every registered player must have a seed.");
  else if (new Set(seeds).size !== registered.length || seeds.slice().sort(function(a,b){return a-b;}).some(function(seed,index){return seed !== index + 1;}))
    reasons.push("Seeds must be unique and cover 1 through N.");
  return { registeredCount: registered.length, capacity: capacity, seededCount: validSeeds.length, registrationClosed: registrationClosed, ready: reasons.length === 0, reasons: reasons };
}

function buildDoubleEliminationBracket_(eventId, entrants) {
  const entrantBySeed = {};
  entrants.forEach(function(entry) { entrantBySeed[Number(entry.seed)] = entry; });
  let capacity = 2;
  while (capacity < entrants.length) capacity *= 2;
  let placement = [1, 2];
  while (placement.length < capacity) {
    const nextSize = placement.length * 2;
    placement = placement.reduce(function(result, seed) { return result.concat([seed, nextSize + 1 - seed]); }, []);
  }
  const rounds = Math.log(capacity) / Math.log(2);
  const matches = [];
  function makeMatch(id, bracket, round, position) {
    return { eventId:eventId, matchId:id, bracket:bracket, bracketRound:round, position:position, playerA:"", seedA:"", playerB:"", seedB:"", playerASource:"", playerBSource:"", status:"Pending", winner:"", loser:"", nextWinnerMatch:"", nextWinnerSlot:"", nextLoserMatch:"", nextLoserSlot:"", activatedAt:"", deadline:"" };
  }
  for (let round = 1; round <= rounds; round++) {
    const count = capacity / Math.pow(2, round);
    for (let position = 1; position <= count; position++) matches.push(makeMatch("W"+round+"-M"+position, "Winners", round, position));
  }
  const loserRounds = capacity === 2 ? 1 : 2 * (rounds - 1);
  for (let round = 1; round <= loserRounds; round++) {
    const count = capacity === 2 ? 1 : capacity / Math.pow(2, Math.ceil(round / 2) + 1);
    for (let position = 1; position <= count; position++) matches.push(makeMatch("L"+round+"-M"+position, "Losers", round, position));
  }
  matches.push(makeMatch("GF-M1", "Grand Final", 1, 1));
  const reset = makeMatch("GF-M2", "Grand Final", 2, 1);
  reset.status = "Conditional";
  reset.playerASource = "Winners finalist, if reset required";
  reset.playerBSource = "Losers finalist, if reset required";
  reset.nextWinnerMatch = "CHAMPION"; reset.nextLoserMatch = "RUNNER_UP";
  matches.push(reset);
  const byId = {};
  matches.forEach(function(match) { byId[match.matchId] = match; });

  for (let position = 1; position <= capacity / 2; position++) {
    const match = byId["W1-M"+position];
    const seedA = placement[(position-1)*2];
    const seedB = placement[(position-1)*2+1];
    const a = entrantBySeed[seedA]; const b = entrantBySeed[seedB];
    match.playerA = a ? a.player : "BYE"; match.seedA = a ? seedA : ""; match.playerASource = a ? "Seed "+seedA : "BYE";
    match.playerB = b ? b.player : "BYE"; match.seedB = b ? seedB : ""; match.playerBSource = b ? "Seed "+seedB : "BYE";
  }
  for (let round = 1; round <= rounds; round++) {
    const count = capacity / Math.pow(2, round);
    for (let position = 1; position <= count; position++) {
      const match = byId["W"+round+"-M"+position];
      if (round < rounds) { match.nextWinnerMatch="W"+(round+1)+"-M"+Math.ceil(position/2); match.nextWinnerSlot=position%2 ? "A" : "B"; }
      else { match.nextWinnerMatch="GF-M1"; match.nextWinnerSlot="A"; }
      if (capacity === 2) { match.nextLoserMatch="L1-M1"; match.nextLoserSlot="A"; }
      else if (round === 1) { match.nextLoserMatch="L1-M"+Math.ceil(position/2); match.nextLoserSlot=position%2 ? "A" : "B"; }
      else { match.nextLoserMatch="L"+(2*round-2)+"-M"+(count > 1 ? (position % 2 ? position + 1 : position - 1) : position); match.nextLoserSlot="B"; }
      if (round > 1) { match.playerASource="Winner W"+(round-1)+"-M"+(position*2-1); match.playerBSource="Winner W"+(round-1)+"-M"+(position*2); }
    }
  }
  for (let round = 1; round <= loserRounds; round++) {
    const count = capacity === 2 ? 1 : capacity / Math.pow(2, Math.ceil(round / 2) + 1);
    for (let position = 1; position <= count; position++) {
      const match = byId["L"+round+"-M"+position];
      if (capacity === 2) { match.playerASource="Loser W1-M1"; match.playerBSource="BYE"; match.nextWinnerMatch="GF-M1"; match.nextWinnerSlot="B"; }
      else if (round === 1) { match.playerASource="Loser W1-M"+(position*2-1); match.playerBSource="Loser W1-M"+(position*2); }
      else if (round % 2 === 0) { match.playerASource="Winner L"+(round-1)+"-M"+position; match.playerBSource="Loser W"+(round/2+1)+"-M"+(count > 1 ? (position % 2 ? position + 1 : position - 1) : position); }
      else { match.playerASource="Winner L"+(round-1)+"-M"+(position*2-1); match.playerBSource="Winner L"+(round-1)+"-M"+(position*2); }
      if (round === loserRounds) { match.nextWinnerMatch="GF-M1"; match.nextWinnerSlot="B"; }
      else if (round % 2 === 1) { match.nextWinnerMatch="L"+(round+1)+"-M"+position; match.nextWinnerSlot="A"; }
      else { match.nextWinnerMatch="L"+(round+1)+"-M"+Math.ceil(position/2); match.nextWinnerSlot=position%2 ? "A" : "B"; }
      match.nextLoserMatch="ELIMINATED";
    }
  }
  const gf = byId["GF-M1"];
  gf.playerASource="Winner W"+rounds+"-M1"; gf.playerBSource="Winner L"+loserRounds+"-M1";
  gf.nextWinnerMatch="CHAMPION"; gf.nextLoserMatch="RUNNER_UP";

  resolveEventBracketByes_(matches);
  return matches;
}

function validateDoubleEliminationBracket_(matches, entrants) {
  const ids = matches.map(function(match){return match.matchId;});
  if (new Set(ids).size !== ids.length) throw new Error("Bracket contains duplicate Match IDs.");
  const idSet = new Set(ids);
  const gf = matches.filter(function(match){return match.bracket === "Grand Final";});
  if (gf.length !== 2 || gf[0].matchId !== "GF-M1" || gf[1].matchId !== "GF-M2") throw new Error("Bracket must contain a Grand Final and conditional reset.");
  const initial = matches.filter(function(match){return match.bracket === "Winners" && match.bracketRound === 1;});
  const seeds=[]; initial.forEach(function(match){ if(match.seedA!=="") seeds.push(Number(match.seedA)); if(match.seedB!=="") seeds.push(Number(match.seedB)); });
  seeds.sort(function(a,b){return a-b;});
  if (seeds.length !== entrants.length || seeds.some(function(seed,index){return seed!==index+1;})) throw new Error("Initial Winners placement is invalid.");
  const capacity = initial.length * 2;
  const byeRecipients = initial.filter(function(match){return match.playerA === "BYE" || match.playerB === "BYE";}).map(function(match){return Number(match.playerA === "BYE" ? match.seedB : match.seedA);}).sort(function(a,b){return a-b;});
  if (byeRecipients.some(function(seed,index){return seed !== index + 1;}) || byeRecipients.length !== capacity - entrants.length) throw new Error("Seeded bye placement is invalid.");
  matches.forEach(function(match){ [match.nextWinnerMatch, match.nextLoserMatch].forEach(function(target){ if(target && ["CHAMPION","RUNNER_UP","ELIMINATED"].indexOf(target)===-1 && !idSet.has(target)) throw new Error("Bracket contains an invalid progression link."); }); });
  if (gf[0].nextWinnerMatch !== "CHAMPION" || gf[0].nextLoserMatch !== "RUNNER_UP") throw new Error("Grand Final destinations are invalid.");
  return true;
}

function persistEventBracketMatches_(eventId, matches) {
  const sheet = ensureEventEngineSheet(CONFIG.SHEETS.EVENT_BRACKET_MATCHES, DOUBLE_ELIMINATION_BRACKET_HEADERS);
  const existing = getEventEngineRows(sheet).filter(function(row){return row["Event ID"] === eventId;});
  if (existing.length) throw new Error("Bracket has already been generated.");
  const now = getEventManagerTimestamp();
  const rows = matches.map(function(m){return [m.eventId,m.matchId,m.bracket,m.bracketRound,m.position,m.playerA,m.seedA,m.playerB,m.seedB,m.playerASource,m.playerBSource,m.status,m.winner,m.loser,m.nextWinnerMatch,m.nextWinnerSlot,m.nextLoserMatch,m.nextLoserSlot,now,m.activatedAt||"",m.deadline||"",m.gameId||"",m.resolution||""];});
  if (rows.length) sheet.getRange(sheet.getLastRow()+1,1,rows.length,DOUBLE_ELIMINATION_BRACKET_HEADERS.length).setValues(rows);
  SpreadsheetApp.flush();
}

function readEventBracketMatches_(eventId) {
  const sheet = getEventEngineRuntimeSheet(CONFIG.SHEETS.EVENT_BRACKET_MATCHES);
  if (!sheet) return [];
  return getEventEngineRows(sheet).filter(function(row){return row["Event ID"] === eventId;}).map(function(row){return { eventId:row["Event ID"],matchId:row["Match ID"],bracket:row["Bracket"],bracketRound:Number(row["Bracket Round"]),position:Number(row["Position"]),playerA:row["Player A"]||"",seedA:row["Seed A"]===""?"":Number(row["Seed A"]),playerB:row["Player B"]||"",seedB:row["Seed B"]===""?"":Number(row["Seed B"]),playerASource:row["Player A Source"]||"",playerBSource:row["Player B Source"]||"",status:row["Status"]||"Pending",winner:row["Winner"]||"",loser:row["Loser"]||"",nextWinnerMatch:row["Next Winner Match"]||"",nextWinnerSlot:row["Next Winner Slot"]||"",nextLoserMatch:row["Next Loser Match"]||"",nextLoserSlot:row["Next Loser Slot"]||"",activatedAt:row["Activated At"]||"",deadline:row["Deadline"]||"",gameId:row["Game ID"]===""?"":Number(row["Game ID"]),resolution:row["Resolution"]||""};});
}

function setEventBracketMatchGameId_(eventId, matchId, gameId) {
  const sheet=ensureEventEngineSheet(CONFIG.SHEETS.EVENT_BRACKET_MATCHES,DOUBLE_ELIMINATION_BRACKET_HEADERS);
  const values=sheet.getDataRange().getValues(); const headers=values[0].map(getEventManagerString);
  const eventIndex=headers.indexOf("Event ID"), matchIndex=headers.indexOf("Match ID"), gameIndex=headers.indexOf("Game ID");
  for(let row=1;row<values.length;row++) if(getEventManagerString(values[row][eventIndex])===eventId&&getEventManagerString(values[row][matchIndex])===matchId){
    const existing=Number(values[row][gameIndex])||0; if(existing&&existing!==Number(gameId)) throw new Error("Bracket match is already linked to another Game.");
    sheet.getRange(row+1,gameIndex+1).setValue(gameId); SpreadsheetApp.flush(); return;
  }
  throw new Error("Bracket match not found.");
}

function writeEventBracketMatches_(eventId, matches) {
  const sheet=ensureEventEngineSheet(CONFIG.SHEETS.EVENT_BRACKET_MATCHES,DOUBLE_ELIMINATION_BRACKET_HEADERS);
  const range=sheet.getDataRange(); const values=range.getValues(); const headers=values[0].map(getEventManagerString); const matchById={}; matches.forEach(function(match){matchById[match.matchId]=match;}); let found=0;
  for(let row=1;row<values.length;row++) if(getEventManagerString(values[row][headers.indexOf("Event ID")])===eventId){ const m=matchById[getEventManagerString(values[row][headers.indexOf("Match ID")])]; if(!m) throw new Error("Bracket match persistence row is missing."); found++; const record={"Player A":m.playerA,"Seed A":m.seedA,"Player B":m.playerB,"Seed B":m.seedB,"Status":m.status,"Winner":m.winner,"Loser":m.loser,"Activated At":m.activatedAt,"Deadline":m.deadline,"Game ID":m.gameId,"Resolution":m.resolution}; Object.keys(record).forEach(function(key){values[row][headers.indexOf(key)]=record[key]||"";}); }
  if(found!==matches.length) throw new Error("Bracket persistence is incomplete.");
  range.setValues(values);
  SpreadsheetApp.flush();
}

function removeEventBracketMatches_(eventId) {
  const sheet = getEventEngineRuntimeSheet(CONFIG.SHEETS.EVENT_BRACKET_MATCHES);
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  const eventIdIndex = values[0].indexOf("Event ID");
  for (let row = values.length - 1; row >= 1; row--) {
    if (getEventManagerString(values[row][eventIdIndex]) === eventId) sheet.deleteRow(row + 1);
  }
}

// Owner-run launch preparation. This never releases matches or sends announcements.
function inspectTop40LaunchPreparation() {
  const eventId = "event-lobo-s-american-top-40";
  const roster = buildPublicSnapshotTop40Registrations_(readPublicSnapshotTop40RegistrationNames_(), new Date().toISOString());
  const result = { event:getEventById(eventId), roster:roster.players.map(function(item){return item.name;}), participants:getEventRegistrationRows(eventId).map(function(item){return {player:item.player,status:item.status,seed:item.seed};}), matches:readEventBracketMatches_(eventId).map(function(item){return {matchId:item.matchId,status:item.status,activatedAt:item.activatedAt};}) };
  // Keep operational logs public-safe: no event settings, contacts, or credentials.
  const summary = { eventId:eventId, registration:result.event.registration, roster:result.roster, participants:result.participants, matches:result.matches };
  Logger.log(JSON.stringify(summary));
  return summary;
}

function prepareTop40Launch() {
  const eventId = "event-lobo-s-american-top-40";
  const approved = ["Lobo","Arg","Chainsaw","Brunix","Johawhich","Genghis Cohen","Dr Hareng","Wax","Rysanov","Zhukov2","Theronth","knightrekie","Harrower","xtapro","ZeroPain","Blitchga","ADangerousFrog","Defuser","Robock","KharuS","erichagz","Firemarshallbill","Snakes / Lucas","Sam","Vision"];
  const key = function(value){return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");};
  const aliases = { lobo0705:"lobo", drhareng:"drhareng", snakes:"snakeslucas", lucas:"snakeslucas" };
  const identity = function(value){const valueKey=key(value); return aliases[valueKey] || valueKey;};
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const event = getEventById(eventId);
    if (!event || event.type !== "Individual Double Elimination") throw new Error("Top 40 event identity did not match.");
    const existingMatches = readEventBracketMatches_(eventId);
    if (existingMatches.some(function(match){return match.activatedAt || match.deadline || match.status === "Completed";})) throw new Error("The bracket has started; launch preparation will not change it.");
    const roster = buildPublicSnapshotTop40Registrations_(readPublicSnapshotTop40RegistrationNames_(), new Date().toISOString()).players;
    if (roster.length !== approved.length) throw new Error("Registration roster changed; expected exactly 25 approved players.");
    const entrants = approved.map(function(name,index){
      const found=roster.filter(function(item){return identity(item.name) === identity(name);});
      if(found.length !== 1) throw new Error("Approved roster identity needs review: " + name);
      return {player:found[0].name,seed:index+1};
    });
    if(new Set(entrants.map(function(item){return identity(item.player);})).size !== 25) throw new Error("Approved roster contains duplicate identities.");
    const responseSheet=lifGetTargetSpreadsheet_().getSheetByName(PUBLIC_SNAPSHOT_TOP40_REGISTRATION_SHEET);
    if(!responseSheet || !responseSheet.getFormUrl()) throw new Error("Existing Top 40 registration form was not found.");
    const registrationForm=FormApp.openByUrl(responseSheet.getFormUrl());
    if(registrationForm.getPublishedUrl().split("?")[0] !== TOP40_PORTAL_REGISTRATION_FORM_URL) throw new Error("Top 40 registration form identity did not match.");
    const mission=getCanonicalMissionName("Corporate Appropriation");
    if(mission !== "Corporate Appropriation") throw new Error("Opening mission is missing from the canonical catalog.");
    const matches=buildDoubleEliminationBracket_(eventId,entrants);
    validateDoubleEliminationBracket_(matches,entrants); validateEventBracketLifecycle_(matches);
    if(existingMatches.length) {
      const expected=JSON.stringify(matches.map(function(item){return [item.matchId,item.playerA,item.playerB,item.nextWinnerMatch,item.nextLoserMatch];}));
      const actual=JSON.stringify(existingMatches.map(function(item){return [item.matchId,item.playerA,item.playerB,item.nextWinnerMatch,item.nextLoserMatch];}));
      if(expected !== actual) throw new Error("Existing draft differs; no bracket rows were overwritten.");
    }
    const sheet=ensureEventEngineSheet(CONFIG.SHEETS.EVENT_PARTICIPANTS,EVENT_ENGINE_PARTICIPANT_HEADERS);
    const data=sheet.getDataRange().getValues(), headers=data[0].map(getEventManagerString);
    const eventColumn=headers.indexOf("Event ID"), playerColumn=headers.indexOf("Player"), statusColumn=headers.indexOf("Status");
    const existing=data.slice(1).filter(function(row){return row[eventColumn] === eventId;});
    existing.forEach(function(row){if(row[statusColumn] === "Registered" && !entrants.some(function(entry){return identity(entry.player) === identity(row[playerColumn]);})) throw new Error("An additional registered participant requires review.");});
    const now=getEventManagerTimestamp();
    entrants.forEach(function(entry){
      const matching=[]; data.slice(1).forEach(function(row,index){if(row[eventColumn] === eventId && identity(row[playerColumn]) === identity(entry.player)) matching.push(index+1);});
      if(matching.length > 1) throw new Error("Duplicate event participant: " + entry.player);
    });
    // All identity checks happen before changing event data.
    entrants.forEach(function(entry){
      const index=data.findIndex(function(row,rowIndex){return rowIndex > 0 && row[eventColumn] === eventId && identity(row[playerColumn]) === identity(entry.player);});
      const record={"Event ID":eventId,"Player":entry.player,"Status":"Registered","Seed":entry.seed,"Updated At":now};
      if(index >= 1) Object.keys(record).forEach(function(header){data[index][headers.indexOf(header)] = record[header];});
      else {record["Display Name"]=entry.player;record["Registered At"]=now;record["Role"]="Player"; data.push(headers.map(function(header){return record[header] || "";}));}
    });
    sheet.getRange(1,1,data.length,headers.length).setValues(data);
    updateEventManagerEventFields(eventId,{"Registration":"Closed","Status":"Registration Closed","Lifecycle Stage":"Registration Closed"});
    SpreadsheetApp.flush(); invalidateEventManagerCaches(eventId);
    if(!existingMatches.length) persistEventBracketMatches_(eventId,matches);
    const assignments=validateEventBracketMissionAssignments_(eventId,matches,[{bracket:"Winners",bracketRound:1,mission:mission,map:"Lobo Tourney Map 1 — Asterion Research Campus"}]);
    persistEventBracketMissionAssignments_(eventId,assignments);
    registrationForm.setAcceptingResponses(false);
    invalidateEventManagerCaches(eventId);
    const result={eventId:eventId,players:entrants.length,visionSeed:25,openingMission:mission,map:"Lobo Tourney Map 1 — Asterion Research Campus",matches:matches.length,activeMatches:matches.filter(function(match){return match.status === "Active";}).length,deadlinesStarted:false,remainingMissions:assignments.filter(function(item){return !item.mission && !(item.bracket === "Grand Final" && item.bracketRound === 2);}).length};
    Logger.log(JSON.stringify(result));return result;
  } finally {lock.releaseLock();}
}
