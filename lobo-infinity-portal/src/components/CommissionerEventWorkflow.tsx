import { useState } from 'react'
import {
  apiClient,
  type EventHomeData,
} from '../services/api'
import { eventRepository } from '../services/data'
import {
  validateEventWorkflow,
  type OperationalGuidance,
  type WorkflowIssue,
  type WorkflowOperation,
  type WorkflowStatus,
} from '../services/eventWorkflowValidation'

type CommissionerEventWorkflowProps = {
  data: EventHomeData
}

function CommissionerEventWorkflow({ data }: CommissionerEventWorkflowProps) {
  const validation = validateEventWorkflow(data)
  const [workingAction, setWorkingAction] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function runCorrectiveAction(actionId: string, label: string) {
    setWorkingAction(actionId)
    setMessage('')
    setError('')

    try {
      if (actionId === 'closeRegistration' || actionId === 'openRegistration') {
        await eventRepository.setRegistration({
          eventId: data.event.id,
          registration:
            actionId === 'closeRegistration'
              ? 'Registration Closed'
              : 'Registration Open',
        })
      } else {
        await apiClient.operationsAction('eventLifecycleTransition', {
          direction: 'repair',
          eventId: data.event.id,
          reason: label,
          repairAction: actionId,
        })
      }

      setMessage(`${label} completed. Refresh the Event Overview to review the updated state.`)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : `${label} could not be completed.`,
      )
    } finally {
      setWorkingAction('')
    }
  }

  return (
    <section
      className="panel event-home-panel commissioner-event-workflow"
      id="commissioner"
    >
      <div className="panel-heading">
        <p className="eyebrow">Commissioner</p>
        <h2>Event Operations</h2>
      </div>

      <div className="operations-metrics compact">
        <WorkflowMetric label="Overall Health" value={`${validation.overallHealth}%`} />
        <WorkflowMetric label="Warnings" value={validation.issues.length} />
        <WorkflowMetric label="Stage" value={data.event.lifecycleStage || data.event.status} />
        <WorkflowMetric label="Registration" value={data.registration.status} />
      </div>

      <CommissionerWorkflowNav />
      <OperationalGuidancePanel
        guidance={validation.guidance}
        onAction={runCorrectiveAction}
        workingAction={workingAction}
      />
      <LifecycleCenter
        issues={validation.issues}
        onAction={runCorrectiveAction}
        stages={validation.stages}
        workingAction={workingAction}
      />
      <ParticipantsSummary data={data} />
      <PairingsSummary data={data} />
      <EventHealthCard health={validation.health} overallHealth={validation.overallHealth} />
      <OperationsList
        onAction={runCorrectiveAction}
        operations={validation.operations}
        workingAction={workingAction}
      />
      <AutomationSummary data={data} />

      {message ? <p className="operations-empty" role="status">{message}</p> : null}
      {error ? <p className="operations-empty" role="alert">{error}</p> : null}
    </section>
  )
}

function CommissionerWorkflowNav() {
  return (
    <nav className="event-home-nav" aria-label="Commissioner event operations">
      <a href="#commissioner-guidance">Next Action</a>
      <a href="#commissioner-lifecycle">Lifecycle</a>
      <a href="#commissioner-participants">Participants</a>
      <a href="#commissioner-pairings">Pairings</a>
      <a href="#commissioner-operations">Operations</a>
      <a href="#commissioner-automation">Automation</a>
      <a href="#commissioner-health">Health</a>
    </nav>
  )
}

