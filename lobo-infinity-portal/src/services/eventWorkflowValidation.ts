import type { EventHomeData } from './api'

export type WorkflowStatus = 'complete' | 'pending' | 'warning'

export type WorkflowStage = {
  detail: string
  label: string
  status: WorkflowStatus
}

export type WorkflowIssue = {
  actionId: string
  description: string
  recommendedFix: string
  severity: 'warning' | 'critical'
}

export type WorkflowOperation = {
  actionId: string
  currentStatus: string
  label: string
  prerequisites: string
  result: string
}

export type WorkflowHealth = {
  label: string
  score: number
  status: WorkflowStatus
}

export type ReadinessState = 'ready' | 'waiting' | 'blocked' | 'attention'

export type OperationalGuidance = {
  blockers: string[]
  blockingIssueCount: number
  confidence: 'high' | 'medium' | 'low'
  currentState: string
  estimatedTime: string
  expectedOutcome: string
  nextMilestone: string
  readiness: ReadinessState
  reason: string
  recommendedAction: string
  recommendedActionId: string
  resultingState: string
}

export type EventWorkflowValidation = {
  guidance: OperationalGuidance
  health: WorkflowHealth[]
  issues: WorkflowIssue[]
  operations: WorkflowOperation[]
  overallHealth: number
  stages: WorkflowStage[]
}

export function validateEventWorkflow(data: EventHomeData): EventWorkflowValidation {
  const registrationOpen = isRegistrationOpen(data)
  const registeredPlayers =
    data.registration.registeredCount || data.statistics.registeredPlayers
  const rounds = data.rounds.length
  const hasSchedule = rounds > 0
  const lifecycle = `${data.event.lifecycleStage} ${data.event.status}`.toLowerCase()
  const isPublished =
    lifecycle.includes('active') ||
    lifecycle.includes('published') ||
    lifecycle.includes('round')
  const isArchived = lifecycle.includes('archived')
  const isComplete = data.statistics.completionPercentage >= 100 || isArchived
  const rosterUnlocked =
    !registrationOpen &&
    data.event.participants.toLowerCase().includes('unlocked')

  const stages: WorkflowStage[] = [
    {
      detail: data.event.lifecycleStage || data.event.status || 'Planning',
      label: 'Current Stage',
      status: isArchived || isPublished ? 'complete' : 'pending',
    },
    {
      detail: data.registration.status || data.statistics.registrationStatus,
      label: 'Registration Status',
      status: registrationOpen ? 'pending' : registeredPlayers > 0 ? 'complete' : 'warning',
    },
    {
      detail: rosterUnlocked
        ? 'Roster is still unlocked'
        : registeredPlayers > 0
          ? `${registeredPlayers} registered`
          : 'No registered players',
      label: 'Roster Status',
      status: rosterUnlocked ? 'warning' : registeredPlayers > 0 ? 'complete' : 'pending',
    },
    {
      detail: hasSchedule ? `${rounds} rounds configured` : 'Schedule not generated',
      label: 'Schedule Status',
      status: hasSchedule ? 'complete' : 'pending',
    },
    {
      detail: data.statistics.currentRound || 'No active round',
      label: 'Round Status',
      status: isPublished && !hasSchedule ? 'warning' : data.statistics.currentRound ? 'complete' : 'pending',
    },
    {
      detail: isPublished ? 'Published to players' : 'Not published',
      label: 'Publication Status',
      status: isPublished ? 'complete' : 'pending',
    },
    {
      detail: `${data.statistics.completionPercentage}% complete`,
      label: 'Completion Status',
      status: isComplete ? 'complete' : 'pending',
    },
  ]

  const issues = buildWorkflowIssues({
    data,
    hasSchedule,
    isArchived,
    isComplete,
    isPublished,
    registeredPlayers,
    registrationOpen,
    rosterUnlocked,
  })
  const health = buildHealth(stages, data, issues)
  const operations = buildOperations(
    data,
    registrationOpen,
    hasSchedule,
    isPublished,
    isArchived,
  )

  return {
    guidance: buildOperationalGuidance({
      data,
      hasSchedule,
      isArchived,
      isComplete,
      isPublished,
      issues,
      operations,
      registeredPlayers,
      registrationOpen,
      rosterUnlocked,
    }),
    health,
    issues,
    operations,
    overallHealth: Math.round(
      health.reduce((total, item) => total + item.score, 0) / health.length,
    ),
    stages,
  }
}

