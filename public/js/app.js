const API='https://script.google.com/macros/s/AKfycbxCKaDOuo9ZyX0ZaxMT4DoIWzd7aP5eI4xs2piNJcEM1GHcXv3XgQyKmAvSykaT-gaN4A/exec';
async function load(){const r=await fetch(API+'?action=dashboard');const d=await r.json();
leaderName.textContent=d.leader.player;gamesPlayed.textContent=d.gamesPlayed;activePlayers.textContent=d.activePlayers;topFaction.textContent=d.topFaction;
const tb=document.querySelector('#standingsTable tbody');tb.innerHTML='';
d.mainManStandings.forEach(x=>tb.innerHTML+=`<tr><td>${x.rank}</td><td>${x.player}</td><td>${x.tp}</td><td>${x.op}</td><td>${x.vp}</td></tr>`);
}
load();setInterval(load,60000);