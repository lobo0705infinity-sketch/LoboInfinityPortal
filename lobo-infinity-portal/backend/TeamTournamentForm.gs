
function createTeamTournamentSubmissionForm(responseSpreadsheetId) {
  const tournamentOptions = lifGetTeamTournamentFormOptions_();
  const missions = lifGetTeamTournamentMissionOptions_();
  const factions = getCanonicalArmyOptions();
  const form = lifGetTeamTournamentFormForGeneration_();
  lifAddTeamTournamentGameFields_(
    form,
    tournamentOptions.players,
    tournamentOptions.teams,
    missions,
    factions
  );
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

function lifAddTeamTournamentGameFields_(form, players, teams, missions, factions) {
  const f = LIF_FORMS.FIELDS;
  form.addSectionHeaderItem().setTitle("Tournament Match Information");
  lifAddText_(form, f.ROUND, true);
  lifAddChoice_(form, "Your Team", teams, true);
  lifAddChoice_(form, f.OPPONENT_TEAM, teams, true);

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
  lifAddParagraph_(form, f.BEST_MOMENT, true);
  lifAddParagraph_(form, f.NOTES, false);
  return form;
}

function lifGetTeamTournamentFormOptions_() {
  const spreadsheet = SpreadsheetApp.openById(
    lifRequireProperty_(LIF_FORMS.PROPERTIES.TARGET_SPREADSHEET_ID)
  );
  const eventId = lifResolveActiveTeamTournamentEventId_(spreadsheet);
  const registrations = lifGetActiveTeamTournamentRegistrations_(spreadsheet, eventId);
  const seenPlayers = {};
  const players = registrations.reduce(function(result, registration) {
    const player = String(registration["Player"] || registration["Display Name"] || "").trim();
    const key = lifNormalize_(player);
    if (player && !seenPlayers[key]) {
      seenPlayers[key] = true;
      result.push(player);
    }
    return result;
  }, []);
  players.sort(function(left, right) { return left.localeCompare(right); });
  if (!players.length) throw new Error("The active Team Tournament has no registered players.");

  const seenTeams = {};
  const teams = lifReadSheetObjects_(spreadsheet, "Team Tournament Teams")
    .filter(function(team) {
      return String(team["Event ID"] || "").trim() === eventId && lifLeagueRowIsActive_(team);
    })
    .reduce(function(result, team) {
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

function lifGetTeamTournamentMissionOptions_() {
  if (typeof getCanonicalMissions !== "function") {
    throw new Error("Canonical Missions data is not available.");
  }
  const missions = getCanonicalMissions()
    .map(function(value) { return String(value || "").trim(); })
    .filter(function(value) { return value !== ""; });
  missions.sort(function(left, right) { return left.localeCompare(right); });
  if (!missions.length) throw new Error("Canonical Missions data is empty.");
  return missions;
}
