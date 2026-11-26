import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form } from 'antd'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
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
} from '@/entities/content/knowledgebase'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import {
  draftStorageKey,
  editorCompletion,
  newKnowledgeEditorValues,
  revisionToEditorValues,
} from '../model/editor-model'
import KnowledgeEditorFields from './KnowledgeEditorFields'
import './knowledge-revision-editor.css'
import { getIntlLocale } from '@/shared/config/i18n'

function isSameField(left, right) {
  return String(left ?? '') === String(right ?? '')
}

/**
 * Soạn nội dung FAQ/hướng dẫn. Bài đang công khai vẫn sửa trực tiếp: lần lưu đầu
 * tạo bản nháp mới, bản công khai giữ nguyên tới khi xuất bản (ADR-0024).
 * `ref.saveDraft()` cho widget lưu trước khi mở hộp thoại xuất bản.
 */
export default function KnowledgeRevisionEditor({
  article,
  categories,
  onArticleChange,
  onDirtyChange,
  ref,
}) {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  const initialized = useRef('')
  const restoredKeys = useRef(new Set())
  const localSaveTimer = useRef(null)
  const publicId = article?.public_id
  const storageKey = draftStorageKey(publicId)
  const watched = Form.useWatch([], form) || {}
  const draftRevision = article?.revisions?.find((item) => item.status === 'DRAFT')
  const canEdit = !article || article.lifecycle_state !== 'ARCHIVED'
  const completion = editorCompletion(watched)

  useEffect(() => {
    const identity = article
      ? `${article.public_id}:${article.revision_token}:${draftRevision?.number || 'next'}`
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
      requestConfirmation({
        title: 'Khôi phục nội dung chưa lưu',
        description: (
          <>
            Bạn có muốn khôi phục bản cục bộ từ{' '}
            <strong>{new Date(local.saved_at).toLocaleString(getIntlLocale())}</strong> không?
            <br />
            Nếu đóng, bản cục bộ vẫn được giữ để bạn quyết định sau.
          </>
        ),
        confirmText: 'Khôi phục',
        cancelText: 'Đóng',
        onConfirm: () => {
          form.setFieldsValue(local.values)
          setDirty(true)
        },
      })
    } catch {
      localStorage.removeItem(storageKey)
    }
  }, [article, canEdit, form, requestConfirmation, storageKey])

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
      const content = {
        title: values.title,
        body: values.body,
        source_reference: values.source_reference,
        change_summary: values.change_summary || '',
        seo_title: values.seo_title || '',
        seo_description: values.seo_description || '',
        revision_token: current.revision_token,
      }
      return draftRevision
        ? updateAdminKnowledgeRevision(article.public_id, draftRevision.number, content)
        : createAdminKnowledgeRevision(article.public_id, content)
    },
    onSuccess: (saved) => {
      syncArticle(saved)
      if (!article) message.success('Đã tạo bài viết mới.')
      else if (draftRevision) message.success('Đã lưu bản nháp.')
      else message.success('Đã tạo bản nháp mới. Bản đang công khai chưa thay đổi cho tới khi xuất bản.')
      if (!article) navigate(adminPath(`/tro-giup/${saved.public_id}`), { replace: true })
    },
    onError: (error) => {
      if (isKnowledgeConflict(error)) setConflict(true)
      message.error(knowledgeErrorMessage(error, 'Không thể lưu bản nháp.'))
    },
  })

  const saveDraft = async () => {
    if (!dirty) return article
    try {
      return await saveMutation.mutateAsync(await form.validateFields())
    } catch (error) {
      if (error?.errorFields) message.error('Vui lòng hoàn thiện các trường bắt buộc.')
      return null
    }
  }
  useImperativeHandle(ref, () => ({ saveDraft }))

  return (
    <>
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
          title="Nội dung trên máy chủ đã thay đổi"
          description="Bản cục bộ vẫn được giữ. Tải lại dữ liệu trước khi lưu để tránh ghi đè công việc của đồng đội."
          action={<Button onClick={() => window.location.reload()}>Tải lại</Button>}
        />
      )}
      {article && !canEdit && (
        <Alert className="knowledge-editor__alert" type="warning" showIcon title="Bài viết đã lưu trữ. Khôi phục bài để tiếp tục chỉnh sửa." />
      )}
      {canEdit && draftRevision && article?.published_revision_number && (
        <Alert className="knowledge-editor__alert" type="info" showIcon title={`Bạn đang sửa bản nháp r${draftRevision.number}. Bản công khai r${article.published_revision_number} giữ nguyên cho tới khi xuất bản.`} />
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
        onSave={() => saveDraft()}
      />

      <Drawer width={820} open={previewOpen} title="Xem trước nội dung" onClose={() => setPreviewOpen(false)}>
        <div className="knowledge-preview">
          <span className="knowledge-preview__eyebrow">{categories?.find((item) => item.public_id === watched.category_public_id)?.name || 'Trung tâm trợ giúp'}</span>
          <h1>{watched.title || 'Tiêu đề bài viết'}</h1>
          <KnowledgeArticleContent html={watched.body} />
        </div>
      </Drawer>

      </Form>
      {confirmationModal}
    </>
  )
}
