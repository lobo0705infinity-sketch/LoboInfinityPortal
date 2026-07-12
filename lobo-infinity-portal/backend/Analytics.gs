/*******************************************************
 *
 * LOBO INFINITY LEAGUE
 * Analytics Library v2.0
 *
 * PART 1
 * Core Helper Functions
 *
 *******************************************************/

const ENGINE_SHEET = "Game Engine";

// Game Engine Columns
const COL_DIVISION    = 0;
const COL_DATE        = 1;
const COL_MISSION     = 2;
const COL_PLAYER      = 3;
const COL_OPPONENT    = 4;
const COL_RESULT      = 5;
const COL_TP          = 6;
const COL_OP          = 7;
const COL_VP          = 8;
const COL_FACTION     = 9;
const COL_FIRSTTURN   = 10;


/*******************************************************
 *
 * Returns every row from the Game Engine.
 *
 *******************************************************/
function ENGINE() {

  return getLeagueData();

}


/*******************************************************
 *
 * Returns every game for one player.
 *
 *******************************************************/
function PLAYERGAMES(player){

  if(!player) return [];

  const data = ENGINE();

  const games = [];

  for(let i=1;i<data.length;i++){

    if(data[i][COL_PLAYER]===player){

      games.push(data[i]);

    }

  }

  return games;

}


/*******************************************************
 *
 * Counts occurrences.
 *
 *******************************************************/
function COUNTOBJECT(values){

  const counts = {};

  values.forEach(function(v){

    if(v==="") return;

    counts[v]=(counts[v]||0)+1;

  });

  return counts;

}


/*******************************************************
 *
 * Returns most common value.
 *
 *******************************************************/
function MOSTCOMMON(values){

  const counts = COUNTOBJECT(values);

  let best="";
  let amount=0;

  for(const key in counts){

    if(counts[key]>amount){

      amount=counts[key];
      best=key;

    }

  }

  return {
    value:best,
    count:amount
  };

}

function getMissionProfileString(value) {

  if (value === null || value === undefined)
    return "";

  return String(value).trim();

}

function getMissionProfileTime(value, fallback) {

  if (value instanceof Date)
    return value.getTime();

  if (typeof value === "number" && isFinite(value))
    return value;

  const text =
    getMissionProfileString(value);

  if (text) {

    const parsed =
      Date.parse(text);

    if (!isNaN(parsed))
      return parsed;

  }

  return fallback || 0;

}

function buildMissionProfileSummary(items, readMission, readWin, readDate) {

  const missions = {};

  (items || []).forEach(function(item, index) {

    const mission =
      getMissionProfileString(readMission(item));

    if (!mission)
      return;

    if (!missions[mission])
      missions[mission] = {
        mission: mission,
        games: 0,
        wins: 0,
        losses: 0,
        lastPlayedValue: 0
      };

    const record =
      missions[mission];

    record.games += 1;

    if (readWin(item))
      record.wins += 1;
    else
      record.losses += 1;

    record.lastPlayedValue =
      Math.max(
        record.lastPlayedValue,
        getMissionProfileTime(readDate(item), index + 1)
      );

  });

  const rows =
    Object.keys(missions)
      .map(function(mission) {
        const record =
          missions[mission];

        record.winRate =
          record.games === 0
            ? 0
            : record.wins / record.games;

        return record;
      });

  const favorite =
    rows
      .slice()
      .sort(function(a, b) {
        if (b.games !== a.games)
          return b.games - a.games;
        if (b.wins !== a.wins)
          return b.wins - a.wins;
        if (b.lastPlayedValue !== a.lastPlayedValue)
          return b.lastPlayedValue - a.lastPlayedValue;
        return a.mission.localeCompare(b.mission);
      })[0] || null;

  const best =
    rows
      .filter(function(record) {
        return record.games >= 3;
      })
      .sort(function(a, b) {
        if (b.winRate !== a.winRate)
          return b.winRate - a.winRate;
        if (b.wins !== a.wins)
          return b.wins - a.wins;
        if (b.lastPlayedValue !== a.lastPlayedValue)
          return b.lastPlayedValue - a.lastPlayedValue;
        if (b.games !== a.games)
          return b.games - a.games;
        return a.mission.localeCompare(b.mission);
      })[0] || null;

  return {
    favoriteMission: favorite ? favorite.mission : "",
    bestMission: best ? best.mission : "",
    missions: rows
      .sort(function(a, b) {
        return a.mission.localeCompare(b.mission);
      })
  };

}

