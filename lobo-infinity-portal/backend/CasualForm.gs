function createCasualSubmissionForm(responseSpreadsheetId, requireExisting) {
  const form = lifGetCasualForm_(requireExisting === true);
  if (!form.getItems().length) {
    lifConfigureCasualForm_(form);
    lifAddCasualGameFields_(
      form,
      lifGetCasualPlayerOptions_(),
      lifGetCasualMissionOptions_(),
      lifGetCasualFactionOptions_()
    );
  }
  return lifLinkForm_(form, responseSpreadsheetId);
}

function refreshCasualSubmissionForm() {
  const form = lifGetCasualForm_(true);
  const players = lifGetCasualPlayerOptions_();
  lifUpdateCasualPlayerChoices_(form, players);
  return form.getPublishedUrl();
}

function repairCasualSubmissionForm() {
  const form = lifGetCasualForm_(true);
  const players = lifGetCasualPlayerOptions_();
  const missions = lifGetCasualMissionOptions_();
  const factions = lifGetCasualFactionOptions_();
  const expected = lifGetCasualSchema_();
  let items = form.getItems();

  if (items.length > expected.length) {
    throw new Error("Casual Form has unexpected extra items; repair stopped without deleting anything.");
  }

  items.forEach(function(item, index) {
    lifValidateCasualSchemaItem_(item, expected[index], index);
  });

  lifConfigureCasualForm_(form);
  if (items.length > 1) {
    items[1].asListItem().setChoiceValues(players).setRequired(true);
  }

  for (let index = items.length; index < expected.length; index += 1) {
    lifAppendCasualSchemaItem_(form, expected[index], players, missions, factions);
  }

  items = form.getItems();
  if (items.length !== expected.length) {
    throw new Error("Casual Form repair did not produce the expected item count.");
  }
  items.forEach(function(item, index) {
    lifValidateCasualSchemaItem_(item, expected[index], index);
    lifReconcileCasualSchemaItem_(item, expected[index], players, missions, factions);
  });
  lifUpdateCasualPlayerChoices_(form, players);
  return inspectCasualSubmissionForm();
}

function inspectCasualSubmissionForm() {
  const form = lifGetCasualForm_(true);
  const destinationId = String(form.getDestinationId() || "").trim();
  const items = form.getItems().map(function(item) {
    const type = String(item.getType());
    const result = { title: item.getTitle(), type: type, required: false, choices: 0 };
    if (type === String(FormApp.ItemType.LIST)) {
      const list = item.asListItem();
      result.required = list.isRequired();
      result.choices = list.getChoices().length;
    } else if (type === String(FormApp.ItemType.TEXT)) {
      result.required = item.asTextItem().isRequired();
    } else if (type === String(FormApp.ItemType.PARAGRAPH_TEXT)) {
      result.required = item.asParagraphTextItem().isRequired();
    }
    return result;
  });
  const response = lifInspectCasualResponseDestination_(form, destinationId);
  return {
    formId: form.getId(),
    title: form.getTitle(),
    collectEmail: form.collectsEmail(),
    destinationId: destinationId,
    formResponseCount: form.getResponses().length,
    items: items,
    responseSheet: response
  };
}

function lifInspectCasualResponseDestination_(form, destinationId) {
  if (!destinationId) return { sheetName: "", headers: [], rowCount: 0 };
  const spreadsheet = SpreadsheetApp.openById(destinationId);
  const formId = form.getId();
  const sheet = spreadsheet.getSheets().filter(function(candidate) {
    return String(candidate.getFormUrl() || "").indexOf(formId) >= 0;
  })[0];
  if (!sheet) return { sheetName: "", headers: [], rowCount: 0 };
  const lastColumn = sheet.getLastColumn();
  return {
    sheetName: sheet.getName(),
    headers: lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] : [],
    rowCount: Math.max(0, sheet.getLastRow() - 1)
  };
}

function lifGetCasualForm_(requireExisting) {
  const existingId = String(lifGetProperties_().getProperty(LIF_FORMS.PROPERTIES.CASUAL_FORM_ID) || "").trim();
  if (requireExisting && !existingId) {
    throw new Error("Missing required script property: " + LIF_FORMS.PROPERTIES.CASUAL_FORM_ID);
  }
  return existingId ? FormApp.openById(existingId) : FormApp.create(LIF_FORMS.FORM_TITLES.CASUAL);
}

