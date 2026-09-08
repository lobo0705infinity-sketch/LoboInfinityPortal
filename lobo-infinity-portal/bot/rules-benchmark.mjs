import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const BENCHMARK_FILES = Object.freeze([
  'data/infinity-rules/rules-adjudicator-benchmark.json',
  'data/infinity-rules/rules-adjudicator-expansion-400.json',
  'data/infinity-rules/rules-adjudicator-new-topics-400.json',
  'data/infinity-rules/rules-adjudicator-new-topics-500.json',
])
const APPROVALS_FILE = 'data/infinity-rules/rules-benchmark-approvals.json'
const STOP_WORDS = new Set(['a', 'an', 'and', 'at', 'can', 'could', 'do', 'does', 'for', 'how', 'i', 'if', 'in', 'is', 'it', 'of', 'on', 'or', 'should', 'the', 'this', 'to', 'under', 'what', 'when', 'while', 'with'])
let cachedIndex

export async function loadRulesBenchmark({ force = false } = {}) {
  if (cachedIndex && !force) return cachedIndex
  const [documents, approvalDocument] = await Promise.all([
    Promise.all(BENCHMARK_FILES.map(async (relativePath) => JSON.parse(await readFile(resolve(ROOT, relativePath), 'utf8')))),
    readFile(resolve(ROOT, APPROVALS_FILE), 'utf8').then(JSON.parse),
  ])
  const explicitlyApproved = new Set(approvalDocument.approvedCaseIds || [])
  const canonical = new Map()
  for (const item of documents[0].cases || []) {
    if (item.reviewStatus !== 'APPROVED') continue
    canonical.set(item.id, answerRecord(item, {
      familyId: item.id,
      question: item.question,
      answer: item.approvedAnswer,
      conclusion: item.approvedConclusion,
      certainty: item.approvedCertainty,
      citations: item.approvedCitations,
    }))
  }

  const entries = []
  for (const record of canonical.values()) entries.push(indexed(record, record.question))
  for (const item of documents[1].cases || []) {
    const inherited = canonical.get(item.canonicalId)
    if (!inherited) continue
    entries.push(indexed({ ...inherited, id: item.id, familyId: item.canonicalId, question: item.question }, item.question))
  }
  for (const document of documents.slice(2)) {
    for (const item of document.cases || []) {
      if (!['APPROVED', 'AUTO_VERIFIED_EXPLICIT'].includes(item.reviewStatus) && !explicitlyApproved.has(item.id)) continue
      const record = answerRecord(item, {
        familyId: item.id,
        question: item.canonicalQuestion,
        answer: item.approvedAnswer || item.draftAnswer,
        conclusion: item.approvedConclusion || item.draftConclusion,
        certainty: item.approvedCertainty || item.draftCertainty,
        citations: item.approvedCitations || item.draftCitations,
      })
      entries.push(indexed(record, item.canonicalQuestion))
      for (const variant of item.queryVariants || []) entries.push(indexed({ ...record, queryId: variant.id }, variant.question))
    }
  }
  const exact = new Map()
  const exactCollisions = new Set()
  for (const entry of entries) {
    const existing = exact.get(entry.normalized)
    if (existing && existing.familyId !== entry.familyId) exactCollisions.add(entry.normalized)
    else if (!existing) exact.set(entry.normalized, entry)
  }
  for (const normalized of exactCollisions) exact.delete(normalized)
  cachedIndex = Object.freeze({ entries, exact, canonicalCases: new Set(entries.map((entry) => entry.id)).size })
  return cachedIndex
}

export async function findApprovedRulesAnswer(question, { minimumScore = 0.86, minimumGap = 0.08 } = {}) {
  const normalized = normalizeQuestion(question)
  if (!normalized) return null
  const index = await loadRulesBenchmark()
  const exact = index.exact.get(normalized)
  if (exact) return result(exact, 1, 'EXACT')

  const queryTokens = tokenSet(normalized)
  if (queryTokens.size < 2) return null
  const families = new Map()
  for (const entry of index.entries) {
    const score = similarity(queryTokens, entry.tokens)
    const existing = families.get(entry.familyId)
    if (!existing || score > existing.score) families.set(entry.familyId, { entry, score })
  }
  const [best, second] = [...families.values()].sort((left, right) => right.score - left.score)
  if (!best || best.score < minimumScore || best.score - (second?.score || 0) < minimumGap) return null
  return result(best.entry, best.score, 'HIGH_CONFIDENCE')
}

function answerRecord(item, values) {
  return Object.freeze({ id: item.id, category: item.category, ...values })
}

function indexed(record, question) {
  const normalized = normalizeQuestion(question)
  return Object.freeze({ ...record, matchedQuestion: question, normalized, tokens: tokenSet(normalized) })
}

function result(entry, score, matchType) {
  return { ...entry, score, matchType }
}

function tokenSet(value) {
  return new Set(value.split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token)))
}

function similarity(left, right) {
  let common = 0
  for (const token of left) if (right.has(token)) common++
  if (!common) return 0
  const dice = (2 * common) / (left.size + right.size)
  const queryCoverage = common / left.size
  const coveredTokens = Math.max(left.size === 2 && right.size <= 4 ? 2 : 3, Math.ceil(left.size * 0.8))
  const containment = common >= coveredTokens ? queryCoverage * 0.92 : 0
  return Math.max(dice, containment)
}

export function normalizeQuestion(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\bwhen is ([a-z0-9 -]+?) (?:allowed|permitted)(?:\?|$)/g, 'when can a trooper use $1')
    .replace(/\bwhat (?:are the rules for|is the rule for) ([a-z0-9 -]+?)(?:\?|$)/g, 'what does $1 do')
    .replace(/\bhow does ([a-z0-9 -]+?) work(?:\?|$)/g, 'what does $1 do')
    .replace(/\bn\s*5\s*\.\s*3\b/g, 'n5.3')
    .replace(/\bline of fire\b/g, 'lof')
    .replace(/\bzone of control\b/g, 'zoc')
    .replace(/\bautomatic reaction orders?\b/g, 'aro')
    .replace(/\baros\b/g, 'aro')
    .replace(/\bballistic skill attacks?\b/g, 'bs attack')
    .replace(/\bstay(?:s|ing)? hidden\b/g, 'without reveal')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(trooper|troopers|model|models|unit|units|piece|pieces)\b/g, 'trooper')
    .replace(/\b(deployed|deploying)\b/g, 'deployment')
    .replace(/\b(lay|lays|placing|places|plant|plants|planting|drop|drops|dropping|set|sets|setting)\b/g, 'place')
    .replace(/\b(reveals|revealing|revealed)\b/g, 'reveal')
    .replace(/\b(shoot|shoots|shooting|attacks|attacking|attacked)\b/g, 'attack')
    .replace(/\b(dodges|dodging|dodged)\b/g, 'dodge')
    .replace(/\b(prevent|prevents|preventing|prevented|stop|stops|stopping|stopped)\b/g, 'prevent')
    .replace(/\b(hacks|hacking)\b/g, 'hack')
    .replace(/\b(repeaters)\b/g, 'repeater')
    .replace(/\b(enemy|enemies|opponent|opponents)\b/g, 'target')
    .replace(/\banother\b/g, 'different target')
    .replace(/\b(permitted|allowed)\b/g, 'use')
    .replace(/\bworks?|rules?\b/g, ' ')
    .replace(/\b(rules check|quick question|quick version|in infinity n5 3|at the table|table situation)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function clearRulesBenchmarkCacheForTests() { cachedIndex = undefined }