function getPlayerMissionProfile(player) {

  return buildMissionProfileSummary(
    PLAYERGAMES(player),
    function(game) {
      return game[COL_MISSION];
    },
    function(game) {
      return game[COL_RESULT] === "W";
    },
    function(game) {
      return game[COL_DATE];
    }
  );

}


/*******************************************************
 *
 * Calculates record.
 *
 *******************************************************/
function RECORD(games){

  let wins=0;
  let losses=0;
  let draws=0;

  games.forEach(function(g){

    switch(g[COL_RESULT]){

      case "W":
        wins++;
        break;

      case "L":
        losses++;
        break;

      default:
        draws++;
        break;

    }

  });

  return{

    wins:wins,
    losses:losses,
    draws:draws,
    games:games.length,

    pct:
      games.length===0
      ?0
      :wins/games.length

  };

}


/*******************************************************
 *
 * Returns all factions played.
 *
 *******************************************************/
function PLAYERFACTIONS(player){

  const games=PLAYERGAMES(player);

  return games.map(function(g){

    return g[COL_FACTION];

  });

}


/*******************************************************
 *
 * Returns all missions played.
 *
 *******************************************************/
function PLAYERMISSIONS(player){

  const games=PLAYERGAMES(player);

  return games.map(function(g){

    return g[COL_MISSION];

  });

}


/*******************************************************
 *
 * Returns all opponents.
 *
 *******************************************************/
function PLAYEROPPONENTS(player){

  const games=PLAYERGAMES(player);

  return games.map(function(g){

    return g[COL_OPPONENT];

  });

}


/*******************************************************
 *
 * Returns first-turn games.
 *
 *******************************************************/
function FIRSTTURNGAMES(player){

  return PLAYERGAMES(player)

    .filter(function(g){

      return g[COL_FIRSTTURN]=="Yes";

    });

}


/*******************************************************
 *
 * Returns second-turn games.
 *
 *******************************************************/
function SECONDTURNGAMES(player){

  return PLAYERGAMES(player)

    .filter(function(g){

      return g[COL_FIRSTTURN]=="No";

    });

}


/*******************************************************
 *
 * Returns TP average.
 *
 *******************************************************/
function AVGTP(games){

  if(games.length===0) return 0;

  let total=0;

  games.forEach(function(g){

    total+=Number(g[COL_TP]);

  });

  return total/games.length;

}


/*******************************************************
 *
 * Returns OP average.
 *
 *******************************************************/
function AVGOP(games){

  if(games.length===0) return 0;

  let total=0;

  games.forEach(function(g){

    total+=Number(g[COL_OP]);

  });

  return total/games.length;

}


/*******************************************************
 *
 * Returns VP average.
 *
 *******************************************************/
function AVGVP(games){

  if(games.length===0) return 0;

  let total=0;

  games.forEach(function(g){

    total+=Number(g[COL_VP]);

  });

  return total/games.length;

}
/*******************************************************
 *
 * LOBO INFINITY LEAGUE
 * Analytics Library v2.0
 *
 * PART 2
 * Player Analytics Functions
 *
 *******************************************************/


/*******************************************************
 *
 * FAVORITE FACTION
 *
 * Usage:
 * =FAVORITEFACTION(A2)
 *
 *******************************************************/
function FAVORITEFACTION(player){

  if(!player) return "";

  const result = MOSTCOMMON(PLAYERFACTIONS(player));

  if(result.count===0) return "";

  return result.value + " (" + result.count + " games)";

}


/*******************************************************
 *
 * FAVORITE MISSION
 *
 * Usage:
 * =FAVORITEMISSION(A2)
 *
 *******************************************************/
function FAVORITEMISSION(player){

  if(!player) return "";

  return getPlayerMissionProfile(player).favoriteMission;

}

function PLAYERBESTMISSION(player){

  if(!player) return "";

  return getPlayerMissionProfile(player).bestMission;

}


/*******************************************************
 *
 * RIVAL
 *
 * Usage:
 * =RIVAL(A2)
 *
 *******************************************************/
function RIVAL(player){

  if(!player) return "";

  const result = MOSTCOMMON(PLAYEROPPONENTS(player));

  if(result.count===0) return "";

  return result.value + " (" + result.count + " games)";

}


/*******************************************************
 *
 * BEST FACTION
 *
 * Usage:
 * =BESTFACTION(A2)
 *
 * Always returns the best faction,
 * even if only played once.
 *
 *******************************************************/
