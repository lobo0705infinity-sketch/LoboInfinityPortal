const TOP40_FORM_EVENT_ID = "event-lobo-s-american-top-40";

function createOrUpdateTop40GameSubmissionForm() {
  const props = lifGetProperties_();
  const existingId = String(props.getProperty(LIF_FORMS.PROPERTIES.TOP40_FORM_ID) || "").trim();
  const form = existingId ? FormApp.openById(existingId) : FormApp.create(LIF_FORMS.FORM_TITLES.TOP40);
  if (!existingId) {
    configureTop40Form_(form);
    addTop40FormFields_(form, getTop40RegisteredPlayerChoices_(), getCanonicalMissions(), getCanonicalArmyOptions());
    form.setDestination(FormApp.DestinationType.SPREADSHEET, lifRequireProperty_(LIF_FORMS.PROPERTIES.RESPONSE_SPREADSHEET_ID));
    props.setProperty(LIF_FORMS.PROPERTIES.TOP40_FORM_ID, form.getId());
  }
  refreshTop40GameSubmissionForm();
  lifSetSettingValue_("top40GameSubmissionFormUrl", form.getPublishedUrl(), "Dedicated Top 40 game submission form URL.");
  return inspectTop40GameSubmissionForm();
}

function configureTop40Form_(form) {
  form.setTitle(LIF_FORMS.FORM_TITLES.TOP40).setDescription("Submit a completed Lobo's American Top 40 bracket game.")
    .setCollectEmail(false).setConfirmationMessage("Your result was received and will be imported after validation.")
    .setShowLinkToRespondAgain(false).setProgressBar(false);
}

function top40FormSchema_() {
  const f=LIF_FORMS.FIELDS;
  return [
    [f.PLAYER,"players",true],[f.OPPONENT,"players",true],[f.MISSION,"missions",true],[f.PLAYER_FACTION,"factions",true],
    [f.PLAYER_ARMY_CODE,"text",true],[f.OPPONENT_FACTION,"factions",true],[f.OPPONENT_ARMY_CODE,"text",true],
    [f.GAME_RESULT,["Player Victory","Opponent Victory"],true],[f.FIRST_TURN,["Player","Opponent"],true],
    [f.PLAYER_TP,"score",true],[f.OPPONENT_TP,"score",true],[f.PLAYER_OP,"score",true],[f.OPPONENT_OP,"score",true],
    [f.PLAYER_VP,"score",true],[f.OPPONENT_VP,"score",true],[f.BEST_MOMENT,"paragraph",false],[f.NOTES,"paragraph",false]
  ];
}

function addTop40FormFields_(form, players, missions, factions) {
  const unavailable = players.length ? players : ["Registration currently has no registered players"];
  top40FormSchema_().forEach(function(spec) {
    const source=spec[1]; let item;
    if (source === "text" || source === "score") {
      item=form.addTextItem().setTitle(spec[0]).setRequired(spec[2]);
      if(source === "score") item.setValidation(FormApp.createTextValidation().requireWholeNumber().build());
    } else if (source === "paragraph") item=form.addParagraphTextItem().setTitle(spec[0]).setRequired(spec[2]);
    else item=form.addListItem().setTitle(spec[0]).setChoiceValues(source === "players" ? unavailable : source === "missions" ? missions : source === "factions" ? factions : source).setRequired(spec[2]);
  });
  form.setAcceptingResponses(players.length > 0);
}

function refreshTop40GameSubmissionForm() {
  const form=FormApp.openById(lifRequireProperty_(LIF_FORMS.PROPERTIES.TOP40_FORM_ID));
  const players=getTop40RegisteredPlayerChoices_();
  const values=players.length ? players : ["Registration currently has no registered players"];
  [LIF_FORMS.FIELDS.PLAYER,LIF_FORMS.FIELDS.OPPONENT].forEach(function(title){
    const items=form.getItems(FormApp.ItemType.LIST).filter(function(item){return item.getTitle()===title;});
    if(items.length!==1) throw new Error("Top 40 Form requires exactly one " + title + " dropdown.");
    items[0].asListItem().setChoiceValues(values).setRequired(true);
  });
  form.setAcceptingResponses(players.length > 0);
  return inspectTop40GameSubmissionForm();
}

