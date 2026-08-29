import assert from 'node:assert/strict'
import fs from 'node:fs'

const submit = fs.readFileSync('src/pages/SubmitResult.tsx', 'utf8')
const forms = fs.readFileSync('src/config/googleForms.ts', 'utf8')

for (const expected of [
  ['League Game', 'GOOGLE_FORM_URLS.league'],
  ['Team Tournament', 'GOOGLE_FORM_URLS.teamTournament'],
  ['Casual Game', 'GOOGLE_FORM_URLS.casual'],
  ["Lobo's American Top 40", 'GOOGLE_FORM_URLS.top40'],
]) {
  assert.ok(submit.includes(expected[0]), `${expected[0]} card must remain rendered`)
  assert.ok(submit.includes(expected[1]), `${expected[0]} must retain its configured Form URL`)
}

assert.match(submit, /buttonLabel="Submit Top 40 Game"/)
assert.match(submit, /description="Submit a Top 40 tournament game\."/)
assert.doesNotMatch(submit, /registeredCount|registered players|acceptingResponses/)
assert.match(forms, /top40:\s*'https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLSf7ydSIHZCI4lnRHJI1A7fWqLH_DlUfilZJzVm7qz_gK7jZaQ\/viewform'/)
assert.equal((submit.match(/<GoogleFormLauncher/g) || []).length, 4)

console.log('PASS Submit Game renders four Google Form cards')
console.log('PASS Top 40 card is unconditional and targets the canonical Form')
console.log('PASS League, Team Tournament, and Casual launchers are preserved')