function BESTFACTION(player){

  if(!player) return "";

  const games = PLAYERGAMES(player);

  if(games.length===0) return "";

  const factions = {};

  games.forEach(function(g){

    const faction = g[COL_FACTION];

    if(!factions[faction]){

      factions[faction]=[];

    }

    factions[faction].push(g);

  });

  let bestFaction="";
  let bestRecord=null;

  for(const faction in factions){

    const record = RECORD(factions[faction]);

    if(bestRecord===null){

      bestFaction=faction;
      bestRecord=record;

      continue;

    }

    if(record.pct>bestRecord.pct){

      bestFaction=faction;
      bestRecord=record;

    }

    else if(record.pct===bestRecord.pct){

      if(record.wins>bestRecord.wins){

        bestFaction=faction;
        bestRecord=record;

      }

      else if(record.wins===bestRecord.wins){

        if(record.games>bestRecord.games){

          bestFaction=faction;
          bestRecord=record;

        }

      }

    }

  }

  if(bestFaction==="") return "";

  return (
    bestFaction +
    " (" +
    bestRecord.wins +
    "-" +
    bestRecord.losses +
    (bestRecord.draws>0
      ? "-" + bestRecord.draws
      : "") +
    ", " +
    Math.round(bestRecord.pct*100) +
    "%)"
  );

}


/*******************************************************
 *
 * FIRST TURN WIN %
 *
 * Usage:
 * =FIRSTTURNWINRATE(A2)
 *
 *******************************************************/
function FIRSTTURNWINRATE(player){

  if(!player) return "";

  const games = FIRSTTURNGAMES(player);

  if(games.length===0) return "";

  const record = RECORD(games);

  return Math.round(record.pct*100) + "%";

}


/*******************************************************
 *
 * SECOND TURN WIN %
 *
 * Usage:
 * =SECONDTURNWINRATE(A2)
 *
 *******************************************************/
function SECONDTURNWINRATE(player){

  if(!player) return "";

  const games = SECONDTURNGAMES(player);

  if(games.length===0) return "";

  const record = RECORD(games);

  return Math.round(record.pct*100) + "%";

}


/*******************************************************
 *
 * FIRST TURN RECORD
 *
 * Usage:
 * =FIRSTTURNRECORD(A2)
 *
 *******************************************************/
function FIRSTTURNRECORD(player){

  if(!player) return "";

  const games = FIRSTTURNGAMES(player);

  if(games.length===0) return "";

  const r = RECORD(games);

  let record =
      r.wins +
      "-" +
      r.losses;

  if(r.draws>0){

    record += "-" + r.draws;

  }

  record +=
      " (" +
      Math.round(r.pct*100) +
      "%)";

  return record;

}


/*******************************************************
 *
 * SECOND TURN RECORD
 *
 * Usage:
 * =SECONDTURNRECORD(A2)
 *
 *******************************************************/
function SECONDTURNRECORD(player){

  if(!player) return "";

  const games = SECONDTURNGAMES(player);

  if(games.length===0) return "";

  const r = RECORD(games);

  let record =
      r.wins +
      "-" +
      r.losses;

  if(r.draws>0){

    record += "-" + r.draws;

  }

  record +=
      " (" +
      Math.round(r.pct*100) +
      "%)";

  return record;

}
/*******************************************************
 *
 * LOBO INFINITY LEAGUE
 * Analytics Library v2.0
 *
 * PART 3
 * Advanced Analytics Functions
 *
 *******************************************************/


/*******************************************************
 *
 * TOP FACTIONS FOR A MISSION
 *
 * Usage:
 * =TOPFACTION(A2)
 *
 *******************************************************/
function TOPFACTION(mission){

  if(!mission) return "";

  const data = ENGINE();

  const stats = {};

  for(let i=1;i<data.length;i++){

    const row = data[i];

    if(row[COL_MISSION]!==mission) continue;

    const faction = row[COL_FACTION];
    const result  = row[COL_RESULT];

    if(!stats[faction]){

      stats[faction]={
        wins:0,
        losses:0,
        draws:0,
        games:0
      };

    }

    stats[faction].games++;

    if(result==="W")
      stats[faction].wins++;

    else if(result==="L")
      stats[faction].losses++;

    else
      stats[faction].draws++;

  }

  const ranking=[];

  for(const faction in stats){

    const s=stats[faction];

    ranking.push({

      faction:faction,

      wins:s.wins,

      losses:s.losses,

      draws:s.draws,

      games:s.games,

      pct:
        s.games===0
        ?0
        :s.wins/s.games

    });

  }

  ranking.sort(function(a,b){

    if(b.wins!==a.wins)
      return b.wins-a.wins;

    if(b.pct!==a.pct)
      return b.pct-a.pct;

    return b.games-a.games;

  });

  return ranking

    .slice(0,3)

    .map(function(r,i){

      let text =
        (i+1)+". "+
        r.faction+
        " ("+
        r.wins+
        "-"+
        r.losses;

      if(r.draws>0)
        text += "-"+r.draws;

      text +=
        ", "+
        Math.round(r.pct*100)+
        "%)";

      return text;

    })

    .join("\n");

}


