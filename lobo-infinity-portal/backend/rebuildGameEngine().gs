function rebuildGameEngine(importedRowNumber) {

  Logger.log("Building Game Engine...");

  const responses =
    getFormResponses();

  const tracedSheetRow =
    Number(importedRowNumber) ||
    (responses.length + 1);

  const tracedResponseIndex =
    tracedSheetRow - 2;

  const tracedRow =
    responses[tracedResponseIndex];

  const tracedRowAccepted =
    Boolean(tracedRow) &&
    validateGame(tracedRow);

  Logger.log(
    "Game Engine trace row number: " +
    tracedSheetRow
  );

  Logger.log(
    "Game Engine trace row contents: " +
    JSON.stringify(tracedRow)
  );

  if (!tracedRow) {
    Logger.log(
      JSON.stringify({
        sourceFile: "rebuildGameEngine().gs",
        functionName: "rebuildGameEngine",
        lineNumber: 27,
        condition: "responses[tracedSheetRow - 2] exists",
        actualValues: {
          tracedSheetRow: tracedSheetRow,
          responseCount: responses.length
        },
        result: "FAIL"
      })
    );
  }
  else {
    const player1Present =
      Boolean(tracedRow[FORM.PLAYER1]);

    Logger.log(
      "Validation A " +
      (player1Present ? "PASS" : "FAIL")
    );

    if (!player1Present) {
      Logger.log(
        JSON.stringify({
          sourceFile: "GameEngine.gs",
          functionName: "validateGame",
          lineNumber: 135,
          condition: "Boolean(row[FORM.PLAYER1])",
          actualValues: {
            player1Index: FORM.PLAYER1,
            player1: tracedRow[FORM.PLAYER1]
          },
          result: "FAIL"
        })
      );
    }
    else {
      const player2Present =
        Boolean(tracedRow[FORM.PLAYER2]);

      Logger.log(
        "Validation B " +
        (player2Present ? "PASS" : "FAIL")
      );

      if (!player2Present) {
        Logger.log(
          JSON.stringify({
            sourceFile: "GameEngine.gs",
            functionName: "validateGame",
            lineNumber: 138,
            condition: "Boolean(row[FORM.PLAYER2])",
            actualValues: {
              player2Index: FORM.PLAYER2,
              player2: tracedRow[FORM.PLAYER2]
            },
            result: "FAIL"
          })
        );
      }
      else {
        const playersDiffer =
          tracedRow[FORM.PLAYER1] !==
          tracedRow[FORM.PLAYER2];

        Logger.log(
          "Validation C " +
          (playersDiffer ? "PASS" : "FAIL")
        );

        if (!playersDiffer) {
          Logger.log(
            JSON.stringify({
              sourceFile: "GameEngine.gs",
              functionName: "validateGame",
              lineNumber: 141,
              condition: "row[FORM.PLAYER1] !== row[FORM.PLAYER2]",
              actualValues: {
                player1Index: FORM.PLAYER1,
                player1: tracedRow[FORM.PLAYER1],
                player2Index: FORM.PLAYER2,
                player2: tracedRow[FORM.PLAYER2]
              },
              result: "FAIL"
            })
          );
        }
      }
    }
  }

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

  if (tracedRowAccepted) {
    Logger.log(
      JSON.stringify({
        sourceFile: "rebuildGameEngine().gs",
        functionName: "rebuildGameEngine",
        condition: "Imported row written into Game Engine",
        rowNumber: tracedSheetRow,
        result: "PASS"
      })
    );
  }

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
