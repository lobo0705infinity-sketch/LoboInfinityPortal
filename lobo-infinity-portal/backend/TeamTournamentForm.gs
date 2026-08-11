
function createTeamTournamentSubmissionForm(responseSpreadsheetId) {
  const tournamentOptions = lifGetTeamTournamentFormOptions_();
  const missions = lifGetLeagueMissionOptions_();
  const factions = getCanonicalArmyOptions();
  const form = lifGetTeamTournamentFormForGeneration_();
  lifAddTeamTournamentFields_(form, tournamentOptions.teams);
  lifAddLeagueGameFields_(form, tournamentOptions.players, missions, factions);
  return lifLinkForm_(form, responseSpreadsheetId);
}

function refreshTeamTournamentSubmissionForm() {
  const responseSpreadsheetId = lifRequireProperty_(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID);
  const form = createTeamTournamentSubmissionForm(responseSpreadsheetId);
  lifGetProperties_().setProperty(LIF_FORMS.PROPERTIES.TEAM_FORM_ID, form.getId());
  return form.getPublishedUrl();
}

function lifGetTeamTournamentFormForGeneration_() {
  const existingId = String(lifGetProperties_().getProperty(LIF_FORMS.PROPERTIES.TEAM_FORM_ID) || "").trim();
  const form = existingId ? FormApp.openById(existingId) : FormApp.create(LIF_FORMS.FORM_TITLES.TEAM);
  form.getItems().slice().reverse().forEach(function(item) { form.deleteItem(item); });
  form.setTitle(LIF_FORMS.FORM_TITLES.TEAM)
    .setDescription("Submit an individual table result for a Lobo Infinity Team Tournament.")
    .setCollectEmail(true)
    .setConfirmationMessage("Your result was received and will be imported after validation.")
    .setProgressBar(true)
    .setShowLinkToRespondAgain(false);
  return form;
}

function lifAddTeamTournamentFields_(form, teams) {
  const f = LIF_FORMS.FIELDS;
  form.addSectionHeaderItem().setTitle("Tournament Match Information");
  lifAddText_(form, f.ROUND, true);
  lifAddChoice_(form, "Your Team", teams, true);
  lifAddChoice_(form, f.OPPONENT_TEAM, teams, true);
  return form;
}

function lifGetTeamTournamentFormOptions_() {
  const spreadsheet = SpreadsheetApp.openById(
    lifRequireProperty_(LIF_FORMS.PROPERTIES.TARGET_SPREADSHEET_ID)
  );
  const eventId = lifResolveActiveTeamTournamentEventId_(spreadsheet);
  const tournamentTeams = lifReadSheetObjects_(spreadsheet, "Team Tournament Teams")
    .filter(function(team) {
      return String(team["Event ID"] || "").trim() === eventId && lifLeagueRowIsActive_(team);
    });
  if (typeof parseTeamTournamentRoster !== "function") {
    throw new Error("Canonical Team Tournament roster data is not available.");
  }
  const seenPlayers = {};
  const players = tournamentTeams.reduce(function(result, team) {
    [team["Captain"]].concat(parseTeamTournamentRoster(team["Players"]))
      .forEach(function(value) {
        const player = String(value || "").trim();
        const key = lifNormalize_(player);
        if (player && !seenPlayers[key]) {
          seenPlayers[key] = true;
          result.push(player);
        }
      });
    return result;
  }, []);
  players.sort(function(left, right) { return left.localeCompare(right); });
  if (!players.length) throw new Error("The active Team Tournament has no registered players.");

  const seenTeams = {};
  const teams = tournamentTeams.reduce(function(result, team) {
    const name = String(team["Team Name"] || "").trim();
    const key = lifNormalize_(name);
    if (name && !seenTeams[key]) {
      seenTeams[key] = true;
      result.push(name);
    }
    return result;
  }, []);
  teams.sort(function(left, right) { return left.localeCompare(right); });
  if (!teams.length) throw new Error("The active Team Tournament has no registered teams.");

  return { eventId: eventId, players: players, teams: teams };
}
