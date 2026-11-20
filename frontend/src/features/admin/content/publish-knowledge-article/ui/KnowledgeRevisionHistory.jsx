import { HistoryOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button, Card, Tag } from 'antd'
import {
  KNOWLEDGE_REVISION_STATUS,
  formatKnowledgeDate,
  knowledgeErrorMessage,
  publishAdminKnowledgeRevision,
} from '@/entities/content/knowledgebase'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import useArticleSync from '../model/use-article-sync'
import './knowledge-revision-history.css'

function DiffPanel({ draft, published }) {
  if (!draft || !published) return null
  return (
    <div className="knowledge-diff">
      <div>
        <span>Đang công khai · r{published.number}</span>
        <pre>{published.body_plain_text}</pre>
      </div>
      <div>
        <span>Bản nháp · r{draft.number}</span>
        <pre>{draft.body_plain_text}</pre>
      </div>
    </div>
  )
}

/** Lịch sử phiên bản: so sánh bản nháp với bản công khai và công khai lại một bản cũ. */
export default function KnowledgeRevisionHistory({ article, onArticleChange, disabled }) {
  const sync = useArticleSync(onArticleChange)
  const revisions = article?.revisions || []
  const draft = revisions.find((item) => item.status === 'DRAFT')
  const published = revisions.find((item) => item.number === article?.published_revision_number)
  const canRepublish = article?.lifecycle_state === 'ACTIVE' && !disabled

  const republishMutation = useMutation({
    mutationFn: (number) => publishAdminKnowledgeRevision(article.public_id, {
      revision_number: number,
      revision_token: article.revision_token,
    }),
    onSuccess: (saved, number) => {
      sync(saved)
      message.success(`Đã công khai lại bản r${number}.`)
    },
    onError: (error) => message.error(knowledgeErrorMessage(error)),
  })

  if (!revisions.length) return null
  return (
    <Card className="knowledge-history" title={<span><HistoryOutlined /> Phiên bản</span>}>
      <DiffPanel draft={draft} published={published} />
      <ol className="knowledge-history__list">
        {revisions.map((revision) => {
          const live = revision.number === article.published_revision_number
          const status = live ? { label: 'Đang công khai', color: 'success' } : KNOWLEDGE_REVISION_STATUS[revision.status]
          const actor = revision.first_published_by || revision.created_by
          return (
            <li key={revision.number}>
              <div className="knowledge-history__body">
                <div className="knowledge-history__heading">
                  <strong>r{revision.number}</strong>
                  <Tag color={status?.color}>{status?.label || revision.status}</Tag>
                  <small>
                    {formatKnowledgeDate(revision.first_published_at || revision.updated_at, { withTime: true })}
                    {actor?.name ? ` · ${actor.name}` : ''}
                  </small>
                </div>
                {revision.change_summary && <p>{revision.change_summary}</p>}
              </div>
              {canRepublish && revision.status === 'PUBLISHED' && !live && (
                <ConfirmAction
                  cancelText="Hủy"
                  confirmText="Công khai lại"
                  description={`Trang trợ giúp sẽ hiển thị lại nội dung của bản r${revision.number}${draft ? '; bản nháp đang mở vẫn được giữ' : ''}.`}
                  onConfirm={() => republishMutation.mutateAsync(revision.number)}
                  title={`Công khai lại bản r${revision.number}`}
                >
                  <Button size="small" disabled={republishMutation.isPending}>Công khai lại</Button>
                </ConfirmAction>
              )}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
