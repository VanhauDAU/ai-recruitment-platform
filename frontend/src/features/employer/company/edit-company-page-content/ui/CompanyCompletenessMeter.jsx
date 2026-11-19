import { CheckCircleFilled } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'
import { completenessCardId } from '../model/content-form'
import './company-completeness.css'

/** Độ hoàn thiện trang công ty; mục chưa xong mở thẳng thẻ nội dung tương ứng qua `onOpenItem(cardId)`. */
export default function CompanyCompletenessMeter({ completeness, onOpenItem }) {
  const score = Math.max(0, Math.min(100, Number(completeness?.score) || 0))
  const items = completeness?.items || []
  const missing = items.filter((item) => !item.done)

  return (
    <section className="company-completeness" aria-label={m.employer_company_completeness_label()}>
      <div className="company-completeness__summary">
        <strong>{score}%</strong>
        <span>{m.employer_company_completeness_summary({ done: items.length - missing.length, total: items.length })}</span>
      </div>
      <div className="company-completeness__bar" role="progressbar" aria-label={m.employer_company_completeness_bar()} aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${score}%` }} />
      </div>
      {items.length > 0 && (
        <details className="company-completeness__details">
          <summary>{missing.length ? m.employer_company_completeness_missing({ count: missing.length }) : m.employer_company_completeness_all_done()}</summary>
          <ul>
            {items.map((item) => (
              <li key={item.key}>
                {item.done ? (
                  <span className="company-completeness__done"><CheckCircleFilled aria-hidden="true" /> {item.label}</span>
                ) : (
                  <button type="button" onClick={() => onOpenItem(completenessCardId(item.key))}>{m.employer_company_completeness_add_item({ item: item.label.toLowerCase() })}</button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