function lifConfigureCasualForm_(form) {
  form.setTitle(LIF_FORMS.FORM_TITLES.CASUAL)
    .setDescription("Submit a completed casual Infinity game for portal lifetime analytics.")
    .setCollectEmail(false)
    .setConfirmationMessage("Your result was received and will be imported after validation.")
    .setProgressBar(true)
    .setShowLinkToRespondAgain(false);
  return form;
}

function lifGetCasualSchema_() {
  const f = LIF_FORMS.FIELDS;
  return [
    { title: "Player Information", type: "SECTION_HEADER" },
    { title: f.PLAYER, type: "LIST", required: true, choices: "players" },
    { title: f.PLAYER_FACTION, type: "LIST", required: true, choices: "factions" },
    { title: f.PLAYER_ARMY_CODE, type: "TEXT", required: true, help: "Paste the complete Infinity Army code." },
    { title: f.OPPONENT, type: "LIST", required: true, choices: "players" },
    { title: f.OPPONENT_FACTION, type: "LIST", required: true, choices: "factions" },
    { title: f.OPPONENT_ARMY_CODE, type: "TEXT", required: true, help: "Paste the complete Infinity Army code." },
    { title: "Result", type: "SECTION_HEADER" },
    { title: f.MISSION, type: "LIST", required: true, choices: "missions" },
    { title: f.GAME_RESULT, type: "LIST", required: true, values: ["Player Victory", "Opponent Victory", "Draw"] },
    { title: f.FIRST_TURN, type: "LIST", required: true, values: ["Player", "Opponent"] },
    { title: "Scores", type: "SECTION_HEADER" },
    { title: f.PLAYER_TP, type: "SCORE", required: true },
    { title: f.OPPONENT_TP, type: "SCORE", required: true },
    { title: f.PLAYER_OP, type: "SCORE", required: true },
    { title: f.OPPONENT_OP, type: "SCORE", required: true },
    { title: f.PLAYER_VP, type: "SCORE", required: true },
    { title: f.OPPONENT_VP, type: "SCORE", required: true },
    { title: "Game Details", type: "SECTION_HEADER" },
    { title: f.BEST_MOMENT, type: "PARAGRAPH_TEXT", required: false },
    { title: f.NOTES, type: "PARAGRAPH_TEXT", required: false }
  ];
}

function lifAddCasualGameFields_(form, players, missions, factions) {
  lifGetCasualSchema_().forEach(function(spec) {
    lifAppendCasualSchemaItem_(form, spec, players, missions, factions);
  });
  return form;
}

function lifAppendCasualSchemaItem_(form, spec, players, missions, factions) {
  let item = null;
  try {
    if (spec.type === "SECTION_HEADER") {
      item = form.addSectionHeaderItem();
      item.setTitle(spec.title);
    } else if (spec.type === "LIST") {
      const choices = spec.choices === "players" ? players
        : spec.choices === "missions" ? missions
        : spec.choices === "factions" ? factions
        : spec.values;
      item = form.addListItem();
      item.setTitle(spec.title).setChoiceValues(choices).setRequired(spec.required === true);
    } else if (spec.type === "TEXT") {
      item = form.addTextItem();
      item.setTitle(spec.title).setRequired(spec.required === true);
      if (spec.help) item.setHelpText(spec.help);
    } else if (spec.type === "SCORE") {
      item = form.addTextItem();
      item.setTitle(spec.title)
        .setRequired(true)
        .setHelpText("Enter a non-negative whole number.")
        .setValidation(FormApp.createTextValidation().requireWholeNumber().build());
    } else if (spec.type === "PARAGRAPH_TEXT") {
      item = form.addParagraphTextItem();
      item.setTitle(spec.title).setRequired(spec.required === true);
    }
  } catch (err) {
    if (item) {
      try { form.deleteItem(item); } catch (cleanupErr) { Logger.log("Casual Form item cleanup failed."); }
    }
    throw err;
  }
  return item;
}

