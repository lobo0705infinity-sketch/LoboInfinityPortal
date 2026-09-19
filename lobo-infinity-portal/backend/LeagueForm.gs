
function createLeagueSubmissionForm(responseSpreadsheetId) {
  const f = LIF_FORMS.FIELDS;
  const players = lifGetLeaguePlayerOptions_();
  const missions = lifGetLeagueMissionOptions_();
  const factions = getCanonicalArmyOptions();
  const form = lifGetLeagueFormForGeneration_();
  lifAddLeagueGameFields_(form, players, missions, factions);
  return lifLinkForm_(form, responseSpreadsheetId);
}

function refreshLeagueSubmissionForm() {
  const responseSpreadsheetId = lifRequireProperty_(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID);
  const form = createLeagueSubmissionForm(responseSpreadsheetId);
  lifGetProperties_().setProperty(LIF_FORMS.PROPERTIES.LEAGUE_FORM_ID, form.getId());
  return form.getPublishedUrl();
}

function synchronizeLeagueSubmissionFormMissionChoices() {
  return synchronizeGameSubmissionFormMissionChoices_(
    LIF_FORMS.PROPERTIES.LEAGUE_FORM_ID,
    "League submission form",
    lifGetLeagueMissionOptions_()
  );
}

function synchronizeAllGameSubmissionFormMissionChoices() {
  const missions = lifGetLeagueMissionOptions_();

  return {
    league: synchronizeGameSubmissionFormMissionChoices_(
      LIF_FORMS.PROPERTIES.LEAGUE_FORM_ID,
      "League submission form",
      missions
    ),
    teamTournament: synchronizeGameSubmissionFormMissionChoices_(
      LIF_FORMS.PROPERTIES.TEAM_FORM_ID,
      "Team Tournament submission form",
      missions
    ),
    casual: synchronizeGameSubmissionFormMissionChoices_(
      LIF_FORMS.PROPERTIES.CASUAL_FORM_ID,
      "Casual submission form",
      missions
    )
  };
}

function synchronizeGameSubmissionFormMissionChoices_(formProperty, formLabel, missions) {
  const formId = lifRequireProperty_(formProperty);
  const form = FormApp.openById(formId);
  const missionItems = form.getItems(FormApp.ItemType.LIST).filter(function(item) {
    return String(item.getTitle() || "").trim() === LIF_FORMS.FIELDS.MISSION;
  });

  if (missionItems.length !== 1) {
    throw new Error(
      formLabel + " requires exactly one Mission dropdown; found " + missionItems.length + "."
    );
  }

  const missionItem = missionItems[0].asListItem();
  const required = missionItem.isRequired();
  missionItem.setChoiceValues(missions).setRequired(required);

  return {
    formId: formId,
    missionChoices: missions,
    required: required
  };
}

function lifGetLeagueFormForGeneration_() {
  const existingId = String(lifGetProperties_().getProperty(LIF_FORMS.PROPERTIES.LEAGUE_FORM_ID) || "").trim();
  const form = existingId ? FormApp.openById(existingId) : FormApp.create(LIF_FORMS.FORM_TITLES.LEAGUE);
  form.getItems().slice().reverse().forEach(function(item) { form.deleteItem(item); });
  form.setTitle(LIF_FORMS.FORM_TITLES.LEAGUE)
    .setDescription("Submit a completed Lobo Infinity League game. All fields are validated before import.")
    .setCollectEmail(true)
    .setConfirmationMessage("Your result was received and will be imported after validation.")
    .setProgressBar(true)
    .setShowLinkToRespondAgain(false);
  return form;
}

function lifAddLeagueGameFields_(form, players, missions, factions) {
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

function getCanonicalArmyOptions() {
  if (typeof ARMY_REGISTRY_PARENT_MAP === "undefined") {
    throw new Error("Canonical Army registry is not available.");
  }
  return Object.keys(ARMY_REGISTRY_PARENT_MAP).sort(function(left, right) {
    return left.localeCompare(right);
  });
}

function lifGetLeaguePlayerOptions_() {
  const spreadsheet = SpreadsheetApp.openById(
    lifRequireProperty_(LIF_FORMS.PROPERTIES.TARGET_SPREADSHEET_ID)
  );
  const sheet = spreadsheet.getSheetByName("Players");
  if (!sheet) throw new Error("Players sheet not found.");
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error("Players sheet has no player rows.");
  const headers = values[0].map(function(value) { return String(value || "").trim(); });
  const playerIndex = headers.indexOf("Player");
  const activeIndex = headers.indexOf("Active");
  if (playerIndex < 0) throw new Error("Players sheet is missing the Player column.");
  const seen = {};
  const players = values.slice(1).reduce(function(result, row) {
    const player = String(row[playerIndex] || "").trim();
    const active = activeIndex < 0 ? "" : String(row[activeIndex] || "").trim().toLowerCase();
    if (!player || active === "false" || active === "inactive" || active === "no") return result;
    const key = player.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      result.push(player);
    }
    return result;
  }, []);
  players.sort(function(left, right) { return left.localeCompare(right); });
  if (!players.length) throw new Error("Players sheet has no active players.");
  return players;
}

function lifGetLeagueMissionOptions_() {
  if (typeof getCanonicalMissions !== "function") {
    throw new Error("Canonical Missions data is not available.");
  }
  const missions = getCanonicalMissions()
    .map(function(value) { return String(value || "").trim(); })
    .filter(function(value) { return value !== ""; });
  if (!missions.length) throw new Error("Canonical Missions data is empty.");
  return missions;
}
