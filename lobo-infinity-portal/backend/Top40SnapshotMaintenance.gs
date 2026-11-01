// Owner-run recovery for launch publication; canonical Games and army lists are never changed.
function repairTop40SnapshotPublication() {
  const sources = [
    {name:"Army Lists", read:readArmyListsReadModelPayload, rebuild:rebuildArmyListsReadModelPayloadAndPersist},
    {name:"Army Intelligence", read:readArmyIntelligenceReadModelPayload, rebuild:rebuildArmyIntelligenceReadModelPayloadAndPersist}
  ];
  sources.forEach(function(source) {
    try { source.read(); Logger.log(source.name + " persisted JSON is valid."); }
    catch(error) {
      Logger.log(source.name + " persisted JSON needs recovery: " + String(error.message || error).slice(0,200));
      if (!(error instanceof SyntaxError)) throw error;
      const lock=LockService.getScriptLock(); lock.waitLock(30000);
      try { source.rebuild(); source.read(); Logger.log(source.name + " derived model rebuilt and validated."); }
      finally { lock.releaseLock(); }
    }
  });
  const result=runFullPublicSnapshotRefresh();
  if(!result || !result.success) throw new Error("Launch publication failed: " + String(result && result.error || "Unknown error"));
  return result;
}

// Approved launch setup: stable seeds, no games/results/deadlines are created.
function completeTop40LaunchSetup() {
  const eventId="event-lobo-s-american-top-40";
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const matches=readEventBracketMatches_(eventId);
    if(matches.length!==63 || matches.some(function(match){return match.activatedAt || match.deadline || match.status==="Completed";})) throw new Error("Expected the untouched 25-player prepared bracket.");
    const entrants=getEventRegistrationRows(eventId).filter(function(item){return item.status==="Registered";});
    if(entrants.length!==25 || !entrants.some(function(item){return item.player==="Vision"&&Number(item.seed)===25;})) throw new Error("Approved seeded field changed.");
    const rounds=[{"bracket":"Winners","bracketRound":1,"mission":"Corporate Appropriation","missionGeistId":"s18_corporate_appropriation","map":"Lobo Tourney Map 1 — Asterion Research Campus"},{"bracket":"Winners","bracketRound":2,"mission":"Superiority","missionGeistId":"s18_superiority","map":"superiority-1"},{"bracket":"Winners","bracketRound":3,"mission":"Uplink Center","missionGeistId":"s18_uplink_center","map":"uplink-center-1-satellite"},{"bracket":"Winners","bracketRound":4,"mission":"The Dig","missionGeistId":"s18_the_dig","map":"the-dig-1"},{"bracket":"Winners","bracketRound":5,"mission":"Crossing Lines","missionGeistId":"s18_crossing_lines","map":"crossing-lines-1-satellite"},{"bracket":"Losers","bracketRound":1,"mission":"Annihilation","missionGeistId":"s18_annihilation","map":"annihilation-1"},{"bracket":"Losers","bracketRound":2,"mission":"Provisioning","missionGeistId":"s18_provisioning","map":"provisioning-1"},{"bracket":"Losers","bracketRound":3,"mission":"Cutthroat","missionGeistId":"s18_cutthroat","map":"cutthroat-1"},{"bracket":"Losers","bracketRound":4,"mission":"Battleground","missionGeistId":"s18_battleground","map":"battleground-1"},{"bracket":"Losers","bracketRound":5,"mission":"Neutralization","missionGeistId":"s18_neutralization","map":"neutralization-1-satellite"},{"bracket":"Losers","bracketRound":6,"mission":"Outbreak","missionGeistId":"s18_outbreak","map":"outbreak-1"},{"bracket":"Losers","bracketRound":7,"mission":"Hardlock","missionGeistId":"s18_hard_lock","map":"hardlock-1-satellite"},{"bracket":"Losers","bracketRound":8,"mission":"Critical Intervention","missionGeistId":"s18_critical_intervention","map":"critical-intervention-1"},{"bracket":"Grand Final","bracketRound":1,"mission":"Double Bind","missionGeistId":"s18_double_bind","map":"double-bind-1"}];
    const assignments=validateEventBracketMissionAssignments_(eventId,matches,rounds);
    persistEventBracketMissionAssignments_(eventId,assignments);
    updateEventManagerEventFields(eventId,{"Start Date":"2026-11-01T09:00:00-05:00"});
    const form=refreshTop40GameSubmissionForm();
    if(form.acceptingResponses) throw new Error("The result form must remain paused before release.");
    SpreadsheetApp.flush();invalidateEventManagerCaches(eventId);
    const summary={players:25,visionSeed:25,assignedRounds:14,missionEdition:"ITS 18",plannedOpening:"2026-11-01T09:00:00-05:00",releaseMode:"manual",activeMatches:0,deadlinesStarted:false,formAcceptingResponses:form.acceptingResponses};
    Logger.log(JSON.stringify(summary));return summary;
  } finally {lock.releaseLock();}
}
