function rebuildGameEngine() {

  Logger.log("Building Game Engine...");

  const responses =
    getFormResponses();

  const engine =
    buildGameEngineRows(
      responses
    );

  const analytics =
    buildGameAnalyticsRows(
      responses
    );

  writeSheet(
    CONFIG.SHEETS.ENGINE,
    engine
  );

  writeSheet(
    CONFIG.SHEETS.GAME_ANALYTICS,
    analytics
  );

  Logger.log(
    (engine.length - 1) +
    " player records created."
  );

  Logger.log(
    (analytics.length - 1) +
    " games processed."
  );

}