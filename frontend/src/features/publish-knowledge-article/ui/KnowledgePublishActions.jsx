import { InboxOutlined, RollbackOutlined, RocketOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Modal, Space } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import {
  adminKnowledgeKeys,
  knowledgeErrorMessage,
  publishAdminKnowledgeRevision,
  runAdminKnowledgeArticleLifecycle,
} from '@/entities/knowledgebase'
import { message } from '@/shared/lib/toast'

export default function KnowledgePublishActions({ article, canPublish, onArticleChange, disabled }) {
  const queryClient = useQueryClient()
  const [publishOpen, setPublishOpen] = useState(false)
  const [reviewDueAt, setReviewDueAt] = useState(null)
  const approved = article?.revisions?.find((item) => item.status === 'APPROVED')
  const sync = (saved) => {
    onArticleChange?.(saved)
    queryClient.setQueryData(adminKnowledgeKeys.article(saved.public_id), saved)
    queryClient.invalidateQueries({ queryKey: adminKnowledgeKeys.root })
  }

  const publishMutation = useMutation({
    mutationFn: () => publishAdminKnowledgeRevision(article.public_id, {
      revision_number: approved.number,
      revision_token: article.revision_token,
      ...(reviewDueAt ? { review_due_at: reviewDueAt.toISOString() } : {}),
    }),
    onSuccess: (saved) => {
      sync(saved)
      setPublishOpen(false)
      message.success('Đã xuất bản nội dung lên trung tâm trợ giúp.')
    },
    onError: (error) => message.error(knowledgeErrorMessage(error)),
  })
  const lifecycleMutation = useMutation({
    mutationFn: (action) => runAdminKnowledgeArticleLifecycle(article.public_id, action, article.revision_token),
    onSuccess: (saved, action) => {
      sync(saved)
      message.success(action === 'archive' ? 'Đã lưu trữ bài viết.' : 'Đã khôi phục bài viết.')
    },
    onError: (error) => message.error(knowledgeErrorMessage(error)),
  })

  if (!article || !canPublish) return null
  return (
    <>
      <Space wrap>
        {approved && approved.number !== article.published_revision_number && article.lifecycle_state === 'ACTIVE' && (
          <Button type="primary" icon={<RocketOutlined />} disabled={disabled} onClick={() => {
            const defaultDue = dayjs().add(article.category?.review_interval_days || 180, 'day')
            setReviewDueAt(defaultDue)
            setPublishOpen(true)
          }}>
            Xuất bản r{approved.number}
          </Button>
        )}
        {article.lifecycle_state === 'ACTIVE' ? (
          <Button danger icon={<InboxOutlined />} disabled={disabled} onClick={() => Modal.confirm({
            title: 'Lưu trữ bài viết?',
            content: article.published_revision_number ? 'Bài viết sẽ biến mất khỏi trung tâm trợ giúp công khai.' : 'Bài nháp sẽ được chuyển vào kho lưu trữ.',
            okText: 'Lưu trữ',
            okButtonProps: { danger: true },
            cancelText: 'Hủy',
            onOk: () => lifecycleMutation.mutate('archive'),
          })}>Lưu trữ</Button>
        ) : (
          <Button icon={<RollbackOutlined />} disabled={disabled} loading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate('restore')}>Khôi phục</Button>
        )}
      </Space>
      <Modal
        className="knowledge-workflow-modal"
        open={publishOpen}
        title={`Xuất bản revision r${approved?.number || ''}`}
        okText="Xuất bản ngay"
        cancelText="Hủy"
        okButtonProps={{ loading: publishMutation.isPending }}
        onCancel={() => setPublishOpen(false)}
        onOk={() => publishMutation.mutate()}
      >
        <p className="text-slate-600">Nội dung sẽ hiển thị công khai ngay sau khi xuất bản. Hãy đặt ngày rà soát để tránh hướng dẫn lỗi thời.</p>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="knowledge-review-due">Ngày cần rà soát lại</label>
        <DatePicker id="knowledge-review-due" className="w-full" value={reviewDueAt} minDate={dayjs().add(1, 'day')} format="DD/MM/YYYY" onChange={setReviewDueAt} />
      </Modal>
    </>
  )
}
