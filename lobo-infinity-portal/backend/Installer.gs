
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
  props.setProperties({
    LIF_LEAGUE_FORM_ID: league.getId(),
    LIF_TEAM_FORM_ID: team.getId(),
    LIF_CASUAL_FORM_ID: casual.getId()
  });

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
    casualFormUrl: casual.getPublishedUrl()
  };
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
    casualFormUrl: formUrl(LIF_FORMS.PROPERTIES.CASUAL_FORM_ID)
  };
}
