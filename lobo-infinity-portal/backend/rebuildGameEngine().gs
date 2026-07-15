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

  return {
    engineRows: engine.length - 1,
    analyticsRows: analytics.length - 1
  };

}

function publishLatestGameSubmittedAutomationEvent() {

  try {

    if (
      typeof publishLeagueAutomationEvent === "function"
    ) {
      const latestGame =
        getDiscordLatestGame();

      if (!latestGame)
        return;

      publishLeagueAutomationEvent({
        eventType: "gameSubmitted",
        category: "Match Results",
        priority: "high",
        player:
          latestGame && latestGame.winner
            ? latestGame.winner
            : "",
        division:
          latestGame && latestGame.division
            ? latestGame.division
            : "",
        message:
          latestGame && latestGame.summary
            ? latestGame.summary
            : "A league game was submitted.",
        payload:
          JSON.stringify(latestGame || {})
      });
    }

  }
  catch (err) {

    Logger.log(
      "Game submitted automation event failed: " +
      String(err && err.message ? err.message : err)
    );

  }

}
