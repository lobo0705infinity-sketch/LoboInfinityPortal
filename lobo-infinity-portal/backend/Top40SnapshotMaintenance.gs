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
