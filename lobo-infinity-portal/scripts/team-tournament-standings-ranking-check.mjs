import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

const read=(file)=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8')
const backend=read('backend/TeamTournamentApi.gs')
const analytics=read('backend/EventAnalyticsApi.gs')
const prepared=read('backend/PublicTeamTournamentProjection.gs')
const exporter=read('backend/PublicSnapshotExporter.gs')
const page=read('src/pages/TeamTournament.tsx')
const client=read('src/services/api.ts')
const publicClient=read('src/services/publicTeamTournamentProjection.ts')
const snapshot=read('src/public/SnapshotPublicApp.tsx')

const comparatorSource=backend.match(/function compareTeamTournamentStandings\(left, right\) \{[\s\S]*?\n\}/)?.[0]
assert.ok(comparatorSource,'Canonical Team Tournament comparator is missing.')
const context=vm.createContext({Number})
vm.runInContext(`${comparatorSource};this.compare=compareTeamTournamentStandings`,context)
const fixture=[
  {teamName:'VP tie winner',objectivePoints:'40',tournamentPoints:'8',victoryPoints:'100'},
  {teamName:'OP winner',objectivePoints:'100',tournamentPoints:'1',victoryPoints:'1'},
  {teamName:'TP tie winner',objectivePoints:'40',tournamentPoints:'10',victoryPoints:'1'},
  {teamName:'Alphabetical fallback B',objectivePoints:'40',tournamentPoints:'8',victoryPoints:'90'},
  {teamName:'Alphabetical fallback A',objectivePoints:'40',tournamentPoints:'8',victoryPoints:'90'}
]
const ranked=fixture.slice().sort(context.compare).map((team,index)=>({...team,rank:index+1}))
assert.deepEqual(ranked.map((team)=>team.teamName),['OP winner','TP tie winner','VP tie winner','Alphabetical fallback A','Alphabetical fallback B'])
assert.deepEqual(ranked.map((team)=>team.rank),[1,2,3,4,5])

const builderSource=backend.match(/function buildTeamTournamentStandings\(eventId, teams, tournamentResults, recentGames\) \{[\s\S]*?\n\}\n\nfunction compareTeamTournamentStandings/)?.[0].replace(/\n\nfunction compareTeamTournamentStandings$/,'')
assert.ok(builderSource,'Canonical Team Tournament standings builder is missing.')
const builderContext=vm.createContext({
  Number,
  getTeamTournamentCanonicalGames_:()=>[],
  getTeamTournamentString:(value)=>String(value??''),
  parseTeamTournamentScore:(value)=>{const [left,right]=String(value).split('-').map(Number);return{left,right}},
  splitTeamTournamentPlayers:(players)=>String(players).split(',').map((player)=>player.trim()),
  teamTournamentScoreIsDraw:()=>false,
})
vm.runInContext(`${comparatorSource};${builderSource};this.build=buildTeamTournamentStandings`,builderContext)
const calculated=builderContext.build('team-event',[{teamId:'a',teamName:'Alpha',captain:'A',players:'A'},{teamId:'b',teamName:'Beta',captain:'B',players:'B'}],[{status:'Accepted',teamA:'Alpha',teamB:'Beta',tournamentPoints:'5-2',objectivePoints:'4-8',victoryPoints:'100-90'}],[])
assert.deepEqual(JSON.parse(JSON.stringify(calculated.map(({teamName,rank,tournamentPoints,objectivePoints,victoryPoints,wins,losses,draws})=>({teamName,rank,tournamentPoints,objectivePoints,victoryPoints,wins,losses,draws})))),[
  {teamName:'Beta',rank:1,tournamentPoints:2,objectivePoints:8,victoryPoints:90,wins:0,losses:1,draws:0},
  {teamName:'Alpha',rank:2,tournamentPoints:5,objectivePoints:4,victoryPoints:100,wins:1,losses:0,draws:0},
])
assert.match(backend,/\.sort\(compareTeamTournamentStandings\)[\s\S]*?\.map\(function\(team, index\)/)
assert.doesNotMatch(comparatorSource,/wins|losses|draws|players/)

// Every surface consumes the canonical array without applying a competing ranking.
assert.match(backend,/standings:\s*standings/)
assert.match(analytics,/buildTeamTournamentStandings\([\s\S]*?\)\.map\(function\(row\)/)
assert.match(prepared,/getTeamTournament\([\s\S]*?tournament:\s*tournament/)
assert.match(exporter,/teamTournamentProjection\.tournament\.standings/)
assert.match(client,/standings:\s*getArray\(tournament, 'standings'\)\.map/)
assert.match(publicClient,/standings:\s*Array\.isArray\(event\.standings\) \? event\.standings : \[\]/)
assert.match(page,/function TeamStandings\([\s\S]*?standings\.map\(\(team\)/)
assert.match(snapshot,/function TeamTournamentStandings\([\s\S]*?standings\.map\(team/)
assert.match(snapshot,/event\.standings\.map\(team/)

console.log('PASS - Team Tournament standings rank numerically by OP, then TP, then VP; ranks follow sorting and every surface preserves the canonical order.')
