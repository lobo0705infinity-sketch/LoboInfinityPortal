import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync('backend/DoubleEliminationBracketApi.gs', 'utf8')
const c = vm.createContext({ Date, Set, getEventManagerString:value=>String(value ?? '').trim(), Utilities:{formatDate:d=>d.toISOString().slice(0,19).replace('T',' ')}, Session:{getScriptTimeZone:()=> 'UTC'} })
vm.runInContext(source,c)
let assigned = true
c.getEventBracketMission_ = () => assigned ? 'Corporate Appropriation' : ''
const now = new Date('2026-10-31T12:00:00Z')
const entrants = count => Array.from({length:count},(_,i)=>({player:`P${i+1}`,seed:i+1}))
for (const count of [2,3,4,5,8,17,24,25,32,40]) {
  for (let run=0;run<100;run++) {
    const matches = c.buildDoubleEliminationBracket_('fixture',entrants(count))
    assert.equal(matches.some(m=>m.activatedAt || m.deadline),false,'draft has no clocks')
    assigned = false
    c.activatePlayableEventBracketMatches_(matches,now,{requireAssignedMission:true})
    assert.equal(matches.some(m=>m.status==='Active'),false,'missing missions block activation')
    assigned = true
    c.activatePlayableEventBracketMatches_(matches,now,{requireAssignedMission:true})
    const losses = new Map()
    let completed=0
    while (true) {
      const match=matches.find(m=>m.status==='Active')
      if (!match) break
      assert.equal((losses.get(match.playerA)||0) < 2,true)
      assert.equal((losses.get(match.playerB)||0) < 2,true)
      // Both possible finals paths, then varied earlier outcomes.
      const bWins = match.matchId==='GF-M1' ? run%2===1 : Math.random()<0.5
      const winner=bWins?match.playerB:match.playerA, loser=bWins?match.playerA:match.playerB
      losses.set(loser,(losses.get(loser)||0)+1)
      c.completeEventBracketMatch_(matches,match,winner,loser,'Played',++completed,now)
      assert.ok(completed <= 2*count-1)
    }
    const gf=matches.find(m=>m.matchId==='GF-M1'), reset=matches.find(m=>m.matchId==='GF-M2')
    assert.equal(gf.status,'Completed')
    assert.equal(reset.status,run%2===1?'Completed':'Not Required')
    const champion=reset.status==='Completed'?reset.winner:gf.winner
    assert.equal(completed,2*count-(run%2===1?1:2))
    for (const player of entrants(count).map(e=>e.player)) if(player!==champion) assert.equal(losses.get(player),2,`${player} must lose twice`)
  }
}
const rematch=c.buildDoubleEliminationBracket_('fixture',entrants(24))
c.activatePlayableEventBracketMatches_(rematch,now)
let m=rematch.find(m=>m.matchId==='W1-M2')
c.completeEventBracketMatch_(rematch,m,m.playerA,m.playerB,'Played',1,now)
m=rematch.find(m=>m.matchId==='W2-M1')
c.completeEventBracketMatch_(rematch,m,m.playerA,m.playerB,'Played',2,now)
assert.equal(rematch.some(m=>m.status==='Active' && [m.playerA,m.playerB].includes('P16') && [m.playerA,m.playerB].includes('P17')),false,'crossed drops prevent immediate rematch')
console.log('PASS: 1000 complete tournaments, both finals paths, two-loss elimination, paused preparation, mission gates, crossed drops')