function getTop40RegisteredPlayerChoices_() {
  const seen={};
  return getEventRegistrationRows(TOP40_FORM_EVENT_ID).filter(function(row){return String(row.status||row["Status"]||"").trim().toLowerCase()==="registered";})
    .map(function(row){return String(row.player||row["Player"]||"").trim();}).filter(function(player){if(!player||seen[player])return false;seen[player]=true;return true;})
    .sort(function(a,b){return a.localeCompare(b);});
}

function importTop40FormSubmission_(named, timestamp, responseKey, log, target, responseRow) {
  if (lifWasImported_(log,responseKey)) return;
  const submission=lifReadSubmission_(named,LIF_FORMS.TYPES.TOP40,timestamp,target);
  submission.eventId=TOP40_FORM_EVENT_ID; submission.division="Top 40";
  const registered=getTop40RegisteredPlayerChoices_();
  if(registered.indexOf(submission.player)<0) throwTop40FormRejection_(log,responseKey,responseRow,"Player is not currently Registered for Top 40.");
  if(registered.indexOf(submission.opponent)<0) throwTop40FormRejection_(log,responseKey,responseRow,"Opponent is not currently Registered for Top 40.");
  if(submission.player===submission.opponent) throwTop40FormRejection_(log,responseKey,responseRow,"Player and Opponent must be different.");
  const matches=readEventBracketMatches_(TOP40_FORM_EVENT_ID).filter(function(match){return match.status==="Active"&&((match.playerA===submission.player&&match.playerB===submission.opponent)||(match.playerA===submission.opponent&&match.playerB===submission.player));});
  if(matches.length!==1) throwTop40FormRejection_(log,responseKey,responseRow,"These players do not have an Active Top 40 match against each other.");
  const canonicalMission=getEventBracketMission_(TOP40_FORM_EVENT_ID,matches[0].bracket,matches[0].bracketRound);
  if(submission.mission!==canonicalMission) throwTop40FormRejection_(log,responseKey,responseRow,"The submitted mission does not match the mission assigned to this Top 40 match.");
  const params={eventId:TOP40_FORM_EVENT_ID,matchId:matches[0].matchId,player:submission.player,opponent:submission.opponent,mission:submission.mission,winner:submission.gameResult,firstTurn:submission.firstTurn,playerFaction:submission.playerFaction,opponentFaction:submission.opponentFaction,player1ArmyCode:submission.playerArmyCode,player2ArmyCode:submission.opponentArmyCode,playerTournamentPoints:submission.playerTp,opponentTournamentPoints:submission.opponentTp,playerObjectivePoints:submission.playerOp,opponentObjectivePoints:submission.opponentOp,playerVictoryPoints:submission.playerVp,opponentVictoryPoints:submission.opponentVp,bestMoment:submission.bestMoment,notes:submission.notes};
  const result=submitTop40ResultService_(params,{},{parameter:{}});
  lifWriteImportLog_(log,responseKey,LIF_FORMS.TYPES.TOP40,responseRow,"Imported","Game ID " + result.gameId + "; Match ID " + result.matchId);
  return result;
}

function throwTop40FormRejection_(log,key,row,message){lifWriteImportLog_(log,key,LIF_FORMS.TYPES.TOP40,row,"Rejected",message);throw new Error(message);}

function inspectTop40GameSubmissionForm(){const form=FormApp.openById(lifRequireProperty_(LIF_FORMS.PROPERTIES.TOP40_FORM_ID));return {formId:form.getId(),formUrl:form.getPublishedUrl(),title:form.getTitle(),collectEmail:form.collectsEmail(),acceptingResponses:form.isAcceptingResponses(),destinationId:form.getDestinationId(),responses:form.getResponses().length,items:form.getItems().map(function(item){return {title:item.getTitle(),type:String(item.getType())};})};}
