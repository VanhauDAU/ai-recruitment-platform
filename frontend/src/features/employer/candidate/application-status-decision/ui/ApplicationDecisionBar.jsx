import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  LikeOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { formatClockTime } from '@/shared/lib/date-time'
import useApplicationDecision from '../model/use-application-decision'
import './application-decision.css'

const DECISIONS = [
  { status: 'shortlisted', label: 'Phù hợp', Icon: LikeOutlined },
  { status: 'interviewed', label: 'Phỏng vấn', Icon: TeamOutlined },
  { status: 'accepted', label: 'Trúng tuyển', Icon: TrophyOutlined },
  { status: 'rejected', label: 'Không phù hợp', Icon: CloseCircleOutlined },
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
      <div className="ad-bar__grid" role="group" aria-label="Quyết định cho hồ sơ">
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
            Ứng viên sẽ được báo lúc <strong>{formatClockTime(pendingNotice.deliver_at)}</strong>
          </span>
          <button type="button" className="ad-pending__undo" disabled={undoing} onClick={undo}>
            Hoàn tác
          </button>
        </div>
      )}
      {final && !pendingNotice && <p className="ad-bar__hint">Hồ sơ đã có kết quả cuối cùng.</p>}
      {confirmationModal}
    </div>
  )
}