function buildOperationalGuidance({
  data,
  hasSchedule,
  isArchived,
  isComplete,
  isPublished,
  issues,
  operations,
  registeredPlayers,
  registrationOpen,
  rosterUnlocked,
}: {
  data: EventHomeData
  hasSchedule: boolean
  isArchived: boolean
  isComplete: boolean
  isPublished: boolean
  issues: WorkflowIssue[]
  operations: WorkflowOperation[]
  registeredPlayers: number
  registrationOpen: boolean
  rosterUnlocked: boolean
}): OperationalGuidance {
  const blockers = buildBlockers({
    data,
    hasSchedule,
    isPublished,
    registeredPlayers,
    registrationOpen,
    rosterUnlocked,
  })
  const criticalIssues = issues.filter((issue) => issue.severity === 'critical')
  const currentState = getCurrentOperationalState({
    data,
    hasSchedule,
    isArchived,
    isComplete,
    isPublished,
    registrationOpen,
    rosterUnlocked,
  })

  if (criticalIssues.length > 0) {
    const issue = criticalIssues[0]
    return guidance({
      blockers,
      confidence: 'high',
      currentState,
      expectedOutcome: getOperationResult(operations, issue.actionId),
      nextMilestone: issue.recommendedFix,
      readiness: 'blocked',
      reason: issue.description,
      recommendedAction: issue.recommendedFix,
      recommendedActionId: issue.actionId,
      resultingState: getResultingState(issue.actionId),
    })
  }

  if (registrationOpen) {
    return guidance({
      blockers,
      confidence: 'high',
      currentState,
      expectedOutcome: 'Registration remains open until the Commissioner closes it.',
      nextMilestone: 'Registration closes',
      readiness: 'waiting',
      reason: getRegistrationWaitReason(data),
      recommendedAction: 'Wait',
      recommendedActionId: 'wait',
      resultingState: 'Registration Open',
    })
  }

  if (issues.length > 0) {
    const issue = issues[0]
    return guidance({
      blockers,
      confidence: 'high',
      currentState,
      expectedOutcome: getOperationResult(operations, issue.actionId),
      nextMilestone: issue.recommendedFix,
      readiness: 'attention',
      reason: issue.description,
      recommendedAction: issue.recommendedFix,
      recommendedActionId: issue.actionId,
      resultingState: getResultingState(issue.actionId),
    })
  }

  if (isComplete && !isArchived) {
    return guidance({
      blockers,
      confidence: 'high',
      currentState,
      expectedOutcome: 'Event moves into historical archive.',
      nextMilestone: 'Archive Event',
      readiness: 'ready',
      reason: 'The event is complete and has no remaining active blockers.',
      recommendedAction: 'Archive Event',
      recommendedActionId: 'archiveEvent',
      resultingState: 'Archived',
    })
  }

  if (!hasSchedule) {
    return guidance({
      blockers,
      confidence: 'medium',
      currentState,
      expectedOutcome: 'Pairings can be reviewed before publication.',
      nextMilestone: 'Pairings generated',
      readiness: registeredPlayers > 0 ? 'ready' : 'blocked',
      reason: registeredPlayers > 0
        ? 'Registration is closed and no schedule has been generated.'
        : 'At least one participant is required before pairings can be generated.',
      recommendedAction: 'Generate Pairings',
      recommendedActionId: 'generatePairings',
      resultingState: 'Pairings Generated',
    })
  }

  if (!isPublished) {
    return guidance({
      blockers,
      confidence: 'high',
      currentState,
      expectedOutcome: 'Players can see the active round and begin scheduling games.',
      nextMilestone: 'Round published',
      readiness: 'ready',
      reason: 'Pairings exist but are not published to players.',
      recommendedAction: 'Publish Round',
      recommendedActionId: 'publishRound',
      resultingState: 'Round Active',
    })
  }

  if (data.statistics.gamesRemaining > 0) {
    return guidance({
      blockers,
      confidence: 'high',
      currentState,
      expectedOutcome: 'The Commissioner tracks results until the round is complete.',
      nextMilestone: 'All results reported',
      readiness: 'waiting',
      reason: `${data.statistics.completedGames} of ${
        data.statistics.completedGames + data.statistics.gamesRemaining
      } games are complete.`,
      recommendedAction: 'Monitor Results',
      recommendedActionId: 'monitorResults',
      resultingState: 'Round Active',
    })
  }

  return guidance({
    blockers,
    confidence: 'medium',
    currentState,
    expectedOutcome: 'Standings can be reviewed and the next lifecycle step selected.',
    nextMilestone: 'Commissioner review',
    readiness: 'ready',
    reason: 'No blocking issues were detected in the loaded Event metadata.',
    recommendedAction: 'Review Event',
    recommendedActionId: 'reviewEvent',
    resultingState: currentState,
  })
}

