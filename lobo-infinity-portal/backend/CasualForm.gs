
function createCasualSubmissionForm(responseSpreadsheetId, requireExisting) {
  const players = lifGetCasualPlayerOptions_();
  const missions = lifGetCasualMissionOptions_();
  const factions = getCanonicalArmyOptions();
  const form = lifGetCasualFormForGeneration_(requireExisting === true);
  lifAddCasualGameFields_(form, players, missions, factions);
  return lifLinkForm_(form, responseSpreadsheetId);
}

function refreshCasualSubmissionForm() {
  const responseSpreadsheetId = lifRequireProperty_(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID);
  const form = createCasualSubmissionForm(responseSpreadsheetId, true);
  lifGetProperties_().setProperty(LIF_FORMS.PROPERTIES.CASUAL_FORM_ID, form.getId());
  return form.getPublishedUrl();
}

function lifGetCasualFormForGeneration_(requireExisting) {
  const existingId = String(lifGetProperties_().getProperty(LIF_FORMS.PROPERTIES.CASUAL_FORM_ID) || "").trim();
  if (requireExisting && !existingId) {
    throw new Error("Missing required script property: " + LIF_FORMS.PROPERTIES.CASUAL_FORM_ID);
  }
  const form = existingId ? FormApp.openById(existingId) : FormApp.create(LIF_FORMS.FORM_TITLES.CASUAL);
  form.getItems().slice().reverse().forEach(function(item) { form.deleteItem(item); });
  form.setTitle(LIF_FORMS.FORM_TITLES.CASUAL)
    .setDescription("Submit a completed casual Infinity game for portal lifetime analytics.")
    .setCollectEmail(true)
    .setConfirmationMessage("Your result was received and will be imported after validation.")
    .setProgressBar(true)
    .setShowLinkToRespondAgain(false);
  return form;
}

function lifAddCasualGameFields_(form, players, missions, factions) {
  const f = LIF_FORMS.FIELDS;
  form.addSectionHeaderItem().setTitle("Player Information");
  lifAddChoice_(form, f.PLAYER, players, true);
  lifAddChoice_(form, f.PLAYER_FACTION, factions, true);
  lifAddText_(form, f.PLAYER_ARMY_CODE, true, "Paste the complete Infinity Army code.");
  lifAddChoice_(form, f.OPPONENT, players, true);
  lifAddChoice_(form, f.OPPONENT_FACTION, factions, true);
  lifAddText_(form, f.OPPONENT_ARMY_CODE, true, "Paste the complete Infinity Army code.");

  form.addSectionHeaderItem().setTitle("Result");
  lifAddChoice_(form, f.MISSION, missions, true);
  lifAddChoice_(form, f.GAME_RESULT, ["Player Victory", "Opponent Victory", "Draw"], true);
  lifAddChoice_(form, f.FIRST_TURN, ["Player", "Opponent"], true);

  form.addSectionHeaderItem().setTitle("Scores");
  lifAddScore_(form, f.PLAYER_TP); lifAddScore_(form, f.OPPONENT_TP);
  lifAddScore_(form, f.PLAYER_OP); lifAddScore_(form, f.OPPONENT_OP);
  lifAddScore_(form, f.PLAYER_VP); lifAddScore_(form, f.OPPONENT_VP);

  form.addSectionHeaderItem().setTitle("Game Details");
  lifAddParagraph_(form, f.BEST_MOMENT, false);
  lifAddParagraph_(form, f.NOTES, false);
  return form;
}

function lifGetCasualPlayerOptions_() {
  if (typeof buildCommunityPlayerRegistryRows !== "function") {
    throw new Error("Community Player Registry is not available.");
  }
  const players = buildCommunityPlayerRegistryRows()
    .map(function(player) {
      return String(player.displayName || player.player || "").trim();
    })
    .filter(function(player) { return player !== ""; });
  players.sort(function(left, right) { return left.localeCompare(right); });
  if (!players.length) throw new Error("Community Player Registry has no players.");
  return players;
}

function lifGetCasualMissionOptions_() {
  if (typeof getCanonicalMissions !== "function") {
    throw new Error("Canonical Missions data is not available.");
  }
  const missions = getCanonicalMissions()
    .map(function(value) { return String(value || "").trim(); })
    .filter(function(value) { return value !== ""; });
  if (!missions.length) throw new Error("Canonical Missions data is empty.");
  return missions;
}
