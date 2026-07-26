import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, Modal, Spin } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BlogPostContent,
  adminBlogKeys,
  createAdminBlogPost,
  getAdminBlogCategories,
  getAdminBlogMedia,
  getAdminBlogPost,
  getAdminBlogTags,
  invalidatePublicBlogCache,
  runAdminBlogAction,
  saveAdminBlogDraft,
  uploadAdminBlogContentImage,
  uploadAdminBlogThumbnail,
} from '@/entities/blog'
import { getJobCategories } from '@/entities/job'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { getEditorCompletion } from '../model/editor-completion'
import { getActionCopy, toFormValues } from '../model/editor-options'
import BlogEditorBody from './BlogEditorBody'
import BlogEditorHeader from './BlogEditorHeader'
import BlogEditorSidebar from './BlogEditorSidebar'
import './blog-post-editor.css'

export default function BlogPostEditor({ publicId }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const watchedValues = Form.useWatch([], form)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [action, setAction] = useState(null)
  const [actionNote, setActionNote] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [conflict, setConflict] = useState(false)
  const initializedId = useRef(null)
  const saveTimer = useRef(null)
  const revision = useRef(1)
  const latestValues = useRef({})

  const postQuery = useQuery({
    queryKey: adminBlogKeys.post(publicId),
    queryFn: ({ signal }) => getAdminBlogPost(publicId, { signal }),
    enabled: Boolean(publicId),
  })
  const categoriesQuery = useQuery({ queryKey: adminBlogKeys.categories, queryFn: getAdminBlogCategories })
  const tagsQuery = useQuery({ queryKey: adminBlogKeys.tags(), queryFn: ({ signal }) => getAdminBlogTags({}, { signal }) })
  const jobsQuery = useQuery({ queryKey: ['job-categories', 'blog-editor'], queryFn: () => getJobCategories() })

  const post = postQuery.data
  const version = post?.editable_version
  const canEdit = !publicId || Boolean(post?.allowed_actions?.includes('edit'))
  useEffect(() => {
    if (!post || initializedId.current === `${post.public_id}:${version?.edit_revision}`) return
    const initialValues = toFormValues(version)
    form.setFieldsValue(initialValues)
    latestValues.current = initialValues
    revision.current = version.edit_revision
    initializedId.current = `${post.public_id}:${version.edit_revision}`
    setSaveState('saved')
  }, [form, post, version])

  const saveMutation = useMutation({
    mutationFn: (payload) => saveAdminBlogDraft(publicId, payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminBlogKeys.post(publicId), saved)
      revision.current = saved.editable_version.edit_revision
      initializedId.current = `${saved.public_id}:${revision.current}`
      setConflict(false)
      setSaveState('saved')
    },
    onError: (error) => {
      if (error.response?.status === 409) setConflict(true)
      setSaveState('error')
    },
  })

  const showValidationErrors = (error) => {
    const errorFields = error.errorFields || []
    const errors = [...new Set(errorFields.flatMap((field) => field.errors || []).filter(Boolean))]
    if (errors.length === 1) message.error(errors[0], { duration: 5000 })
    else if (errors.length > 1) message.error(`Vui lòng hoàn thiện: ${errors.join(' · ')}`, { duration: 6000 })
    else message.error('Vui lòng kiểm tra lại các trường bắt buộc.', { duration: 5000 })
    const firstField = errorFields[0]?.name
    if (firstField) form.scrollToField(firstField, { behavior: 'smooth', block: 'center' })
  }

  const saveNow = useCallback(async ({ notifyValidation = false } = {}) => {
    if (!publicId || conflict || !canEdit) return null
    if (!latestValues.current.title?.trim()) {
      if (notifyValidation) {
        message.error('Nhập tiêu đề bài viết trước khi lưu.', { duration: 5000 })
        form.scrollToField('title', { behavior: 'smooth', block: 'center' })
      }
      return null
    }
    clearTimeout(saveTimer.current)
    setSaveState('saving')
    const { thumbnail_url: _, ...payload } = latestValues.current
    try {
      return await saveMutation.mutateAsync({ ...payload, base_revision: revision.current })
    } catch {
      return null
    }
  }, [canEdit, conflict, form, publicId, saveMutation])

  useEffect(() => () => clearTimeout(saveTimer.current), [])
  useEffect(() => {
    const beforeUnload = (event) => {
      if (saveState !== 'saving') return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [saveState])

  const handleValuesChange = () => {
    latestValues.current = form.getFieldsValue(true)
    if (!publicId || conflict || !canEdit) return
    setSaveState('dirty')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveNow(), 1500)
  }

  const createMutation = useMutation({
    mutationFn: createAdminBlogPost,
    onSuccess: (created) => {
      message.success('Đã tạo bản nháp bài viết.')
      navigate(adminPath(`/blog/${created.public_id}/edit`), { replace: true })
    },
    onError: () => message.error('Không thể tạo bản nháp. Hãy kiểm tra các trường bắt buộc.'),
  })
  const createDraft = async () => {
    try {
      const { thumbnail_url: _, ...payload } = await form.validateFields()
      createMutation.mutate(payload)
    } catch (error) {
      showValidationErrors(error)
    }
  }

  const actionMutation = useMutation({
    mutationFn: ({ name, note }) => runAdminBlogAction(publicId, name, { note }),
    onSuccess: (saved, variables) => {
      queryClient.setQueryData(adminBlogKeys.post(publicId), saved)
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.root })
      invalidatePublicBlogCache(saved.slug)
      setAction(null)
      setActionNote('')
      message.success(`${getActionCopy(variables.name, post?.editorial_state)[2]} thành công.`)
    },
    onError: (error) => {
      const detail = error.response?.data?.detail
      message.error(typeof detail === 'string' ? detail : 'Thao tác không thành công.')
    },
  })

  const startAction = async (name) => {
    if (['submit', 'publish'].includes(name)) {
      try {
        await form.validateFields()
      } catch (error) {
        showValidationErrors(error)
        return
      }
    }
    if (saveState === 'dirty' && !await saveNow()) return
    if (!saveMutation.isPending) setAction(name)
  }
  const confirmAction = () => {
    if (['return', 'archive'].includes(action) && !actionNote.trim()) {
      message.error('Vui lòng nhập lý do.')
      return
    }
    actionMutation.mutate({ name: action, note: actionNote })
  }
  const uploadThumbnail = async (file) => {
    if (!canEdit) return false
    try {
      const uploaded = await uploadAdminBlogThumbnail(file)
      form.setFieldsValue({ thumbnail_storage_key: uploaded.path, thumbnail_url: uploaded.url })
      handleValuesChange()
      message.success('Đã tải ảnh đại diện.')
    } catch {
      message.error('Không thể tải ảnh đại diện.')
    }
    return false
  }

  if (publicId && postQuery.isLoading) return <div className="grid min-h-80 place-items-center"><Spin size="large" /></div>
  if (publicId && postQuery.isError) return <Alert type="error" showIcon title="Không thể tải bài viết" action={<Button onClick={() => postQuery.refetch()}>Thử lại</Button>} />

  const values = watchedValues || latestValues.current || {}
  const allowedActions = post?.allowed_actions || []
  const completion = getEditorCompletion(values)
  const activeActionCopy = action ? getActionCopy(action, post?.editorial_state) : null

  return (
    <section className="blog-editor space-y-4 pb-16">
      <BlogEditorHeader
        allowedActions={allowedActions}
        canEdit={canEdit}
        createLoading={createMutation.isPending}
        isNew={!publicId}
        onBack={() => navigate(adminPath('/blog'))}
        onCreate={createDraft}
        onPreview={() => setPreviewOpen(true)}
        onPublish={() => startAction('publish')}
        onSave={() => saveNow({ notifyValidation: true })}
        onSubmit={() => startAction('submit')}
        post={post}
        saveLoading={saveMutation.isPending}
        saveState={saveState}
        submitLabel={getActionCopy('submit', post?.editorial_state)[2]}
        title={values.title}
      />

      {conflict && <Alert type="warning" showIcon title="Bài viết đã được thay đổi ở phiên khác" description="Autosave đã dừng để tránh ghi đè. Hãy sao chép nội dung local nếu cần rồi tải bản mới nhất." action={<Button onClick={() => window.location.reload()}>Tải bản mới</Button>} />}

      <Form form={form} layout="vertical" requiredMark disabled={!canEdit} onValuesChange={handleValuesChange}>
        <Form.Item name="thumbnail_storage_key" hidden><Input /></Form.Item>
        <Form.Item name="thumbnail_url" hidden><Input /></Form.Item>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <BlogEditorBody categories={categoriesQuery.data || []} categoriesLoading={categoriesQuery.isLoading} disabled={!canEdit} onLoadImages={getAdminBlogMedia} onUploadImage={uploadAdminBlogContentImage} slug={version?.slug} />
          <BlogEditorSidebar
            allowedActions={allowedActions}
            completion={completion}
            disabled={!canEdit}
            jobs={jobsQuery.data || []}
            jobsLoading={jobsQuery.isLoading}
            onAction={startAction}
            onUploadThumbnail={uploadThumbnail}
            post={post}
            slug={version?.slug}
            tags={tagsQuery.data || []}
            tagsError={tagsQuery.isError}
            tagsLoading={tagsQuery.isLoading}
            values={values}
          />
        </div>
      </Form>

      <Drawer title="Xem trước nội dung ứng viên" size="min(900px, 100vw)" open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
          {values.thumbnail_url && <img src={values.thumbnail_url} alt="" className="mb-6 aspect-video w-full rounded-xl object-cover" />}
          <p className="text-sm font-semibold text-[var(--brand-primary)]">{categoriesQuery.data?.find((item) => item.public_id === values.category_public_id)?.name}</p>
          <h1 className="mt-2 break-words text-3xl font-extrabold text-slate-900">{values.title || 'Tiêu đề bài viết'}</h1>
          {values.summary && <p className="mt-3 text-base leading-7 text-slate-600">{values.summary}</p>}
          <BlogPostContent html={values.content || ''} className="mt-6" />
        </article>
      </Drawer>

      <Modal open={Boolean(action)} title={activeActionCopy?.[0] || ''} okText={activeActionCopy?.[2] || 'Xác nhận'} okButtonProps={{ danger: ['archive', 'discard-draft'].includes(action) }} confirmLoading={actionMutation.isPending} onCancel={() => { setAction(null); setActionNote('') }} onOk={confirmAction}>
        <p className="mb-4 text-sm text-slate-600">{activeActionCopy?.[1]}</p>
        {['return', 'archive'].includes(action) && <Input.TextArea value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={4} maxLength={1000} showCount placeholder="Nhập lý do" />}
      </Modal>
    </section>
  )
}
