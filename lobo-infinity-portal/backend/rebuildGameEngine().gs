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

  let armyIntelligence;
  let armyIntelligenceSkipped = false;

  try {
    armyIntelligence =
      buildArmyIntelligenceForGameEngineRows(
        engine
      );
  }
  catch (error) {
    armyIntelligenceSkipped = true;

    const timestamp =
      new Date();

    const message =
      error && error.message
        ? String(error.message)
        : String(error);

    const armyListIdMatch =
      message.match(/Army List ID\s+(\d+)/i);

    const armyListId =
      armyListIdMatch
        ? armyListIdMatch[1]
        : "";

    const stack =
      error && error.stack
        ? String(error.stack)
        : "";

    const spreadsheet =
      lifGetTargetSpreadsheet_();

    const importLog =
      lifEnsureImportLog_(spreadsheet);

    lifWriteImportLog_(
      importLog,
      "rebuild:" + timestamp.toISOString(),
      "rebuild",
      "",
      "Army Intelligence Skipped",
      JSON.stringify({
        timestamp: timestamp.toISOString(),
        armyListId: armyListId,
        message: message,
        stack: stack
      })
    );

    Logger.log(
      "Army Intelligence skipped: " +
      JSON.stringify({
        timestamp: timestamp.toISOString(),
        armyListId: armyListId,
        message: message,
        stack: stack
      })
    );

    const existingArmyIntelligenceSheet =
      spreadsheet.getSheetByName(
        CONFIG.SHEETS.ARMY_INTELLIGENCE
      );

    armyIntelligence =
      existingArmyIntelligenceSheet &&
      existingArmyIntelligenceSheet.getLastRow() > 0
        ? existingArmyIntelligenceSheet
            .getDataRange()
            .getValues()
        : [ARMY_INTELLIGENCE_HEADERS];
  }

  persistGameEngineState(
    engine,
    analytics,
    armyIntelligence
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

  if (typeof rebuildArmyListsReadModel === "function")
    rebuildArmyListsReadModel();

  if (typeof rebuildArmyIntelligenceReadModel === "function")
    rebuildArmyIntelligenceReadModel();

  if (typeof syncLegacyArmyIntelligenceSnapshotsForCurrentSources === "function")
    syncLegacyArmyIntelligenceSnapshotsForCurrentSources();

  Logger.log(
    (engine.length - 1) +
    " player records created."
  );

  Logger.log(
    (analytics.length - 1) +
    " games processed."
  );

  return {
    status: armyIntelligenceSkipped
      ? "Rebuild completed with Army Intelligence skipped."
      : "Rebuild completed.",
    engineRows: engine.length - 1,
    analyticsRows: analytics.length - 1,
    armyIntelligenceRows: armyIntelligence.length - 1,
    armyIntelligenceSkipped: armyIntelligenceSkipped
  };

}

function persistGameEngineState(
  engine,
  analytics,
  armyIntelligence
) {

  const targets = [
    {
      sheetName: CONFIG.SHEETS.ENGINE,
      rows: engine
    },
    {
      sheetName: CONFIG.SHEETS.GAME_ANALYTICS,
      rows: analytics
    },
    {
      sheetName: CONFIG.SHEETS.ARMY_INTELLIGENCE,
      rows: armyIntelligence
    }
  ];

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  targets.forEach(function(target) {

    if (!spreadsheet.getSheetByName(target.sheetName))
      spreadsheet.insertSheet(target.sheetName);

  });

  targets.forEach(function(target) {

    writeSheet(
      target.sheetName,
      target.rows
    );

  });

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
