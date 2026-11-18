import { CheckCircleFilled } from '@ant-design/icons'
import { completenessCardId } from '../model/content-form'
import './company-completeness.css'

/** Độ hoàn thiện trang công ty; mục chưa xong mở thẳng thẻ nội dung tương ứng qua `onOpenItem(cardId)`. */
export default function CompanyCompletenessMeter({ completeness, onOpenItem }) {
  const score = Math.max(0, Math.min(100, Number(completeness?.score) || 0))
  const items = completeness?.items || []
  const missing = items.filter((item) => !item.done)

  return (
    <section className="company-completeness" aria-label="Độ hoàn thiện trang công ty">
      <div className="company-completeness__summary">
        <strong>{score}%</strong>
        <span>hoàn thiện · {items.length - missing.length}/{items.length} mục</span>
      </div>
      <div className="company-completeness__bar" role="progressbar" aria-label="Độ hoàn thiện" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${score}%` }} />
      </div>
      {items.length > 0 && (
        <details className="company-completeness__details">
          <summary>{missing.length ? `Còn ${missing.length} mục nên bổ sung` : 'Đã đủ mọi mục'}</summary>
          <ul>
            {items.map((item) => (
              <li key={item.key}>
                {item.done ? (
                  <span className="company-completeness__done"><CheckCircleFilled aria-hidden="true" /> {item.label}</span>
                ) : (
                  <button type="button" onClick={() => onOpenItem(completenessCardId(item.key))}>Bổ sung {item.label.toLowerCase()}</button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
