
const DEFAULT_TARGET_SPREADSHEET_ID = "1B1DeTfg0xVFhKXvmd6uUwfcSL-PM7Yo6ER7hzXcfvqM";

function install() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const targetSpreadsheetId = activeSpreadsheet
    ? activeSpreadsheet.getId()
    : DEFAULT_TARGET_SPREADSHEET_ID;
  return installLoboGoogleFormsSubsystem(targetSpreadsheetId);
}

function installLoboGoogleFormsSubsystem(targetSpreadsheetId) {
  if (!targetSpreadsheetId) throw new Error("targetSpreadsheetId is required.");
  const props = lifGetProperties_();
  props.setProperty(LIF_FORMS.PROPERTIES.TARGET_SPREADSHEET_ID, targetSpreadsheetId);

  const responseBook = SpreadsheetApp.create(LIF_FORMS.RESPONSE_SPREADSHEET_NAME);
  props.setProperty(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID, responseBook.getId());
  const league = createLeagueSubmissionForm(responseBook.getId());
  const team = createTeamTournamentSubmissionForm(responseBook.getId());
  const casual = createCasualSubmissionForm(responseBook.getId());
  const join = createJoinCommunityForm(responseBook.getId());
  props.setProperties({
    LIF_LEAGUE_FORM_ID: league.getId(),
    LIF_TEAM_FORM_ID: team.getId(),
    LIF_CASUAL_FORM_ID: casual.getId(),
    LIF_JOIN_FORM_ID: join.getId()
  });
  lifSetSettingValue_(
    "joinCommunityFormUrl",
    join.getPublishedUrl(),
    "Public new-player community onboarding form URL."
  );

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "handleLoboFormSubmit") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("handleLoboFormSubmit").forSpreadsheet(responseBook).onFormSubmit().create();
  lifEnsureCanonicalSheet_(SpreadsheetApp.openById(targetSpreadsheetId));
  lifEnsureImportLog_(SpreadsheetApp.openById(targetSpreadsheetId));
  return {
    version: LIF_FORMS.VERSION,
    responseSpreadsheetUrl: responseBook.getUrl(),
    leagueFormUrl: league.getPublishedUrl(),
    teamTournamentFormUrl: team.getPublishedUrl(),
    casualFormUrl: casual.getPublishedUrl(),
    joinCommunityFormUrl: join.getPublishedUrl()
  };
}

function installJoinCommunityForm() {
  const responseSpreadsheetId =
    lifRequireProperty_(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID);
  const form =
    createJoinCommunityForm(responseSpreadsheetId);

  lifGetProperties_().setProperty(
    LIF_FORMS.PROPERTIES.JOIN_FORM_ID,
    form.getId()
  );

  lifSetSettingValue_(
    "joinCommunityFormUrl",
    form.getPublishedUrl(),
    "Public new-player community onboarding form URL."
  );

  return {
    formId: form.getId(),
    formUrl: form.getPublishedUrl(),
    responseSpreadsheetId: responseSpreadsheetId
  };
}

function lifSetSettingValue_(key, value, description) {
  const sheet = ensureSettingsSheet();
  const columns = getSettingsColumns(sheet);
  const values = sheet.getDataRange().getValues();

  for (let index = 1; index < values.length; index++) {
    if (String(values[index][columns.key] || "").trim() !== key)
      continue;
    sheet.getRange(index + 1, columns.value + 1).setValue(value);
    return;
  }

  const row = Array(Math.max(sheet.getLastColumn(), 3)).fill("");
  row[columns.key] = key;
  row[columns.value] = value;
  row[columns.description] = description;
  sheet.appendRow(row);
}

function uninstallLoboGoogleFormsTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "handleLoboFormSubmit") ScriptApp.deleteTrigger(trigger);
  });
}

function getLoboGoogleFormsInstallation() {
  const props = lifGetProperties_();
  function formUrl(key) {
    const id = props.getProperty(key);
    return id ? FormApp.openById(id).getPublishedUrl() : "";
  }
  return {
    targetSpreadsheetId: props.getProperty(LIF_FORMS.PROPERTIES.TARGET_SPREADSHEET_ID) || "",
    responseSpreadsheetId: props.getProperty(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID) || "",
    leagueFormUrl: formUrl(LIF_FORMS.PROPERTIES.LEAGUE_FORM_ID),
    teamTournamentFormUrl: formUrl(LIF_FORMS.PROPERTIES.TEAM_FORM_ID),
    casualFormUrl: formUrl(LIF_FORMS.PROPERTIES.CASUAL_FORM_ID),
    joinCommunityFormUrl: formUrl(LIF_FORMS.PROPERTIES.JOIN_FORM_ID)
  };
}