function OperationalGuidancePanel({
  guidance,
  onAction,
  workingAction,
}: {
  guidance: OperationalGuidance
  onAction: (actionId: string, label: string) => Promise<void>
  workingAction: string
}) {
  const actionable = !['wait', 'monitorResults', 'reviewEvent'].includes(
    guidance.recommendedActionId,
  )

  return (
    <section className="operations-stack" id="commissioner-guidance">
      <div className="panel-heading">
        <p className="eyebrow">Operational Guidance</p>
        <h3>Next Action</h3>
      </div>
      <article className={`operations-record ${readinessTone(guidance.readiness)}`}>
        <span>{readinessLabel(guidance.readiness)}</span>
        <h3>{guidance.recommendedAction}</h3>
        <p>{guidance.reason}</p>
        <small>Expected Outcome: {guidance.expectedOutcome}</small>
        {actionable ? (
          <button
            disabled={workingAction !== ''}
            onClick={() =>
              void onAction(
                guidance.recommendedActionId,
                guidance.recommendedAction,
              )
            }
            type="button"
          >
            {workingAction === guidance.recommendedActionId
              ? 'Working...'
              : guidance.recommendedAction}
          </button>
        ) : null}
      </article>
      <div className="operations-metrics compact">
        <WorkflowMetric
          label="Readiness"
          value={readinessLabel(guidance.readiness)}
        />
        <WorkflowMetric
          label="Completion"
          value={`${guidanceCompletion(guidance)}%`}
        />
        <WorkflowMetric
          label="Blocking Issues"
          value={guidance.blockingIssueCount}
        />
        <WorkflowMetric label="Confidence" value={guidance.confidence} />
        <WorkflowMetric label="Next Milestone" value={guidance.nextMilestone} />
        <WorkflowMetric label="Estimated Time" value={guidance.estimatedTime} />
      </div>
      <div className="operations-grid two-column">
        <article className="operations-record">
          <span>Current State</span>
          <h3>{guidance.currentState}</h3>
        </article>
        <article className="operations-record complete">
          <span>Recommended Action</span>
          <h3>{guidance.recommendedAction}</h3>
        </article>
        <article className="operations-record">
          <span>Resulting State</span>
          <h3>{guidance.resultingState}</h3>
        </article>
      </div>
      {guidance.blockers.length > 0 ? (
        <div className="operations-grid two-column">
          {guidance.blockers.map((blocker) => (
            <article className="operations-record warning" key={blocker}>
              <span>Blocker</span>
              <h3>{blocker}</h3>
            </article>
          ))}
        </div>
      ) : (
        <article className="operations-record complete">
          <span>Ready</span>
          <h3>No blockers detected</h3>
          <p>The loaded Event metadata does not show a blocking issue.</p>
        </article>
      )}
    </section>
  )
}

function LifecycleCenter({
  issues,
  onAction,
  stages,
  workingAction,
}: {
  issues: WorkflowIssue[]
  onAction: (actionId: string, label: string) => Promise<void>
  stages: Array<{
    detail: string
    label: string
    status: WorkflowStatus
  }>
  workingAction: string
}) {
  return (
    <section className="operations-stack" id="commissioner-lifecycle">
      <div className="panel-heading">
        <p className="eyebrow">Lifecycle</p>
        <h3>Operational Center</h3>
      </div>
      <div className="operations-grid two-column">
        {stages.map((stage) => (
          <article className={`operations-record ${stage.status}`} key={stage.label}>
            <span>{statusLabel(stage.status)}</span>
            <h3>{stage.label}</h3>
            <p>{stage.detail}</p>
          </article>
        ))}
      </div>
      {issues.length === 0 ? (
        <article className="operations-record complete">
          <span>Complete</span>
          <h3>No lifecycle conflicts detected</h3>
          <p>Event state is internally consistent based on loaded Event metadata.</p>
        </article>
      ) : (
        issues.map((issue) => (
          <article className={`operations-record ${issue.severity}`} key={issue.actionId}>
            <span>{issue.severity}</span>
            <h3>{issue.description}</h3>
            <p>Recommended Action: {issue.recommendedFix}</p>
            <button
              disabled={workingAction !== ''}
              onClick={() => void onAction(issue.actionId, issue.recommendedFix)}
              type="button"
            >
              {workingAction === issue.actionId ? 'Working...' : issue.recommendedFix}
            </button>
          </article>
        ))
      )}
    </section>
  )
}

function ParticipantsSummary({ data }: { data: EventHomeData }) {
  return (
    <section className="operations-stack" id="commissioner-participants">
      <div className="panel-heading">
        <p className="eyebrow">Participants</p>
        <h3>Roster Snapshot</h3>
      </div>
      <div className="operations-grid two-column">
        <WorkflowMetric
          label="Registered"
          value={data.registration.registeredCount}
        />
        <WorkflowMetric label="Teams" value={data.registration.teamCount} />
        <WorkflowMetric label="Captains" value={data.registration.captains.length} />
        <WorkflowMetric
          label="Free Agents"
          value={data.registration.freeAgents.length}
        />
        <WorkflowMetric label="Waitlist" value={data.registration.waitlistCount} />
        <WorkflowMetric
          label="Capacity"
          value={
            data.registration.capacity.unlimited
              ? 'Unlimited'
              : data.registration.capacity.maximumPlayers
          }
        />
      </div>
    </section>
  )
}

