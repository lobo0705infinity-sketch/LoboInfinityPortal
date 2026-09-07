import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const benchmarkPath = new URL('../data/infinity-rules/rules-adjudicator-benchmark.json', import.meta.url)
const stopWords = new Set(['a','an','and','are','as','at','be','by','for','from','has','if','in','is','it','of','on','or','that','the','their','this','to','use','with'])

function normalizedTerms(value) {
  return new Set(String(value || '').toLowerCase().replace(/[^a-z0-9+-]+/g, ' ').split(/\s+/).filter((term) => term.length > 2 && !stopWords.has(term)))
}

function citationKey(citation) {
  return `${citation?.sourceId || ''}|${String(citation?.page ?? '')}`
}

export function evaluateRulesAnswers(benchmark, candidatePayload) {
  const candidateAnswers = Array.isArray(candidatePayload) ? candidatePayload : candidatePayload?.answers
  if (!Array.isArray(candidateAnswers)) throw new Error('Candidate file must be an array or an object with an answers array.')

  const byId = new Map(candidateAnswers.map((answer) => [answer?.id, answer]))
  const duplicateIds = candidateAnswers.length - byId.size
  const details = benchmark.cases.map((testCase) => {
    const candidate = byId.get(testCase.id)
    const expectedAnswer = testCase.approvedAnswer || testCase.draftAnswer || ''
    const expectedConclusion = testCase.approvedConclusion || testCase.draftConclusion || null
    const expectedCitations = testCase.approvedCitations?.length ? testCase.approvedCitations : (testCase.draftCitations || [])
    const answerPresent = Boolean(candidate?.answer?.trim())
    const conclusionMatch = answerPresent && candidate?.conclusion === expectedConclusion
    const expectedCitationKeys = new Set(expectedCitations.map(citationKey))
    const candidateCitationKeys = new Set((candidate?.citations || []).map(citationKey))
    const citationMatch = expectedCitationKeys.size === 0
      ? candidateCitationKeys.size === 0
      : [...expectedCitationKeys].every((key) => candidateCitationKeys.has(key))
    const safeEscalation = testCase.category !== 'UNRESOLVED_UNSUPPORTED' || (
      candidate?.conclusion === 'UNRESOLVED' &&
      /official corpus|tournament organizer|corvus belli|local event ruling/i.test(candidate?.answer || '')
    )
    const referenceTerms = normalizedTerms(expectedAnswer)
    const candidateTerms = normalizedTerms(candidate?.answer)
    const referenceTermRecall = referenceTerms.size
      ? [...referenceTerms].filter((term) => candidateTerms.has(term)).length / referenceTerms.size
      : 0
    return { id: testCase.id, category: testCase.category, answerPresent, conclusionMatch, citationMatch, safeEscalation, referenceTermRecall }
  })

  const ratio = (predicate) => details.filter(predicate).length / details.length
  const approvedReferences = benchmark.cases.filter((item) => item.reviewStatus === 'APPROVED').length
  const scores = {
    coverage: ratio((item) => item.answerPresent),
    conclusionAgreement: ratio((item) => item.conclusionMatch),
    citationValidity: ratio((item) => item.citationMatch),
    safeEscalationAccuracy: ratio((item) => item.safeEscalation),
    averageReferenceTermRecall: details.reduce((sum, item) => sum + item.referenceTermRecall, 0) / details.length,
  }
  const contractPass = duplicateIds === 0 && scores.coverage === 1 && scores.conclusionAgreement === 1 && scores.citationValidity === 1 && scores.safeEscalationAccuracy === 1
  return {
    totalCases: benchmark.cases.length,
    submittedAnswers: candidateAnswers.length,
    duplicateIds,
    approvedReferences,
    draftReferences: benchmark.cases.filter((item) => item.reviewStatus === 'VERIFIED_DRAFT').length,
    scores,
    contractPass,
    releaseEligible: contractPass && approvedReferences === benchmark.policy.approvedAnswersRequiredBeforeRelease,
    note: 'Reference-term recall is diagnostic only and is not proof of semantic correctness.',
    failures: details.filter((item) => !item.answerPresent || !item.conclusionMatch || !item.citationMatch || !item.safeEscalation),
  }
}

async function selfTest(benchmark) {
  const perfect = benchmark.cases.map((item) => ({
    id: item.id,
    answer: item.draftAnswer,
    conclusion: item.draftConclusion,
    certainty: item.draftCertainty,
    citations: item.draftCitations,
  }))
  const passing = evaluateRulesAnswers(benchmark, perfect)
  if (!passing.contractPass || passing.releaseEligible) throw new Error('Perfect draft self-test did not preserve the approval gate.')

  const broken = structuredClone(perfect)
  broken[0].answer = ''
  broken.at(-1).conclusion = 'YES'
  const failing = evaluateRulesAnswers(benchmark, broken)
  if (failing.contractPass || failing.failures.length < 2) throw new Error('Negative self-test did not detect failures.')
  console.log('Rules evaluator self-test passed: 100 cases, 0 network requests, approval gate locked.')
}

async function main() {
  const benchmark = JSON.parse(await readFile(benchmarkPath, 'utf8'))
  if (process.argv.includes('--self-test')) return selfTest(benchmark)
  const candidatePath = process.argv[2]
  if (!candidatePath) throw new Error('Usage: node scripts/rules-adjudicator-evaluate.mjs <candidate-answers.json> or --self-test')
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'))
  console.log(JSON.stringify(evaluateRulesAnswers(benchmark, candidate), null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