function guidance({
  blockers,
  confidence,
  currentState,
  expectedOutcome,
  nextMilestone,
  readiness,
  reason,
  recommendedAction,
  recommendedActionId,
  resultingState,
}: Omit<OperationalGuidance, 'blockingIssueCount' | 'estimatedTime'>): OperationalGuidance {
  return {
    blockers,
    blockingIssueCount: blockers.length,
    confidence,
    currentState,
    estimatedTime: getEstimatedTime(recommendedActionId),
    expectedOutcome,
    nextMilestone,
    readiness,
    reason,
    recommendedAction,
    recommendedActionId,
    resultingState,
  }
}

function buildWorkflowIssues({
  data,
  hasSchedule,
  isArchived,
  isComplete,
  isPublished,
  registeredPlayers,
  registrationOpen,
  rosterUnlocked,
}: {
  data: EventHomeData
  hasSchedule: boolean
  isArchived: boolean
  isComplete: boolean
  isPublished: boolean
  registeredPlayers: number
  registrationOpen: boolean
  rosterUnlocked: boolean
}) {
  const issues: WorkflowIssue[] = []

  if (hasSchedule && registrationOpen) {
    issues.push({
      actionId: 'closeRegistration',
      description: 'Schedule cannot exist while registration is open.',
      recommendedFix: 'Close Registration',
      severity: 'warning',
    })
  }

  if (rosterUnlocked) {
    issues.push({
      actionId: 'lockRosters',
      description: 'Registration is closed but rosters remain unlocked.',
      recommendedFix: 'Lock Rosters',
      severity: 'warning',
    })
  }

  if (isPublished && !hasSchedule) {
    issues.push({
      actionId: 'generatePairings',
      description: 'Pairings must be generated before publishing the round.',
      recommendedFix: 'Generate Pairings',
      severity: 'critical',
    })
  }

  if (!registrationOpen && registeredPlayers === 0) {
    issues.push({
      actionId: 'openRegistration',
      description: 'Registration is closed and no participants are registered.',
      recommendedFix: 'Open Registration',
      severity: 'warning',
    })
  }

  if (isComplete && !isArchived) {
    issues.push({
      actionId: 'archiveEvent',
      description: `${data.event.name} appears complete but is not archived.`,
      recommendedFix: 'Archive Event',
      severity: 'warning',
    })
  }

  return issues
}

function buildBlockers({
  data,
  hasSchedule,
  isPublished,
  registeredPlayers,
  registrationOpen,
  rosterUnlocked,
}: {
  data: EventHomeData
  hasSchedule: boolean
  isPublished: boolean
  registeredPlayers: number
  registrationOpen: boolean
  rosterUnlocked: boolean
}) {
  const blockers: string[] = []

  if (registrationOpen) {
    blockers.push('Registration still open')
  }

  if (registeredPlayers === 0) {
    blockers.push('No registered participants')
  }

  if (rosterUnlocked) {
    blockers.push('Roster remains unlocked')
  }

  if (!hasSchedule) {
    blockers.push('Schedule missing')
  }

  if (hasSchedule && !isPublished) {
    blockers.push('Pairings unpublished')
  }

  if (isPublished && !data.statistics.currentRound) {
    blockers.push('No active round')
  }

  return blockers
}

function buildHealth(
  stages: WorkflowStage[],
  data: EventHomeData,
  issues: WorkflowIssue[],
): WorkflowHealth[] {
  const healthFor = (label: string, stageLabel: string): WorkflowHealth => {
    const stage = stages.find((item) => item.label === stageLabel)
    const score = stage?.status === 'complete' ? 100 : stage?.status === 'warning' ? 60 : 75

    return {
      label,
      score,
      status: stage?.status ?? 'pending',
    }
  }

  return [
    healthFor('Registration', 'Registration Status'),
    healthFor('Roster', 'Roster Status'),
    healthFor('Schedule', 'Schedule Status'),
    {
      label: 'Standings',
      score: data.statistics.completedGames > 0 ? 100 : 75,
      status: data.statistics.completedGames > 0 ? 'complete' : 'pending',
    },
    {
      label: 'Automation',
      score: issues.some((issue) => issue.severity === 'critical') ? 65 : 100,
      status: issues.some((issue) => issue.severity === 'critical')
        ? 'warning'
        : 'complete',
    },
  ]
}

