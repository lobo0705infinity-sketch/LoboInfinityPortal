export function assertRulesModelEvaluationAllowed({ benchmark, live, maximum, environment = process.env }) {
  if (!live) return { allowed: true, mode: 'MOCK', approvedCases: 0 }

  const totalCases = benchmark?.cases?.length || 0
  const approvedCases = benchmark?.cases?.filter((item) => item.reviewStatus === 'APPROVED').length || 0
  const requiredApprovals = benchmark?.policy?.approvedAnswersRequiredBeforeRelease
  if (totalCases !== 100 || benchmark?.semanticAudit?.auditedCases !== 100 || benchmark?.semanticContracts?.contractedCases !== 100) {
    throw new Error('Live model evaluation blocked: the 100-case audited semantic benchmark is incomplete.')
  }
  if (approvedCases !== requiredApprovals) {
    throw new Error(`Live model evaluation blocked: ${approvedCases}/${requiredApprovals} benchmark answers are formally approved.`)
  }
  if (environment.ALLOW_PAID_RULES_BENCHMARK !== 'I_UNDERSTAND_THIS_COSTS_MONEY') {
    throw new Error('Paid benchmark blocked: explicit cost authorization is missing.')
  }
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > totalCases) {
    throw new Error(`Live mode requires an explicit --max-cases=1..${totalCases} limit.`)
  }
  return { allowed: true, mode: 'LIVE_PROVIDER', approvedCases, maximum }
}
