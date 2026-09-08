import { readFile, rename, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export const APPROVAL_CONFIRMATION = 'I_HAVE_REVIEWED_AND_APPROVE_ALL_100_RULES_ANSWERS'

export function approveRulesBenchmark(benchmark, { confirmation, reviewer, approvedAt = new Date().toISOString() }) {
  if (confirmation !== APPROVAL_CONFIRMATION) {
    throw new Error('Benchmark approval blocked: exact explicit approval confirmation is missing.')
  }
  if (!reviewer?.trim()) throw new Error('Benchmark approval blocked: reviewer identity is required.')
  if (benchmark?.cases?.length !== 100 || benchmark?.semanticAudit?.auditedCases !== 100 || benchmark?.semanticContracts?.contractedCases !== 100) {
    throw new Error('Benchmark approval blocked: the audited 100-case semantic benchmark is incomplete.')
  }
  if (!benchmark.cases.every((item) =>
    item.reviewStatus === 'VERIFIED_DRAFT' &&
    item.semanticAuditStatus === 'PASSED' &&
    item.draftAnswer?.trim() &&
    item.draftCertainty?.trim() &&
    item.draftConclusion &&
    Array.isArray(item.draftCitations) &&
    (item.draftCitations.length > 0 || item.category === 'UNRESOLVED_UNSUPPORTED')
  )) {
    throw new Error('Benchmark approval blocked: every case must be a complete verified draft.')
  }

  const approved = structuredClone(benchmark)
  for (const item of approved.cases) {
    item.approvedAnswer = item.draftAnswer
    item.approvedCitations = structuredClone(item.draftCitations)
    item.approvedConclusion = item.draftConclusion
    item.approvedCertainty = item.draftCertainty
    item.reviewStatus = 'APPROVED'
    item.approvedBy = reviewer.trim()
    item.approvedAt = approvedAt
  }
  approved.formalApproval = {
    approvedCases: 100,
    totalCases: 100,
    approvedBy: reviewer.trim(),
    approvedAt,
    method: 'EXPLICIT_ALL_CASE_REVIEW',
  }
  return approved
}

async function main() {
  if (!process.argv.includes('--write')) {
    throw new Error('Approval is dry by default. Pass --write only after explicitly approving all 100 answers.')
  }
  const reviewerArgument = process.argv.find((value) => value.startsWith('--reviewer='))
  const reviewer = reviewerArgument?.slice('--reviewer='.length)
  const benchmarkUrl = new URL('../data/infinity-rules/rules-adjudicator-benchmark.json', import.meta.url)
  const benchmark = JSON.parse(await readFile(benchmarkUrl, 'utf8'))
  const approved = approveRulesBenchmark(benchmark, {
    confirmation: process.env.APPROVE_RULES_BENCHMARK,
    reviewer,
  })
  const temporaryUrl = new URL('../data/infinity-rules/rules-adjudicator-benchmark.json.approval-tmp', import.meta.url)
  await writeFile(temporaryUrl, JSON.stringify(approved, null, 2) + '\n', 'utf8')
  await rename(temporaryUrl, benchmarkUrl)
  console.log('Approved all 100 rules benchmark answers. Run the full zero-cost benchmark before any model evaluation.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