/*******************************************************
 *
 * NEMESIS
 *
 * Opponent with lowest win percentage
 *
 * Usage:
 * =NEMESIS(A2)
 *
 *******************************************************/
function NEMESIS(player){

  if(!player) return "";

  const games = PLAYERGAMES(player);

  const rivals={};

  games.forEach(function(g){

    const opponent=g[COL_OPPONENT];

    if(!rivals[opponent]){

      rivals[opponent]=[];

    }

    rivals[opponent].push(g);

  });

  let nemesis="";
  let worst=null;

  for(const opponent in rivals){

    const record = RECORD(rivals[opponent]);

    if(worst===null){

      worst=record;
      nemesis=opponent;
      continue;

    }

    if(record.pct<worst.pct){

      worst=record;
      nemesis=opponent;

    }

  }

  if(nemesis==="") return "";

  return nemesis+
    " ("+
    worst.wins+
    "-"+
    worst.losses+
    ")";

}


/*******************************************************
 *
 * MOST PLAYED MISSION
 *
 * Usage:
 * =MOSTPLAYEDMISSION()
 *
 *******************************************************/
function MOSTPLAYEDMISSION(){

  const data = ENGINE();

  const missions=[];

  for(let i=1;i<data.length;i++){

    missions.push(data[i][COL_MISSION]);

  }

  const result= MOSTCOMMON(missions);

  return result.value+
    " ("+
    Math.round(result.count/2)+
    " games)";

}


/*******************************************************
 *
 * MOST PLAYED FACTION
 *
 * Usage:
 * =MOSTPLAYEDFACTION()
 *
 *******************************************************/
function MOSTPLAYEDFACTION(){

  const data = ENGINE();

  const factions=[];

  for(let i=1;i<data.length;i++){

    factions.push(data[i][COL_FACTION]);

  }

  const result= MOSTCOMMON(factions);

  return result.value+
    " ("+
    result.count+
    " games)";

}


/*******************************************************
 *
 * FIRST TURN WIN RATE
 * FOR A MISSION
 *
 * Usage:
 * =MISSIONFIRSTTURNWINRATE(A2)
 *
 *******************************************************/
function MISSIONFIRSTTURNWINRATE(mission){

  if(!mission) return "";

  const data = ENGINE();

  let wins=0;
  let games=0;

  for(let i=1;i<data.length;i++){

    const row=data[i];

    if(row[COL_MISSION]!==mission)
      continue;

    if(row[COL_FIRSTTURN]!=="Yes")
      continue;

    games++;

    if(row[COL_RESULT]==="W")
      wins++;

  }

  if(games===0)
    return "";

  return Math.round((wins/games)*100)+"%";

}


/*******************************************************
 *
 * BEST MISSION FOR A FACTION
 *
 * Usage:
 * =BESTMISSION(A2)
 *
 *******************************************************/
function BESTMISSION(faction){

  if(!faction) return "";

  const data=ENGINE();

  const missions={};

  for(let i=1;i<data.length;i++){

    const row=data[i];

    if(row[COL_FACTION]!==faction)
      continue;

    const mission=row[COL_MISSION];

    if(!missions[mission])
      missions[mission]=[];

    missions[mission].push(row);

  }

  let best="";
  let bestPct=-1;

  for(const mission in missions){

    const record=RECORD(missions[mission]);

    if(record.pct>bestPct){

      bestPct=record.pct;
      best=mission;

    }

  }

  if(best==="") return "";

  return best+
    " ("+
    Math.round(bestPct*100)+
    "%)";

}


/*******************************************************
 *
 * WORST MISSION FOR A FACTION
 *
 * Usage:
 * =WORSTMISSION(A2)
 *
 *******************************************************/
function WORSTMISSION(faction){

  if(!faction) return "";

  const data=ENGINE();

  const missions={};

  for(let i=1;i<data.length;i++){

    const row=data[i];

    if(row[COL_FACTION]!==faction)
      continue;

    const mission=row[COL_MISSION];

    if(!missions[mission])
      missions[mission]=[];

    missions[mission].push(row);

  }

  let worst="";
  let worstPct=2;

  for(const mission in missions){

    const record=RECORD(missions[mission]);

    if(record.pct<worstPct){

      worstPct=record.pct;
      worst=mission;

    }

  }

  if(worst==="") return "";

  return worst+
    " ("+
    Math.round(worstPct*100)+
    "%)";

}
