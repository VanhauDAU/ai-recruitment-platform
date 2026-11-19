import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  LikeOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { formatClockTime } from '@/shared/lib/date-time'
import { m } from '@/shared/config/i18n'
import useApplicationDecision from '../model/use-application-decision'
import './application-decision.css'

const DECISIONS = [
  { status: 'shortlisted', label: m.employer_workspace_decision_shortlisted(), Icon: LikeOutlined },
  { status: 'interviewed', label: m.employer_workspace_decision_interviewed(), Icon: TeamOutlined },
  { status: 'accepted', label: m.employer_workspace_decision_accepted(), Icon: TrophyOutlined },
  { status: 'rejected', label: m.employer_workspace_decision_rejected(), Icon: CloseCircleOutlined },
]

/**
 * `pendingNotice` is the latest history row the recruiter may still undo
 * (`can_undo`): its notice has not reached the candidate yet.
 */
export default function ApplicationDecisionBar({ application, candidateName, pendingNotice }) {
  const { confirmationModal, decide, deciding, undo, undoing } = useApplicationDecision(
    application,
    candidateName,
  )
  const allowed = application?.available_decisions || []
  const final = allowed.length === 0

  return (
    <div className="ad-bar">
      <div className="ad-bar__grid" role="group" aria-label={m.employer_workspace_decision_group()}>
        {DECISIONS.map(({ status, label, Icon }) => {
          const current = application?.status === status
          return (
            <button
              key={status}
              type="button"
              className={`ad-decision ad-decision--${status}${current ? ' is-current' : ''}`}
              aria-pressed={current}
              disabled={current || deciding || !allowed.includes(status)}
              onClick={() => decide(status)}
            >
              <Icon aria-hidden />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
      {pendingNotice && (
        <div className="ad-pending" role="status">
          <ClockCircleOutlined aria-hidden />
          <span>
            {m.employer_workspace_decision_notice_at()} <strong>{formatClockTime(pendingNotice.deliver_at)}</strong>
          </span>
          <button type="button" className="ad-pending__undo" disabled={undoing} onClick={undo}>
            {m.employer_workspace_decision_undo()}
          </button>
        </div>
      )}
      {final && !pendingNotice && <p className="ad-bar__hint">{m.employer_workspace_decision_final()}</p>}
      {confirmationModal}
    </div>
  )
}