function PairingsSummary({ data }: { data: EventHomeData }) {
  return (
    <section className="operations-stack" id="commissioner-pairings">
      <div className="panel-heading">
        <p className="eyebrow">Pairings</p>
        <h3>Schedule Snapshot</h3>
      </div>
      <div className="operations-grid two-column">
        <WorkflowMetric label="Rounds" value={data.rounds.length} />
        <WorkflowMetric
          label="Current Round"
          value={data.statistics.currentRound || 'Pending'}
        />
        <WorkflowMetric
          label="Completed Games"
          value={data.statistics.completedGames}
        />
        <WorkflowMetric
          label="Games Remaining"
          value={data.statistics.gamesRemaining}
        />
      </div>
    </section>
  )
}

function OperationsList({
  onAction,
  operations,
  workingAction,
}: {
  onAction: (actionId: string, label: string) => Promise<void>
  operations: WorkflowOperation[]
  workingAction: string
}) {
  return (
    <section className="operations-stack" id="commissioner-operations">
      <div className="panel-heading">
        <p className="eyebrow">Operations</p>
        <h3>Commissioner Tasks</h3>
      </div>
      {operations.map((operation) => (
        <article className="operations-record" key={operation.actionId}>
          <span>{operation.currentStatus}</span>
          <h3>{operation.label}</h3>
          <p>Prerequisites: {operation.prerequisites}</p>
          <small>Result: {operation.result}</small>
          <button
            disabled={workingAction !== ''}
            onClick={() => void onAction(operation.actionId, operation.label)}
            type="button"
          >
            {workingAction === operation.actionId ? 'Working...' : operation.label}
          </button>
        </article>
      ))}
    </section>
  )
}

function EventHealthCard({
  health,
  overallHealth,
}: {
  health: Array<{
    label: string
    score: number
    status: WorkflowStatus
  }>
  overallHealth: number
}) {
  return (
    <section className="operations-stack" id="commissioner-health">
      <div className="panel-heading">
        <p className="eyebrow">Event Health</p>
        <h3>Overall Health {overallHealth}%</h3>
      </div>
      <div className="operations-grid two-column">
        {health.map((item) => (
          <article className={`operations-record ${item.status}`} key={item.label}>
            <span>{statusLabel(item.status)}</span>
            <h3>{item.label}</h3>
            <p>{item.score}%</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function AutomationSummary({ data }: { data: EventHomeData }) {
  const registrationEnd = data.registration.registrationWindow.endDate || 'Not scheduled'

  return (
    <section className="operations-stack" id="commissioner-automation">
      <div className="panel-heading">
        <p className="eyebrow">Automation</p>
        <h3>Existing Automation</h3>
      </div>
      <div className="operations-grid two-column">
        <article className="operations-record">
          <span>Registration closes in</span>
          <h3>{registrationEnd}</h3>
          <p>Uses Event Engine registration window metadata.</p>
        </article>
        <article className="operations-record">
          <span>Roster Lock</span>
          <h3>{data.registration.registrationOpen ? 'Pending' : 'Ready'}</h3>
          <p>No new automation backend required.</p>
        </article>
        <article className="operations-record">
          <span>Round Publication</span>
          <h3>{data.statistics.currentRound || 'Pending'}</h3>
          <p>Driven by the current Event lifecycle state.</p>
        </article>
        <article className="operations-record">
          <span>Cache Status</span>
          <h3>Healthy</h3>
          <p>Existing Event and Dashboard caches remain in use.</p>
        </article>
      </div>
    </section>
  )
}

function WorkflowMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function guidanceCompletion(guidance: OperationalGuidance) {
  if (guidance.readiness === 'ready') {
    return 100
  }

  if (guidance.readiness === 'waiting') {
    return 75
  }

  if (guidance.readiness === 'attention') {
    return 60
  }

  return 40
}

function readinessLabel(readiness: OperationalGuidance['readiness']) {
  if (readiness === 'ready') {
    return 'Ready'
  }

  if (readiness === 'waiting') {
    return 'Waiting'
  }

  if (readiness === 'attention') {
    return 'Attention Required'
  }

  return 'Blocked'
}

function readinessTone(readiness: OperationalGuidance['readiness']): WorkflowStatus {
  if (readiness === 'ready') {
    return 'complete'
  }

  if (readiness === 'waiting') {
    return 'pending'
  }

  return 'warning'
}

function statusLabel(status: WorkflowStatus) {
  if (status === 'complete') {
    return 'Complete'
  }

  if (status === 'warning') {
    return 'Needs Attention'
  }

  return 'Pending'
}

export default CommissionerEventWorkflow
