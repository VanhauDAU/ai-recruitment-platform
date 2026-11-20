import { DeleteOutlined, InboxOutlined, RollbackOutlined, RocketOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button, DatePicker, Modal, Space } from 'antd'
import { useState } from 'react'
import {
  discardAdminKnowledgeDraft,
  knowledgeErrorMessage,
  publishAdminKnowledgeRevision,
  runAdminKnowledgeArticleLifecycle,
} from '@/entities/content/knowledgebase'
import dayjs from '@/shared/lib/dayjs'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import useArticleSync from '../model/use-article-sync'

const findDraft = (article) => article?.revisions?.find((item) => item.status === 'DRAFT')

/**
 * Nháp → Xuất bản (ADR-0024). `prepare()` lưu nội dung đang sửa và trả về bài mới
 * nhất (hoặc null nếu chưa hợp lệ) để luôn xuất bản đúng bản người dùng đang thấy.
 */
export default function KnowledgePublishActions({ article, onArticleChange, dirty, prepare }) {
  const sync = useArticleSync(onArticleChange)
  const [target, setTarget] = useState(null)
  const [reviewDueAt, setReviewDueAt] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const draft = findDraft(article)
  const active = article?.lifecycle_state === 'ACTIVE'

  const publishMutation = useMutation({
    mutationFn: () => publishAdminKnowledgeRevision(target.article.public_id, {
      revision_number: target.draft.number,
      revision_token: target.article.revision_token,
      ...(reviewDueAt ? { review_due_at: reviewDueAt.toISOString() } : {}),
    }),
    onSuccess: (saved) => {
      sync(saved)
      setTarget(null)
      message.success('Đã xuất bản nội dung lên trung tâm trợ giúp.')
    },
    onError: (error) => message.error(knowledgeErrorMessage(error)),
  })
  const discardMutation = useMutation({
    mutationFn: () => discardAdminKnowledgeDraft(article.public_id, draft.number, article.revision_token),
    onSuccess: (saved) => {
      sync(saved)
      message.success('Đã hủy bản nháp. Bài giữ nguyên bản đang công khai.')
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

  const openPublish = async () => {
    setPreparing(true)
    const latest = await prepare()
    setPreparing(false)
    const latestDraft = findDraft(latest)
    if (!latestDraft) return
    setReviewDueAt(dayjs().add(latest.category?.review_interval_days || 180, 'day'))
    setTarget({ article: latest, draft: latestDraft })
  }

  if (!article) return null
  const maxDue = dayjs().add(target?.article.category?.review_interval_days || 180, 'day')
  return (
    <>
      <Space wrap>
        {active && (draft || dirty) && (
          <Button type="primary" icon={<RocketOutlined />} loading={preparing} onClick={openPublish}>
            {draft ? `Xuất bản r${draft.number}` : 'Lưu & xuất bản'}
          </Button>
        )}
        {draft && article.published_revision_number && (
          <ConfirmAction
            cancelText="Giữ bản nháp"
            confirmText="Hủy bản nháp"
            danger
            description={`Bản nháp r${draft.number} và mọi thay đổi chưa lưu sẽ bị xóa. Bài tiếp tục hiển thị bản r${article.published_revision_number}.`}
            onConfirm={() => discardMutation.mutateAsync()}
            title="Hủy bản nháp"
          >
            <Button icon={<DeleteOutlined />} disabled={discardMutation.isPending}>Hủy bản nháp</Button>
          </ConfirmAction>
        )}
        {active ? (
          <ConfirmAction
            cancelText="Hủy"
            confirmText="Lưu trữ"
            danger
            description={(
              <>
                Bạn có chắc muốn lưu trữ <strong>{article.title}</strong>?
                {' '}
                {article.published_revision_number
                  ? 'Bài viết sẽ biến mất khỏi trung tâm trợ giúp công khai.'
                  : 'Bài nháp sẽ được chuyển vào kho lưu trữ.'}
              </>
            )}
            onConfirm={() => lifecycleMutation.mutateAsync('archive')}
            title="Lưu trữ bài viết"
          >
            <Button danger icon={<InboxOutlined />} disabled={dirty || lifecycleMutation.isPending}>
              Lưu trữ
            </Button>
          </ConfirmAction>
        ) : (
          <Button icon={<RollbackOutlined />} loading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate('restore')}>Khôi phục</Button>
        )}
      </Space>
      <Modal
        className="knowledge-workflow-modal"
        open={Boolean(target)}
        title={`Xuất bản bản nháp r${target?.draft.number || ''}`}
        okText="Xuất bản ngay"
        cancelText="Hủy"
        okButtonProps={{ loading: publishMutation.isPending }}
        onCancel={() => setTarget(null)}
        onOk={() => publishMutation.mutate()}
      >
        <p className="text-slate-600">
          {target?.article.published_revision_number
            ? `Bản r${target.draft.number} sẽ thay bản đang công khai r${target.article.published_revision_number}.`
            : 'Bài viết sẽ hiển thị công khai ngay sau khi xuất bản.'}
          {' '}Đặt ngày rà soát để tránh hướng dẫn lỗi thời.
        </p>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="knowledge-review-due">Ngày cần rà soát lại</label>
        <DatePicker id="knowledge-review-due" className="w-full" value={reviewDueAt} minDate={dayjs().add(1, 'day')} maxDate={maxDue} format="DD/MM/YYYY" onChange={setReviewDueAt} />
      </Modal>
    </>
  )
}
