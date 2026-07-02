/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * Api.gs
 *******************************************************/
function doGet(e){
  const action=(e&&e.parameter&&e.parameter.action)?e.parameter.action:"";
  switch(action){
    case "leader": return getLeader();
    case "dashboard": return getDashboard();
    default: return jsonOutput({success:false,error:"Unknown API action."});
  }
}
function getDashboard(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const standings=ss.getSheetByName("Main Man Standings");
  const factions=ss.getSheetByName("Faction Analytics");
  if(!standings){return jsonOutput({success:false,error:"Main Man Standings not found."});}
  const leader=standings.getRange(2,1,1,8).getValues()[0];
  const values=standings.getRange(2,1,standings.getLastRow()-1,8).getValues();
  let gamesPlayed=0,activePlayers=0;
  const mainManStandings=[];
  values.forEach(function(r){
    gamesPlayed+=Number(r[2]);
    if(Number(r[2])>0) activePlayers++;
    mainManStandings.push({rank:r[0],player:r[1],games:r[2],wins:r[3],losses:r[4],tp:r[5],op:r[6],vp:r[7]});
  });
  gamesPlayed=Math.floor(gamesPlayed/2);
  let topFaction="";
  if(factions&&factions.getLastRow()>1){
    const f=factions.getRange(2,1,factions.getLastRow()-1,factions.getLastColumn()).getValues();
    if(f.length) topFaction=f[0][0];
  }
  return jsonOutput({
    success:true,
    leader:{rank:leader[0],player:leader[1],games:leader[2],wins:leader[3],losses:leader[4],tp:leader[5],op:leader[6],vp:leader[7]},
    topFaction:topFaction,
    gamesPlayed:gamesPlayed,
    activePlayers:activePlayers,
    mainManStandings:mainManStandings
  });
}
function getLeader(){
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Main Man Standings");
  if(!sheet)return jsonOutput({success:false,error:"Standings sheet not found."});
  const values=sheet.getDataRange().getValues();
  if(values.length<2)return jsonOutput({success:false,error:"No standings."});
  const l=values[1];
  return jsonOutput({success:true,rank:l[0],player:l[1],games:l[2],wins:l[3],losses:l[4],tp:l[5],op:l[6],vp:l[7]});
}
function jsonOutput(data){
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