function lifValidateCasualSchemaItem_(item, spec, index) {
  if (!spec) throw new Error("Casual Form contains an unexpected item at position " + (index + 1) + ".");
  const actualType = String(item.getType());
  const expectedType = spec.type === "SCORE" ? "TEXT" : spec.type;
  if (String(item.getTitle() || "").trim() !== spec.title || actualType !== expectedType) {
    throw new Error("Casual Form item " + (index + 1) + " does not match the canonical schema.");
  }
}

function lifReconcileCasualSchemaItem_(item, spec, players, missions, factions) {
  if (spec.type === "LIST") {
    const choices = spec.choices === "players" ? players
      : spec.choices === "missions" ? missions
      : spec.choices === "factions" ? factions
      : spec.values;
    item.asListItem().setChoiceValues(choices).setRequired(spec.required === true);
  } else if (spec.type === "TEXT") {
    const text = item.asTextItem().setRequired(spec.required === true);
    if (spec.help) text.setHelpText(spec.help);
  } else if (spec.type === "SCORE") {
    item.asTextItem()
      .setRequired(true)
      .setHelpText("Enter a non-negative whole number.")
      .setValidation(FormApp.createTextValidation().requireWholeNumber().build());
  } else if (spec.type === "PARAGRAPH_TEXT") {
    item.asParagraphTextItem().setRequired(spec.required === true);
  }
}

function lifUpdateCasualPlayerChoices_(form, players) {
  const validated = lifNormalizeCasualPlayerChoices_(players);
  const playerItem = lifFindCasualListItem_(form, LIF_FORMS.FIELDS.PLAYER);
  const opponentItem = lifFindCasualListItem_(form, LIF_FORMS.FIELDS.OPPONENT);
  const previousPlayer = playerItem.getChoices().map(function(choice) { return choice.getValue(); });
  const previousOpponent = opponentItem.getChoices().map(function(choice) { return choice.getValue(); });
  const playerRequired = playerItem.isRequired();
  const opponentRequired = opponentItem.isRequired();
  try {
    playerItem.setChoiceValues(validated).setRequired(true);
    opponentItem.setChoiceValues(validated).setRequired(true);
  } catch (err) {
    try {
      if (previousPlayer.length) playerItem.setChoiceValues(previousPlayer);
      playerItem.setRequired(playerRequired);
      if (previousOpponent.length) opponentItem.setChoiceValues(previousOpponent);
      opponentItem.setRequired(opponentRequired);
    } catch (rollbackErr) {
      Logger.log("Casual Form player-choice rollback failed.");
    }
    throw err;
  }
  return validated;
}

function lifFindCasualListItem_(form, title) {
  const matches = form.getItems(FormApp.ItemType.LIST).filter(function(item) {
    return String(item.getTitle() || "").trim() === title;
  });
  if (matches.length !== 1) {
    throw new Error("Casual Form requires exactly one " + title + " dropdown.");
  }
  return matches[0].asListItem();
}

function lifNormalizeCasualPlayerChoices_(values) {
  const seen = {};
  const result = (values || []).reduce(function(choices, value) {
    const normalized = String(value || "").trim();
    if (!normalized || seen[normalized]) return choices;
    seen[normalized] = true;
    choices.push(normalized);
    return choices;
  }, []);
  result.sort(function(left, right) { return left.localeCompare(right); });
  if (!result.length) throw new Error("Community Player Registry has no valid players.");
  return result;
}

function lifGetCasualPlayerOptions_() {
  if (typeof buildCommunityPlayerRegistryRows !== "function") {
    throw new Error("Community Player Registry is not available.");
  }
  return lifNormalizeCasualPlayerChoices_(buildCommunityPlayerRegistryRows().map(function(player) {
    return player.displayName || player.player || "";
  }));
}

function lifGetCasualFactionOptions_() {
  return lifNormalizeCasualRegistryChoices_(getCanonicalArmyOptions(), "Canonical Army Registry");
}

function lifGetCasualMissionOptions_() {
  if (typeof getCanonicalMissions !== "function") {
    throw new Error("Canonical Missions data is not available.");
  }
  return lifNormalizeCasualRegistryChoices_(getCanonicalMissions(), "Canonical Missions data");
}

function lifNormalizeCasualRegistryChoices_(values, label) {
  const result = (values || []).map(function(value) {
    return String(value || "").trim();
  }).filter(function(value) { return value !== ""; });
  if (!result.length) throw new Error(label + " is empty.");
  return result;
}
