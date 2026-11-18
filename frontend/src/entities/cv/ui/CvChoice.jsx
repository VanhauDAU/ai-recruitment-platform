import { InfoCircleFilled } from '@ant-design/icons'
import { Link } from 'react-router'
import { message } from '@/shared/lib/toast'
import { cvChoiceStatus, isCvApplicationReady } from '../model/cv-choice'
import './cv-choice.css'

function formatCvDate(value) {
  if (!value) return 'Chưa có thời gian cập nhật'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Một dòng chọn CV (radio) dùng chung cho các luồng cần chọn một CV của ứng viên.
 * `blockUnready`: không cho chọn CV chưa nộp được (luồng ứng tuyển). `badge`: nhãn cạnh tên.
 * `children`: phần mở rộng hiện trong thẻ khi CV đang được chọn.
 */
export default function CvChoice({ cv, selected, onSelect, name = 'cv-choice', blockUnready = false, badge, children }) {
  const { text: statusText, hint, tone, editable } = cvChoiceStatus(cv)
  const blocked = blockUnready && !isCvApplicationReady(cv)
  const select = () => {
    if (blocked) message.warning(hint || 'CV này chưa dùng để ứng tuyển được.')
    else onSelect(cv.public_id)
  }

  return (
    <div className={`cvc${selected ? ' cvc--selected' : ''}${blocked ? ' cvc--blocked' : ''}`}>
      <div className="cvc__row" onClick={select}>
        <input
          type="radio"
          name={name}
          value={cv.public_id}
          checked={selected}
          disabled={blocked}
          onChange={select}
          onClick={(event) => event.stopPropagation()}
          aria-label={`${cv.title}${cv.is_default ? ' CV chính' : ''}`}
          className="cvc__radio"
        />

        <span className="cvc__main">
          <span className="cvc__title-line">
            <span className="cvc__title">{cv.title}</span>
            {badge && <span className="cvc__badge">{badge}</span>}
          </span>
          <span className="cvc__meta">
            {cv.cv_type === 'uploaded' ? 'CV tải lên' : 'CV online'} - {formatCvDate(cv.updated_at)}
          </span>
          {selected && hint && <span className="cvc__hint">{hint}</span>}
        </span>

        <span className="cvc__actions">
          {statusText && (
            <span className={`cvc__status${tone === 'soft' ? ' cvc__status--soft' : ''}`}>
              <InfoCircleFilled /> {statusText}
            </span>
          )}
          {editable && (
            <Link
              to={`/cvs/${cv.public_id}/edit`}
              target="_blank"
              onClick={(event) => event.stopPropagation()}
              className="cvc__edit"
            >
              Sửa CV
            </Link>
          )}
          <Link
            to={`/cvs/${cv.public_id}/view`}
            target="_blank"
            onClick={(event) => event.stopPropagation()}
            className="cvc__view"
          >
            Xem
          </Link>
        </span>
      </div>
      {selected && children && <div className="cvc__body">{children}</div>}
    </div>
  )
}
