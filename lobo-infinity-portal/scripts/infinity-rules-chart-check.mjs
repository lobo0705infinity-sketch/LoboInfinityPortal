import { loadProductionRulesCorpus, buildRulesReference } from '../bot/infinity-rules-service.mjs'

const corpus = await loadProductionRulesCorpus({ force: true })
const chartChunks = corpus.chunks.filter((chunk) => chunk.chartRows?.length)
if (!chartChunks.length) throw new Error('No structured hacking chart rows found')
const rows = chartChunks.flatMap((chunk) => chunk.chartRows)
const fields = ['name', 'attackMod', 'opponentMod', 'ps', 'burst', 'target', 'skillType', 'special']
for (const row of rows) {
  if (Object.keys(row).length !== 8 || fields.some((field) => !(field in row) || !String(row[field]).trim())) throw new Error(`Incomplete chart row: ${row.name}`)
}
const zero = corpus.chunks.find((chunk) => chunk.pdfPage === 193)?.chartRows.find((row) => row.name === 'ZERO PAIN')
if (!zero || JSON.stringify(zero) !== JSON.stringify({ name: 'ZERO PAIN', attackMod: '0', opponentMod: '-3', ps: '—', burst: '2', target: '—', skillType: 'SHORT SKILL / ARO', special: 'NULLIFIES COMMS ATTACK, B2 IN ARO, NON-LETHAL.' })) throw new Error(`Malformed Zero Pain row: ${JSON.stringify(zero)}`)
for (const name of ['CARBONITE', 'OBLIVION', 'SPOTLIGHT', 'TRINITY']) if (!rows.some((row) => row.name === name)) throw new Error(`Missing representative row: ${name}`)
const reference = buildRulesReference(corpus, 'Does Zero Pain suffer Firewall when using an enemy Repeater?')
const chart = reference.rules.find((rule) => rule.ruleName.includes('PROGRAM CHART'))
if (!chart || !chart.excerpt.includes('ATTACK MOD') || chart.excerpt.includes('Matching canonical chart row')) throw new Error('Zero Pain chart evidence was not complete')
console.log(`Validated ${rows.length} structured hacking-program rows across ${chartChunks.length} chart chunks`)