function getCurrentOperationalState({
  data,
  hasSchedule,
  isArchived,
  isComplete,
  isPublished,
  registrationOpen,
  rosterUnlocked,
}: {
  data: EventHomeData
  hasSchedule: boolean
  isArchived: boolean
  isComplete: boolean
  isPublished: boolean
  registrationOpen: boolean
  rosterUnlocked: boolean
}) {
  if (isArchived) {
    return 'Archived'
  }

  if (isComplete) {
    return 'Completed'
  }

  if (isPublished && data.statistics.gamesRemaining > 0) {
    return 'Round Active'
  }

  if (hasSchedule && !isPublished) {
    return 'Pairings Generated'
  }

  if (rosterUnlocked) {
    return 'Registration Closed / Roster Unlocked'
  }

  if (!registrationOpen && !hasSchedule) {
    return 'Registration Closed'
  }

  if (registrationOpen) {
    return 'Registration Open'
  }

  return data.event.lifecycleStage || data.event.status || 'Planning'
}

function getEstimatedTime(actionId: string) {
  if (actionId === 'wait' || actionId === 'monitorResults') {
    return 'Ongoing'
  }

  if (actionId === 'reviewEvent') {
    return 'Commissioner review'
  }

  return '<30 seconds'
}

function getOperationResult(operations: WorkflowOperation[], actionId: string) {
  return operations.find((operation) => operation.actionId === actionId)?.result
    ?? 'Event state is updated for the next operational milestone.'
}

function getRegistrationWaitReason(data: EventHomeData) {
  const endDate = data.registration.registrationWindow.endDate
  const daysRemaining = getDaysUntil(endDate)

  if (daysRemaining > 1) {
    return `Registration remains open for another ${daysRemaining} days.`
  }

  if (daysRemaining === 1) {
    return 'Registration remains open for 1 more day.'
  }

  if (daysRemaining === 0) {
    return 'Registration closes today.'
  }

  return 'Registration is currently open.'
}

function getDaysUntil(value: string) {
  const timestamp = Date.parse(value)

  if (!value || Number.isNaN(timestamp)) {
    return -1
  }

  return Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24))
}

function getResultingState(actionId: string) {
  const states: Record<string, string> = {
    archiveEvent: 'Archived',
    closeRegistration: 'Registration Closed',
    generatePairings: 'Pairings Generated',
    lockRosters: 'Roster Locked',
    openRegistration: 'Registration Open',
    publishRound: 'Round Active',
    publishStandings: 'Standings Published',
  }

  return states[actionId] ?? 'Next State'
}

function buildOperations(
  data: EventHomeData,
  registrationOpen: boolean,
  hasSchedule: boolean,
  isPublished: boolean,
  isArchived: boolean,
): WorkflowOperation[] {
  return [
    {
      actionId: registrationOpen ? 'closeRegistration' : 'openRegistration',
      currentStatus: registrationOpen ? 'Open' : 'Closed',
      label: registrationOpen ? 'Close Registration' : 'Open Registration',
      prerequisites: 'Event exists and Commissioner access is active.',
      result: registrationOpen
        ? 'Registration closes and roster review can begin.'
        : 'Players can register for the event.',
    },
    {
      actionId: 'lockRosters',
      currentStatus: registrationOpen ? 'Waiting for registration close' : 'Ready',
      label: 'Lock Rosters',
      prerequisites: 'Registration closed and participants reviewed.',
      result: 'Rosters become stable for pairings and standings.',
    },
    {
      actionId: 'generatePairings',
      currentStatus: hasSchedule ? 'Generated' : 'Not generated',
      label: 'Generate Pairings',
      prerequisites: 'Rosters locked and event round selected.',
      result: 'Pairings become available for publication.',
    },
    {
      actionId: 'publishRound',
      currentStatus: isPublished ? 'Published' : 'Not published',
      label: 'Publish Round',
      prerequisites: 'Pairings generated.',
      result: 'Players can see the active round.',
    },
    {
      actionId: 'publishStandings',
      currentStatus: data.statistics.completedGames > 0 ? 'Ready' : 'Waiting for results',
      label: 'Publish Standings',
      prerequisites: 'At least one reported result.',
      result: 'Current standings are visible to players.',
    },
    {
      actionId: 'archiveEvent',
      currentStatus: isArchived ? 'Archived' : 'Active',
      label: 'Archive Event',
      prerequisites: 'Event complete and results reviewed.',
      result: 'Event moves into historical archive.',
    },
  ]
}

function isRegistrationOpen(data: EventHomeData) {
  const status =
    `${data.registration.status} ${data.statistics.registrationStatus} ${
      data.event.registration
    }`.toLowerCase()
  return data.registration.registrationOpen || status.includes('open')
}
