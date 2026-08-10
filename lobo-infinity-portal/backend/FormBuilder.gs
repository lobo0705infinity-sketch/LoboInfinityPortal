
function lifCreateBaseForm_(title, description) {
  const form = FormApp.create(title);
  form.setDescription(description)
    .setCollectEmail(true)
    .setConfirmationMessage("Your result was received and will be imported after validation.")
    .setProgressBar(true)
    .setShowLinkToRespondAgain(false);
  return form;
}

function lifAddText_(form, title, required, helpText) {
  const item = form.addTextItem().setTitle(title).setRequired(required !== false);
  if (helpText) item.setHelpText(helpText);
  return item;
}

function lifAddParagraph_(form, title, required) {
  return form.addParagraphTextItem().setTitle(title).setRequired(required === true);
}

function lifAddScore_(form, title) {
  const item = lifAddText_(form, title, true, "Enter a non-negative whole number.");
  item.setValidation(FormApp.createTextValidation().requireWholeNumber().build());
  return item;
}

function lifAddChoice_(form, title, choices, required) {
  return form.addListItem().setTitle(title).setChoiceValues(choices).setRequired(required !== false);
}

function lifAddCommonGameFields_(form, options) {
  const f = LIF_FORMS.FIELDS;
  form.addSectionHeaderItem().setTitle("Player Information");
  lifAddText_(form, f.PLAYER, true);
  lifAddText_(form, f.PLAYER_FACTION, true);
  lifAddText_(form, f.PLAYER_ARMY_CODE, true, "Paste the complete Infinity Army code.");
  lifAddText_(form, f.OPPONENT, true);
  lifAddText_(form, f.OPPONENT_FACTION, true);
  lifAddText_(form, f.OPPONENT_ARMY_CODE, true, "Paste the complete Infinity Army code.");

  form.addSectionHeaderItem().setTitle("Result");
  lifAddText_(form, f.MISSION, true);
  lifAddChoice_(form, f.GAME_RESULT, ["Player Victory", "Opponent Victory", "Draw"], true);
  lifAddChoice_(form, f.FIRST_TURN, ["Player", "Opponent"], true);

  form.addSectionHeaderItem().setTitle("Scores");
  lifAddScore_(form, f.PLAYER_TP); lifAddScore_(form, f.OPPONENT_TP);
  lifAddScore_(form, f.PLAYER_OP); lifAddScore_(form, f.OPPONENT_OP);
  lifAddScore_(form, f.PLAYER_VP); lifAddScore_(form, f.OPPONENT_VP);

  form.addSectionHeaderItem().setTitle("Game Details");
  lifAddParagraph_(form, f.BEST_MOMENT, true);
  lifAddParagraph_(form, f.NOTES, false);
  if (options && options.afterCommon) options.afterCommon(form);
  return form;
}

function lifLinkForm_(form, spreadsheetId) {
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);
  return form;
}
