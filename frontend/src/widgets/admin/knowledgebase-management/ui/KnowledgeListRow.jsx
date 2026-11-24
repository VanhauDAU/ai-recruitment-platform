import { EditOutlined } from '@ant-design/icons'
import {
  formatKnowledgeDate,
  KNOWLEDGE_LIFECYCLE_STATUS,
  knowledgeLatestStatus,
  knowledgeTypeLabel,
} from '@/entities/content/knowledgebase'
import { m } from '@/shared/config/i18n'

// antd tag colors from the knowledgebase entity → `.ws-tone-*` dots.
const TONES = { success: 'emerald', processing: 'sky', default: 'slate' }
const tone = (color) => `ws-pill ws-tone-${TONES[color] || 'slate'}`

function Stat({ label, children }) {
  return (
    <div className="wt-cell">
      <span className="wt-label">{label}</span>
      {children}
    </div>
  )
}

export default function KnowledgeListRow({ article, onOpen }) {
  const revision = knowledgeLatestStatus(article)
  const lifecycle = KNOWLEDGE_LIFECYCLE_STATUS[article.lifecycle_state]
  const due = article.review_due_at
  const overdue = due && new Date(due) < new Date()
  const title = article.title || m.admin_knowledge_list_no_title()

  return (
    <article data-testid={`admin-knowledge-row-${article.public_id}`} className="wt-row">
      <div className="wt-cell wt-cell--main">
        <button type="button" className="wt-title akl-title" onClick={() => onOpen(article)}>{title}</button>
        <div className="wt-meta">
          <span className="akl-path">/{article.category?.slug}/{article.slug}</span>
        </div>
      </div>
      <Stat label={m.admin_knowledge_list_col_category()}>
        <span className="ws-strong ws-strong--sm">{article.category?.name}</span>
        <span className="ws-caption ws-muted">{knowledgeTypeLabel(article.article_type)}</span>
      </Stat>
      <div className="wt-cell wt-cell--status">
        <span className={tone(revision?.color)}>{revision?.label || m.admin_knowledge_list_no_revision()}</span>
        {/* Active is the default; only an archived article says so. */}
        {article.lifecycle_state !== 'ACTIVE' && lifecycle && <span className={tone(lifecycle.color)}>{lifecycle.label}</span>}
      </div>
      <Stat label={m.admin_knowledge_list_col_review()}>
        {due ? (
          <>
            <span className={`ws-strong ws-strong--sm${overdue ? ' akl-alert' : ''}`}>{formatKnowledgeDate(due)}</span>
            {overdue && <span className="ws-caption akl-alert">{m.admin_knowledge_list_review_overdue()}</span>}
          </>
        ) : <span className="ws-caption ws-muted">{m.admin_knowledge_list_no_review()}</span>}
      </Stat>
      <Stat label={m.admin_knowledge_list_col_updated()}>
        <span className="ws-strong ws-strong--sm">{formatKnowledgeDate(article.updated_at)}</span>
      </Stat>
      <div className="wt-cell wt-cell--actions">
        <div className="wt-actions">
          <button
            type="button"
            aria-label={m.admin_knowledge_list_edit_aria({ title })}
            className="wt-btn wt-btn--primary"
            onClick={() => onOpen(article)}
          >
            <EditOutlined aria-hidden /><span>{m.admin_knowledge_list_edit()}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
