import { FileAddOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Modal } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  KnowledgeArticleContent,
  adminKnowledgeKeys,
  createAdminKnowledgeArticle,
  createAdminKnowledgeRevision,
  isKnowledgeConflict,
  knowledgeErrorMessage,
  updateAdminKnowledgeArticle,
  updateAdminKnowledgeRevision,
} from '@/entities/knowledgebase'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import {
  draftStorageKey,
  editorCompletion,
  newKnowledgeEditorValues,
  revisionToEditorValues,
} from '../model/editor-model'
import KnowledgeEditorFields from './KnowledgeEditorFields'
import NewRevisionModal from './NewRevisionModal'
import './knowledge-revision-editor.css'

function isSameField(left, right) {
  return String(left ?? '') === String(right ?? '')
}

export default function KnowledgeRevisionEditor({
  article,
  categories,
  canManage,
  onArticleChange,
  onDirtyChange,
}) {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [revisionSummary, setRevisionSummary] = useState('')
  const [revisionSummaryTouched, setRevisionSummaryTouched] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  const initialized = useRef('')
  const restoredKeys = useRef(new Set())
  const localSaveTimer = useRef(null)
  const publicId = article?.public_id
  const storageKey = draftStorageKey(publicId)
  const watched = Form.useWatch([], form) || {}
  const draftRevision = article?.revisions?.find((item) => item.status === 'DRAFT')
  const latestRevision = article?.revisions?.[0]
  const canEdit = canManage && (!article || Boolean(draftRevision))
  const completion = editorCompletion(watched)

  useEffect(() => {
    const identity = article
      ? `${article.public_id}:${article.revision_token}:${draftRevision?.number || 'readonly'}`
      : `new:${categories?.[0]?.public_id || 'none'}`
    if (initialized.current === identity) return
    const values = article
      ? revisionToEditorValues(article)
      : newKnowledgeEditorValues(categories)
    if (!values) return
    form.setFieldsValue(values)
    initialized.current = identity
    setDirty(false)
    setConflict(false)
  }, [article, categories, draftRevision?.number, form])

  useEffect(() => {
    onDirtyChange?.(dirty)
    const warn = (event) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!canEdit || restoredKeys.current.has(storageKey)) return
    const raw = localStorage.getItem(storageKey)
    if (!raw) return
    restoredKeys.current.add(storageKey)
    try {
      const local = JSON.parse(raw)
      if (!local?.values || (article && local.revision_token !== article.revision_token)) return
      Modal.confirm({
        title: 'Khôi phục nội dung chưa lưu?',
        content: `Có một bản cục bộ từ ${new Date(local.saved_at).toLocaleString('vi-VN')}.`,
        okText: 'Khôi phục',
        cancelText: 'Bỏ bản cục bộ',
        onOk: () => {
          form.setFieldsValue(local.values)
          setDirty(true)
        },
        onCancel: () => localStorage.removeItem(storageKey),
      })
    } catch {
      localStorage.removeItem(storageKey)
    }
  }, [article, canEdit, form, storageKey])

  useEffect(() => () => window.clearTimeout(localSaveTimer.current), [])

  const handleValuesChange = () => {
    if (!canEdit) return
    setDirty(true)
    window.clearTimeout(localSaveTimer.current)
    localSaveTimer.current = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify({
        values: form.getFieldsValue(true),
        revision_token: article?.revision_token || null,
        saved_at: new Date().toISOString(),
      }))
    }, 400)
  }

  const syncArticle = (saved) => {
    onArticleChange?.(saved)
    if (saved?.public_id) queryClient.setQueryData(adminKnowledgeKeys.article(saved.public_id), saved)
    queryClient.invalidateQueries({ queryKey: adminKnowledgeKeys.root })
    localStorage.removeItem(storageKey)
    setDirty(false)
    setConflict(false)
  }

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (!article) return createAdminKnowledgeArticle({
        category_public_id: values.category_public_id,
        type: values.type,
        order: values.order || 0,
        title: values.title,
        body: values.body,
        source_reference: values.source_reference,
        seo_title: values.seo_title || '',
        seo_description: values.seo_description || '',
      })
      let current = article
      const metadataChanged = !isSameField(values.category_public_id, article.category?.public_id)
        || !isSameField(values.type, article.article_type)
        || !isSameField(values.slug, article.slug)
        || Number(values.order || 0) !== Number(article.order || 0)
      if (metadataChanged) {
        current = await updateAdminKnowledgeArticle(article.public_id, {
          category_public_id: values.category_public_id,
          type: values.type,
          slug: values.slug,
          order: values.order || 0,
          revision_token: current.revision_token,
        })
      }
      return updateAdminKnowledgeRevision(article.public_id, draftRevision.number, {
        title: values.title,
        body: values.body,
        source_reference: values.source_reference,
        change_summary: values.change_summary || '',
        seo_title: values.seo_title || '',
        seo_description: values.seo_description || '',
        revision_token: current.revision_token,
      })
    },
    onSuccess: (saved) => {
      syncArticle(saved)
      message.success(article ? 'Đã lưu bản nháp.' : 'Đã tạo bài viết mới.')
      if (!article) navigate(adminPath(`/knowledgebase/${saved.public_id}`), { replace: true })
    },
    onError: (error) => {
      if (isKnowledgeConflict(error)) setConflict(true)
      message.error(knowledgeErrorMessage(error, 'Không thể lưu bản nháp.'))
    },
  })

  const revisionMutation = useMutation({
    mutationFn: (values) => createAdminKnowledgeRevision(article.public_id, {
      title: values.title,
      body: values.body,
      source_reference: values.source_reference,
      change_summary: values.change_summary || '',
      seo_title: values.seo_title || '',
      seo_description: values.seo_description || '',
      revision_token: article.revision_token,
    }),
    onSuccess: (saved) => {
      syncArticle(saved)
      setRevisionDialogOpen(false)
      setRevisionSummary('')
      setRevisionSummaryTouched(false)
      message.success('Đã tạo revision mới để biên tập.')
    },
    onError: (error) => message.error(knowledgeErrorMessage(error, 'Không thể tạo revision mới.')),
  })

  const save = async () => {
    try {
      saveMutation.mutate(await form.validateFields())
    } catch {
      message.error('Vui lòng hoàn thiện các trường bắt buộc.')
    }
  }
  const openRevisionDialog = () => {
    setRevisionSummary('')
    setRevisionSummaryTouched(false)
    setRevisionDialogOpen(true)
  }
  const createRevision = () => {
    const summary = revisionSummary.trim()
    setRevisionSummaryTouched(true)
    if (article?.first_published_at && !summary) {
      message.error('Nhập tóm tắt thay đổi trước khi tạo revision.')
      return
    }
    revisionMutation.mutate({
      ...form.getFieldsValue(true),
      change_summary: summary,
    })
  }

  return (
    <Form
      className="knowledge-editor"
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
    >
      {conflict && (
        <Alert
          className="knowledge-editor__alert"
          type="warning"
          showIcon
          message="Nội dung trên máy chủ đã thay đổi"
          description="Bản cục bộ vẫn được giữ. Tải lại dữ liệu trước khi lưu để tránh ghi đè công việc của đồng đội."
          action={<Button onClick={() => window.location.reload()}>Tải lại</Button>}
        />
      )}
      {article && !draftRevision && canManage && (
        <Alert
          className="knowledge-editor__alert"
          type={latestRevision?.status === 'IN_REVIEW' ? 'info' : 'warning'}
          showIcon
          message={latestRevision?.status === 'IN_REVIEW' ? 'Revision đang chờ duyệt' : 'Nội dung hiện tại chỉ đọc'}
          description={latestRevision?.status === 'IN_REVIEW'
            ? 'Hoàn tất duyệt hoặc từ chối trước khi tạo bản chỉnh sửa tiếp theo.'
            : 'Tạo revision mới từ nội dung gần nhất để bắt đầu chỉnh sửa.'}
          action={latestRevision?.status !== 'IN_REVIEW' && (
            <Button icon={<FileAddOutlined />} loading={revisionMutation.isPending} onClick={openRevisionDialog}>
              Tạo revision mới
            </Button>
          )}
        />
      )}

      <KnowledgeEditorFields
        article={article}
        canEdit={canEdit}
        categories={categories}
        completion={completion}
        conflict={conflict}
        dirty={dirty}
        saving={saveMutation.isPending}
        type={watched.type}
        onPreview={() => setPreviewOpen(true)}
        onSave={save}
      />

      <Drawer width={820} open={previewOpen} title="Xem trước nội dung" onClose={() => setPreviewOpen(false)}>
        <div className="knowledge-preview">
          <span className="knowledge-preview__eyebrow">{categories?.find((item) => item.public_id === watched.category_public_id)?.name || 'Trung tâm trợ giúp'}</span>
          <h1>{watched.title || 'Tiêu đề bài viết'}</h1>
          <KnowledgeArticleContent html={watched.body} />
        </div>
      </Drawer>

      <NewRevisionModal
        open={revisionDialogOpen}
        required={Boolean(article?.first_published_at)}
        loading={revisionMutation.isPending}
        summary={revisionSummary}
        touched={revisionSummaryTouched}
        onCancel={() => setRevisionDialogOpen(false)}
        onChange={setRevisionSummary}
        onConfirm={createRevision}
        onTouch={() => setRevisionSummaryTouched(true)}
      />
    </Form>
  )
}
