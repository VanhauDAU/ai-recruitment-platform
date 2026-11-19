import { CheckOutlined, ExclamationOutlined } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'

// Lộ trình thiết lập: mỗi bước hiện trạng thái thật của dữ liệu, bấm để chuyển bước.
// ``locked``: chiến dịch chưa được tạo, chỉ bước đầu dùng được.
export default function SetupStepRail({ steps, states, current, onSelect, locked = false }) {
  return (
    <nav aria-label={m.employer_campaign_setup_rail_aria()} className="csw-rail">
      <ol className="csw-rail__list">
        {steps.map((step, index) => {
          const state = states[step.key]
          const tone = state.done
            ? 'done'
            : step.optional ? 'optional' : step.key === 'launch' && state.ready ? 'ready' : 'todo'
          const isCurrent = step.key === current
          return (
            <li key={step.key} className={`csw-step is-${tone}${isCurrent ? ' is-current' : ''}`}>
              <button
                type="button"
                className="csw-step__button"
                aria-current={isCurrent ? 'step' : undefined}
                disabled={locked && !isCurrent}
                onClick={() => onSelect(step.key)}
              >
                <span className="csw-step__mark" aria-hidden>
                  {tone === 'done'
                    ? <CheckOutlined />
                    : tone === 'todo' && !isCurrent ? <ExclamationOutlined /> : index + 1}
                </span>
                <span className="csw-step__text">
                  <span className="csw-step__title">{step.title}</span>
                  <span className="csw-step__summary">{state.summary}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
