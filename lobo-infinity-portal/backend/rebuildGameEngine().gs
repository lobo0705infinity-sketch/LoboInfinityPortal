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

function publishLatestGameSubmittedAutomationEvent(game) {

  try {

    const submittedGame =
      game || getDiscordLatestGame();

    return publishGameSubmittedAutomationEvent(submittedGame);

  }
  catch (err) {

    Logger.log(
      "Game submitted automation event failed: " +
      String(err && err.message ? err.message : err)
    );

  }

}

function publishGameSubmittedAutomationEvent(game) {

  try {

    if (
      typeof publishLeagueAutomationEvent !== "function" ||
      !game
    )
      return {
        success: true,
        skipped: true
      };

    return publishLeagueAutomationEvent({
      eventType: "gameSubmitted",
      category: "Match Results",
      priority: "high",
      player:
        game && game.winner
          ? game.winner
          : "",
      division:
        game && game.division
          ? game.division
          : "",
      message:
        game && game.summary
          ? game.summary
          : "A league game was submitted.",
      payload:
        JSON.stringify(game || {})
    });

  }
  catch (err) {

    Logger.log(
      "Game submitted automation event failed: " +
      String(err && err.message ? err.message : err)
    );

  }

}
