import { CheckOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Input, Modal, Space, Tag, Timeline } from 'antd'
import { useState } from 'react'
import {
  KNOWLEDGE_REVISION_STATUS,
  adminKnowledgeKeys,
  formatKnowledgeDate,
  knowledgeErrorMessage,
  runAdminKnowledgeRevisionAction,
} from '@/entities/knowledgebase'
import { message } from '@/shared/lib/toast'
import './knowledge-revision-review.css'

function DiffPanel({ current, published }) {
  if (!published || published.number === current?.number) return null
  return (
    <div className="knowledge-diff">
      <div>
        <span>Bản đang công khai · r{published.number}</span>
        <pre>{published.body_plain_text}</pre>
      </div>
      <div>
        <span>Revision đang xét · r{current.number}</span>
        <pre>{current.body_plain_text}</pre>
      </div>
    </div>
  )
}

export default function KnowledgeRevisionReview({ article, canManage, canReview, onArticleChange, disabled }) {
  const queryClient = useQueryClient()
  const [action, setAction] = useState(null)
  const [note, setNote] = useState('')
  const current = article?.revisions?.[0]
  const published = article?.revisions?.find((item) => item.number === article.published_revision_number)
  const status = KNOWLEDGE_REVISION_STATUS[current?.status]
  const nextStep = {
    DRAFT: 'Lưu nội dung hoàn chỉnh, sau đó gửi revision cho người duyệt.',
    IN_REVIEW: 'Kiểm tra nội dung, nguồn và hình ảnh trước khi duyệt hoặc yêu cầu chỉnh sửa.',
    APPROVED: 'Revision đã được duyệt và sẵn sàng để người có quyền xuất bản.',
    REJECTED: 'Revision cần được chỉnh sửa theo ghi chú của người duyệt.',
  }[current?.status]

  const mutation = useMutation({
    mutationFn: ({ name, reviewNote }) => runAdminKnowledgeRevisionAction(
      article.public_id,
      current.number,
      name,
      { revision_token: article.revision_token, review_note: reviewNote },
    ),
    onSuccess: (saved, variables) => {
      onArticleChange?.(saved)
      queryClient.setQueryData(adminKnowledgeKeys.article(saved.public_id), saved)
      queryClient.invalidateQueries({ queryKey: adminKnowledgeKeys.root })
      setAction(null)
      setNote('')
      const labels = { submit: 'Đã gửi revision đi duyệt.', approve: 'Đã duyệt revision.', reject: 'Đã trả revision để chỉnh sửa.' }
      message.success(labels[variables.name])
    },
    onError: (error) => message.error(knowledgeErrorMessage(error)),
  })

  const openAction = (name) => {
    setNote('')
    setAction(name)
  }
  const confirm = () => {
    if (action === 'reject' && !note.trim()) {
      message.error('Nhập lý do cần chỉnh sửa.')
      return
    }
    mutation.mutate({ name: action, reviewNote: note.trim() })
  }

  if (!article || !current) return null
  return (
    <Card
      className="knowledge-workflow-card"
      title="Quy trình biên tập"
      extra={<Tag color={status?.color}>{status?.label || current.status}</Tag>}
    >
      <div className="knowledge-workflow-card__next">
        <div className="knowledge-workflow-card__next-copy">
          <span className="knowledge-workflow-card__next-label">Bước tiếp theo</span>
          <strong>{nextStep}</strong>
        </div>
        <Space className="knowledge-workflow-card__actions" size={8} wrap>
          {current.status === 'DRAFT' && canManage && (
            <Button size="small" type="primary" icon={<SendOutlined />} disabled={disabled} onClick={() => openAction('submit')}>Gửi duyệt</Button>
          )}
          {current.status === 'IN_REVIEW' && canReview && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />} disabled={disabled} onClick={() => openAction('approve')}>Duyệt revision</Button>
              <Button size="small" danger icon={<CloseOutlined />} disabled={disabled} onClick={() => openAction('reject')}>Yêu cầu chỉnh sửa</Button>
            </>
          )}
        </Space>
      </div>
      {current.review_note && (
        <Alert className="knowledge-workflow-card__note" type={current.status === 'REJECTED' ? 'warning' : 'info'} showIcon message="Ghi chú của người duyệt" description={current.review_note} />
      )}
      <div className="knowledge-workflow-card__summary">
        <div><span>Revision</span><strong>r{current.number}</strong></div>
        <div><span>Người tạo</span><strong>{current.created_by?.name || 'Hệ thống'}</strong></div>
        <div><span>Cập nhật</span><strong>{formatKnowledgeDate(current.updated_at, { withTime: true })}</strong></div>
      </div>
      {current.change_summary && <p className="knowledge-workflow-card__change"><strong>Thay đổi:</strong> {current.change_summary}</p>}
      <DiffPanel current={current} published={published} />
      <div className="knowledge-workflow-history">
        <strong>Lịch sử revision</strong>
        <Timeline
          items={(article.revisions || []).slice(0, 8).map((revision) => ({
            color: revision.status === 'APPROVED' ? 'green' : revision.status === 'REJECTED' ? 'red' : 'blue',
            content: (
              <div>
                <span>r{revision.number} · {KNOWLEDGE_REVISION_STATUS[revision.status]?.label || revision.status}</span>
                <small>{formatKnowledgeDate(revision.created_at, { withTime: true })}</small>
              </div>
            ),
          }))}
        />
      </div>

      <Modal
        className="knowledge-workflow-modal"
        open={Boolean(action)}
        title={action === 'submit' ? 'Gửi revision đi duyệt' : action === 'approve' ? 'Duyệt revision' : 'Yêu cầu chỉnh sửa'}
        okText={action === 'submit' ? 'Gửi duyệt' : action === 'approve' ? 'Duyệt' : 'Trả lại'}
        okButtonProps={{ danger: action === 'reject', loading: mutation.isPending }}
        cancelText="Hủy"
        onCancel={() => setAction(null)}
        onOk={confirm}
      >
        <p className="text-slate-600">Revision r{current.number}: {current.title}</p>
        <Input.TextArea
          rows={4}
          maxLength={1000}
          showCount
          value={note}
          placeholder={action === 'reject' ? 'Nêu rõ phần cần chỉnh sửa…' : 'Ghi chú cho người tiếp theo (không bắt buộc)…'}
          onChange={(event) => setNote(event.target.value)}
        />
      </Modal>
    </Card>
  )
}
