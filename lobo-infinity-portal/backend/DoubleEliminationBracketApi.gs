const DOUBLE_ELIMINATION_BRACKET_HEADERS = [
  "Event ID", "Match ID", "Bracket", "Bracket Round", "Position",
  "Player A", "Seed A", "Player B", "Seed B", "Player A Source", "Player B Source",
  "Status", "Winner", "Loser", "Next Winner Match", "Next Winner Slot",
  "Next Loser Match", "Next Loser Slot", "Created At"
];

function getEventBracket(e) {
  const params = getApiParameters(e);
  const eventId = getEventManagerString(params.eventId);
  if (eventId === "") throw new Error("Event ID is required.");
  const event = getEventByIdNoEnsure(eventId);
  if (!event) throw new Error("Event not found.");
  const participants = getEventRegistrationRows(eventId);
  return jsonOutput({ success: true, bracket: buildEventBracketProjection_(event, participants) });
}

function generateEventBracket(e) {
  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const eventId = getEventManagerString(getApiParameters(e).eventId);
    if (eventId === "") throw new Error("Event ID is required.");
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const event = getEventByIdNoEnsure(eventId);
      if (!event) throw new Error("Event not found.");
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
      let persisted;
      try {
        persistEventBracketMatches_(eventId, matches);
        persisted = readEventBracketMatches_(eventId);
        validateDoubleEliminationBracket_(persisted, entrants);
      } catch (persistenceError) {
        removeEventBracketMatches_(eventId);
        throw persistenceError;
      }
      recordEventManagerAudit(auth, eventId, "Tournament bracket generated", matches.length + " matches");
      invalidateEventManagerCaches();
      return jsonOutput({ success: true, bracket: buildEventBracketProjection_(event, participants, persisted) });
    } finally {
      lock.releaseLock();
    }
  });
}

function buildEventBracketProjection_(event, participants, suppliedMatches) {
  const matches = suppliedMatches || readEventBracketMatches_(event.id);
  return {
    eventId: event.id,
    generated: matches.length > 0,
    readiness: buildEventBracketReadiness_(event, participants),
    matches: matches
  };
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
    return { eventId:eventId, matchId:id, bracket:bracket, bracketRound:round, position:position, playerA:"", seedA:"", playerB:"", seedB:"", playerASource:"", playerBSource:"", status:"Pending", winner:"", loser:"", nextWinnerMatch:"", nextWinnerSlot:"", nextLoserMatch:"", nextLoserSlot:"" };
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
      else { match.nextLoserMatch="L"+(2*round-2)+"-M"+position; match.nextLoserSlot="B"; }
      if (round > 1) { match.playerASource="Winner W"+(round-1)+"-M"+(position*2-1); match.playerBSource="Winner W"+(round-1)+"-M"+(position*2); }
    }
  }
  for (let round = 1; round <= loserRounds; round++) {
    const count = capacity === 2 ? 1 : capacity / Math.pow(2, Math.ceil(round / 2) + 1);
    for (let position = 1; position <= count; position++) {
      const match = byId["L"+round+"-M"+position];
      if (capacity === 2) { match.playerASource="Loser W1-M1"; match.playerBSource="BYE"; match.nextWinnerMatch="GF-M1"; match.nextWinnerSlot="B"; }
      else if (round === 1) { match.playerASource="Loser W1-M"+(position*2-1); match.playerBSource="Loser W1-M"+(position*2); }
      else if (round % 2 === 0) { match.playerASource="Winner L"+(round-1)+"-M"+position; match.playerBSource="Loser W"+(round/2+1)+"-M"+position; }
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

  matches.filter(function(match) { return match.bracket === "Winners" && match.bracketRound === 1; }).forEach(function(match) {
    const players = [match.playerA, match.playerB].filter(function(player){ return player && player !== "BYE"; });
    if (players.length === 1) {
      match.status="Bye Advanced"; match.winner=players[0]; match.loser="BYE";
      const target=byId[match.nextWinnerMatch];
      if (target) { const slot=match.nextWinnerSlot; target[slot === "A" ? "playerA" : "playerB"]=players[0]; target[slot === "A" ? "seedA" : "seedB"]=match.playerA===players[0]?match.seedA:match.seedB; }
    }
  });
  return matches;
}

function validateDoubleEliminationBracket_(matches, entrants) {
  const ids = matches.map(function(match){return match.matchId;});
  if (new Set(ids).size !== ids.length) throw new Error("Bracket contains duplicate Match IDs.");
  const idSet = new Set(ids);
  const gf = matches.filter(function(match){return match.bracket === "Grand Final";});
  if (gf.length !== 1 || gf[0].matchId !== "GF-M1") throw new Error("Bracket must contain exactly one Grand Final.");
  if (ids.some(function(id){return /reset/i.test(id);})) throw new Error("Grand Final reset matches are not supported.");
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
  const rows = matches.map(function(m){return [m.eventId,m.matchId,m.bracket,m.bracketRound,m.position,m.playerA,m.seedA,m.playerB,m.seedB,m.playerASource,m.playerBSource,m.status,m.winner,m.loser,m.nextWinnerMatch,m.nextWinnerSlot,m.nextLoserMatch,m.nextLoserSlot,now];});
  if (rows.length) sheet.getRange(sheet.getLastRow()+1,1,rows.length,DOUBLE_ELIMINATION_BRACKET_HEADERS.length).setValues(rows);
  SpreadsheetApp.flush();
}

function readEventBracketMatches_(eventId) {
  const sheet = getEventEngineRuntimeSheet(CONFIG.SHEETS.EVENT_BRACKET_MATCHES);
  if (!sheet) return [];
  return getEventEngineRows(sheet).filter(function(row){return row["Event ID"] === eventId;}).map(function(row){return { eventId:row["Event ID"],matchId:row["Match ID"],bracket:row["Bracket"],bracketRound:Number(row["Bracket Round"]),position:Number(row["Position"]),playerA:row["Player A"]||"",seedA:row["Seed A"]===""?"":Number(row["Seed A"]),playerB:row["Player B"]||"",seedB:row["Seed B"]===""?"":Number(row["Seed B"]),playerASource:row["Player A Source"]||"",playerBSource:row["Player B Source"]||"",status:row["Status"]||"Pending",winner:row["Winner"]||"",loser:row["Loser"]||"",nextWinnerMatch:row["Next Winner Match"]||"",nextWinnerSlot:row["Next Winner Slot"]||"",nextLoserMatch:row["Next Loser Match"]||"",nextLoserSlot:row["Next Loser Slot"]||""};});
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
