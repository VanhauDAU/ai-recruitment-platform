import {
  CheckCircleOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
  RollbackOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS, getEventCoordinates } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { cloneElement, createContext, isValidElement, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  adminBlogKeys,
  createAdminBlogCategory,
  createAdminBlogPin,
  deleteAdminBlogPin,
  getAdminBlogCategories,
  getAdminBlogPins,
  getAdminBlogPosts,
  getAdminBlogSummary,
  invalidatePublicBlogCache,
  reorderAdminBlogCategories,
  reorderAdminBlogPins,
  runAdminBlogAction,
  updateAdminBlogCategory,
  updateAdminBlogPin,
} from '@/entities/blog'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'

const STATUS_OPTIONS = [
  ['draft', 'Nháp'],
  ['pending', 'Chờ duyệt'],
  ['published', 'Đã xuất bản'],
  ['published_with_draft', 'Có bản sửa nháp'],
  ['published_with_pending', 'Bản sửa chờ duyệt'],
  ['archived', 'Đã gỡ'],
].map(([value, label]) => ({ value, label }))

const POST_STATUS_ACTIONS = [
  {
    action: 'submit',
    label: 'Gửi duyệt',
    targetLabel: 'Chờ duyệt',
    description: 'Chuyển bản nháp sang hàng chờ duyệt.',
    confirmTitle: 'Gửi bài viết để duyệt?',
    confirmText: 'Gửi duyệt',
    icon: SendOutlined,
    tone: 'amber',
  },
  {
    action: 'publish',
    label: 'Xuất bản',
    targetLabel: 'Đã xuất bản',
    description: 'Hiển thị bài viết cho ứng viên.',
    confirmTitle: 'Xuất bản bài viết?',
    confirmText: 'Xuất bản',
    icon: CheckCircleOutlined,
    tone: 'emerald',
  },
  {
    action: 'return',
    label: 'Trả về nháp',
    targetLabel: 'Nháp',
    description: 'Trả bài chờ duyệt về cho người viết chỉnh sửa.',
    confirmTitle: 'Trả bài viết về nháp?',
    confirmText: 'Trả về nháp',
    icon: RollbackOutlined,
    tone: 'blue',
    noteRequired: true,
  },
  {
    action: 'archive',
    label: 'Ẩn bài viết',
    targetLabel: 'Đã gỡ',
    description: 'Ẩn bài khỏi phía ứng viên nhưng vẫn giữ trong quản trị.',
    confirmTitle: 'Ẩn bài viết?',
    confirmText: 'Ẩn bài viết',
    icon: EyeInvisibleOutlined,
    tone: 'rose',
    noteRequired: true,
    danger: true,
  },
  {
    action: 'restore',
    label: 'Khôi phục',
    targetLabel: 'Nháp',
    description: 'Khôi phục bài đã ẩn về nháp để chỉnh sửa.',
    confirmTitle: 'Khôi phục bài viết về nháp?',
    confirmText: 'Khôi phục',
    icon: RollbackOutlined,
    tone: 'violet',
  },
]

const DROP_TONE_CLASSES = {
  amber: 'border-amber-300 bg-amber-50 text-amber-900',
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  blue: 'border-blue-300 bg-blue-50 text-blue-900',
  rose: 'border-rose-300 bg-rose-50 text-rose-900',
  violet: 'border-violet-300 bg-violet-50 text-violet-900',
}

const POST_ACTION_SUCCESS_PREFIX = {
  submit: 'Đã gửi duyệt',
  publish: 'Đã xuất bản',
  return: 'Đã trả về nháp',
  archive: 'Đã ẩn',
  restore: 'Đã khôi phục',
}

function statusColor(state) {
  if (state === 'published') return 'green'
  if (state.includes('pending')) return 'gold'
  if (state === 'archived') return 'red'
  return 'blue'
}

function useRefresh() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: adminBlogKeys.root })
}

function getActionErrorMessage(error) {
  const data = error.response?.data
  if (typeof data?.detail === 'string') return data.detail
  const firstFieldError = data && Object.values(data).flat().find((item) => typeof item === 'string')
  return firstFieldError || 'Không thể đổi trạng thái bài viết. Vui lòng thử lại.'
}

function snapPostOverlayToCursor({ activatorEvent, activeNodeRect, overlayNodeRect, transform }) {
  if (!activatorEvent || !activeNodeRect || !overlayNodeRect) return transform
  const cursor = getEventCoordinates(activatorEvent)
  if (!cursor) return transform
  return {
    ...transform,
    x: transform.x + cursor.x - activeNodeRect.left - overlayNodeRect.width / 2,
    y: transform.y + cursor.y - activeNodeRect.top - overlayNodeRect.height / 2,
  }
}

function canTransitionPost(post) {
  return POST_STATUS_ACTIONS.some((action) => post.allowed_actions?.includes(action.action))
}

function PostDragHandle({ post, disabled = false }) {
  const draggable = useDraggable({
    id: post.public_id,
    disabled,
    data: { post },
  })
  return (
    <button
      ref={draggable.setNodeRef}
      {...draggable.attributes}
      {...draggable.listeners}
      type="button"
      disabled={disabled}
      className={`grid min-h-11 min-w-11 touch-none place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-35 ${draggable.isDragging ? 'cursor-grabbing border-emerald-400 bg-emerald-50 text-emerald-700' : 'cursor-grab'}`}
      aria-label={disabled ? `Không có quyền đổi trạng thái bài “${post.title}”` : `Kéo bài “${post.title}” để đổi trạng thái`}
      title={disabled ? 'Bạn không có thao tác trạng thái hợp lệ' : 'Kéo vào vùng trạng thái'}
    >
      <HolderOutlined />
    </button>
  )
}

function PostStatusDropZone({ action, activePosts }) {
  const enabled = activePosts.length > 0 && activePosts.every((post) => post.allowed_actions?.includes(action.action))
  const droppable = useDroppable({
    id: action.action,
    disabled: !enabled,
    data: { action: action.action },
  })
  const Icon = action.icon
  const FeedbackIcon = droppable.isOver ? CheckCircleOutlined : Icon
  return (
    <div
      ref={droppable.setNodeRef}
      data-testid={`post-status-drop-${action.action}`}
      aria-disabled={!enabled}
      className={`min-h-20 min-w-0 flex-1 rounded-xl border-2 border-dashed px-3 py-3 transition duration-200 motion-reduce:transition-none sm:min-w-36 ${
        enabled
          ? `${DROP_TONE_CLASSES[action.tone]} ${droppable.isOver ? 'scale-[1.04] border-solid shadow-xl ring-4 ring-emerald-200/70' : 'opacity-90'}`
          : 'border-slate-200 bg-slate-100 text-slate-400 opacity-55'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg bg-white/80 shadow-sm ${droppable.isOver ? 'text-lg text-emerald-700' : ''}`}><FeedbackIcon /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{action.label}</p>
          <p className={`truncate text-[11px] ${droppable.isOver ? 'font-bold' : ''}`}>
            {droppable.isOver ? 'Thả chuột để chọn' : enabled ? action.targetLabel : 'Không hợp lệ'}
          </p>
        </div>
      </div>
    </div>
  )
}

function actionMenuItems(posts) {
  return POST_STATUS_ACTIONS
    .filter((item) => posts.length > 0 && posts.every((post) => post.allowed_actions?.includes(item.action)))
    .map((item) => ({
      key: item.action,
      danger: item.danger,
      icon: <item.icon />,
      label: item.label,
    }))
}

function PostActionMenu({ post, onAction }) {
  const items = actionMenuItems([post])
  if (!items.length) return null
  return (
    <Dropdown
      trigger={['click']}
      menu={{ items, onClick: ({ key }) => onAction([post], key) }}
    >
      <Button icon={<MoreOutlined />} aria-label={`Đổi trạng thái bài “${post.title}”`}>Trạng thái</Button>
    </Dropdown>
  )
}

function BulkPostActionMenu({ posts, onAction }) {
  const items = actionMenuItems(posts)
  if (!items.length) return <Button disabled>Không có trạng thái chung</Button>
  return (
    <Dropdown
      trigger={['click']}
      menu={{ items, onClick: ({ key }) => onAction(posts, key) }}
    >
      <Button icon={<MoreOutlined />}>Đổi trạng thái {posts.length} bài</Button>
    </Dropdown>
  )
}

function PostList({ canManage }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState()
  const [category, setCategory] = useState()
  const [page, setPage] = useState(1)
  const [selectedPostIds, setSelectedPostIds] = useState([])
  const [activePosts, setActivePosts] = useState([])
  const [overActionName, setOverActionName] = useState(null)
  const activePostsRef = useRef([])
  const [pendingAction, setPendingAction] = useState(null)
  const [actionNote, setActionNote] = useState('')
  const params = useMemo(() => ({ q: q || undefined, status, category, page, page_size: 20 }), [category, page, q, status])
  const postsQuery = useQuery({ queryKey: adminBlogKeys.posts(params), queryFn: ({ signal }) => getAdminBlogPosts(params, { signal }) })
  const summaryQuery = useQuery({ queryKey: adminBlogKeys.summary, queryFn: getAdminBlogSummary })
  const categoriesQuery = useQuery({ queryKey: adminBlogKeys.categories, queryFn: getAdminBlogCategories })
  const rows = postsQuery.data?.results || []
  const selectablePosts = rows.filter(canTransitionPost)
  const selectedPosts = selectablePosts.filter((post) => selectedPostIds.includes(post.public_id))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => setSelectedPostIds([]), [category, page, q, status])

  const actionMutation = useMutation({
    mutationFn: async ({ posts, action, note }) => {
      const results = await Promise.allSettled(
        posts.map((post) => runAdminBlogAction(post.public_id, action, { note })),
      )
      return {
        succeeded: results.flatMap((result, index) => result.status === 'fulfilled' ? [{ saved: result.value, post: posts[index] }] : []),
        failed: results.flatMap((result, index) => result.status === 'rejected' ? [{ error: result.reason, post: posts[index] }] : []),
      }
    },
    onSuccess: async ({ succeeded, failed }, variables) => {
      succeeded.forEach(({ saved, post }) => invalidatePublicBlogCache(saved.slug || post.slug))
      await queryClient.invalidateQueries({ queryKey: adminBlogKeys.root })
      setPendingAction(null)
      setActionNote('')
      setSelectedPostIds([])
      const copy = POST_STATUS_ACTIONS.find((item) => item.action === variables.action)
      if (failed.length) {
        message.error(`Đã xử lý ${succeeded.length}/${variables.posts.length} bài. ${getActionErrorMessage(failed[0].error)}`, { duration: 6000 })
      } else if (variables.posts.length > 1) {
        message.success(`${POST_ACTION_SUCCESS_PREFIX[variables.action]} ${variables.posts.length} bài viết.`)
      } else {
        message.success(`${copy?.confirmText || 'Đổi trạng thái'} thành công.`)
      }
    },
    onError: (error) => message.error(getActionErrorMessage(error), { duration: 5000 }),
  })

  const openActionConfirmation = (posts, actionName) => {
    const action = POST_STATUS_ACTIONS.find((item) => item.action === actionName)
    if (!action || !posts.length || !posts.every((post) => post.allowed_actions?.includes(actionName))) return
    setActionNote('')
    setPendingAction({ posts, action })
  }

  const finishPostDrag = ({ active, over }) => {
    const post = active.data.current?.post
    const draggedPosts = activePostsRef.current.length ? activePostsRef.current : (post ? [post] : [])
    activePostsRef.current = []
    setActivePosts([])
    setOverActionName(null)
    if (!post || !over) return
    openActionConfirmation(draggedPosts, over.id)
  }

  const confirmStatusAction = () => {
    if (!pendingAction) return
    if (pendingAction.action.noteRequired && !actionNote.trim()) {
      message.error('Vui lòng nhập lý do trước khi xác nhận.')
      return
    }
    actionMutation.mutate({
      posts: pendingAction.posts,
      action: pendingAction.action.action,
      note: actionNote.trim(),
    })
  }

  const columns = [
    {
      title: <span className="sr-only">Kéo thả</span>,
      key: 'drag',
      width: 64,
      render: (_, row) => <PostDragHandle post={row} disabled={!canTransitionPost(row)} />,
    },
    {
      title: 'Bài viết',
      key: 'post',
      width: 420,
      render: (_, row) => (
        <div className="flex min-w-0 gap-3">
          {row.thumbnail_url ? <img src={row.thumbnail_url} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" /> : <div className="grid h-16 w-24 shrink-0 place-items-center rounded-lg bg-slate-100 text-2xl font-bold text-slate-300">{row.title?.[0]}</div>}
          <div className="min-w-0"><p className="line-clamp-2 font-semibold text-slate-800">{row.title}</p><p className="mt-1 truncate text-xs text-slate-400">/blog/{row.slug}</p></div>
        </div>
      ),
    },
    { title: 'Danh mục', dataIndex: ['category', 'name'], width: 180 },
    { title: 'Tác giả', dataIndex: ['author', 'name'], width: 180, render: (value) => value || 'Không xác định' },
    { title: 'Trạng thái', width: 190, render: (_, row) => <Tag color={statusColor(row.editorial_state)}>{row.editorial_state_label}</Tag> },
    { title: 'Hoàn thiện', width: 130, render: (_, row) => <Progress percent={row.completeness.score} size="small" /> },
    { title: 'Lượt xem', dataIndex: 'view_count', width: 100 },
    { title: 'Cập nhật', dataIndex: 'updated_at', width: 150, render: (value) => new Date(value).toLocaleDateString('vi-VN') },
    {
      title: 'Thao tác',
      fixed: 'right',
      width: 230,
      render: (_, row) => (
        <Space size={8}>
          <Button icon={<EditOutlined />} onClick={() => navigate(adminPath(`/blog/${row.public_id}/edit`))}>{row.allowed_actions.includes('edit') ? 'Sửa' : 'Xem'}</Button>
          <PostActionMenu post={row} onAction={openActionConfirmation} />
        </Space>
      ),
    },
  ]

  const stats = summaryQuery.data || {}
  const overAction = POST_STATUS_ACTIONS.find((action) => action.action === overActionName)
  const allVisibleSelected = selectablePosts.length > 0 && selectedPosts.length === selectablePosts.length
  const someVisibleSelected = selectedPosts.length > 0 && !allVisibleSelected
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {[['all', 'Tất cả'], ...STATUS_OPTIONS.map((item) => [item.value, item.label])].map(([key, label]) => (
          <button key={key} type="button" className="text-left" aria-pressed={(key === 'all' && !status) || status === key} onClick={() => { setStatus(key === 'all' ? undefined : key); setPage(1) }}>
            <Card size="small" className="h-full cursor-pointer transition hover:border-emerald-300">
              <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{stats[key] || 0}</p>
            </Card>
          </button>
        ))}
      </div>
      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm tiêu đề hoặc slug" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} />
            <Select allowClear placeholder="Trạng thái" value={status} options={STATUS_OPTIONS} onChange={(value) => { setStatus(value); setPage(1) }} />
            <Select allowClear placeholder="Danh mục" value={category} options={(categoriesQuery.data || []).map((item) => ({ value: item.public_id, label: item.name }))} onChange={(value) => { setCategory(value); setPage(1) }} />
          </div>
          {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(adminPath('/blog/new'))}>Tạo bài viết</Button>}
        </div>
        {selectedPosts.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div>
              <p className="font-semibold text-blue-950">Đã chọn {selectedPosts.length} bài viết</p>
              <p className="text-xs text-blue-700">Kéo tay nắm của một bài đã chọn để di chuyển cả nhóm.</p>
            </div>
            <Space wrap>
              <Button onClick={() => setSelectedPostIds([])}>Bỏ chọn</Button>
              <BulkPostActionMenu posts={selectedPosts} onAction={openActionConfirmation} />
            </Space>
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={({ active }) => {
            const post = active.data.current?.post
            if (!post) return
            const posts = selectedPostIds.includes(post.public_id) && selectedPosts.length > 0 ? selectedPosts : [post]
            activePostsRef.current = posts
            setActivePosts(posts)
          }}
          onDragOver={({ over }) => setOverActionName(over?.id || null)}
          onDragCancel={() => {
            activePostsRef.current = []
            setActivePosts([])
            setOverActionName(null)
          }}
          onDragEnd={finishPostDrag}
        >
          <div className="hidden overflow-x-auto md:block">
            <Table
              rowKey="public_id"
              loading={postsQuery.isLoading}
              dataSource={rows}
              columns={columns}
              rowSelection={selectablePosts.length ? {
                selectedRowKeys: selectedPostIds,
                onChange: setSelectedPostIds,
                columnTitle: <span className="sr-only">Chọn bài viết</span>,
                getCheckboxProps: (row) => ({
                  'aria-label': `Chọn bài “${row.title}”`,
                  disabled: !canTransitionPost(row),
                }),
              } : undefined}
              scroll={{ x: 1680 }}
              pagination={{ current: page, pageSize: 20, total: postsQuery.data?.count || 0, showSizeChanger: false, onChange: setPage }}
            />
          </div>
          <div className="space-y-3 md:hidden">
            {selectablePosts.length > 0 && (
              <label className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm font-medium text-slate-700">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onChange={(event) => setSelectedPostIds(event.target.checked ? selectablePosts.map((row) => row.public_id) : [])}
                />
                Chọn tất cả bài trên trang
              </label>
            )}
            {rows.map((row) => (
              <Card key={row.public_id} size="small">
                <div className="flex gap-3">
                  <label className="grid min-h-11 min-w-8 place-items-center" aria-label={`Chọn bài “${row.title}”`}>
                    <Checkbox
                      checked={selectedPostIds.includes(row.public_id)}
                      disabled={!canTransitionPost(row)}
                      onChange={(event) => setSelectedPostIds((current) => event.target.checked
                        ? [...new Set([...current, row.public_id])]
                        : current.filter((id) => id !== row.public_id))}
                    />
                  </label>
                  <PostDragHandle post={row} disabled={!canTransitionPost(row)} />
                  {row.thumbnail_url && <img src={row.thumbnail_url} alt="" className="h-16 w-24 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-800">{row.title}</p><Tag className="mt-2" color={statusColor(row.editorial_state)}>{row.editorial_state_label}</Tag></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Progress percent={row.completeness.score} size="small" className="min-w-32 flex-1" />
                  <Space size={8}>
                    <Button onClick={() => navigate(adminPath(`/blog/${row.public_id}/edit`))}>Mở</Button>
                    <PostActionMenu post={row} onAction={openActionConfirmation} />
                  </Space>
                </div>
              </Card>
            ))}
            {!postsQuery.isLoading && rows.length === 0 && <Empty description="Không có bài viết phù hợp" />}
          </div>

          <div
            data-testid="post-status-drop-tray"
            aria-hidden={!activePosts.length}
            className={`fixed inset-x-3 bottom-4 z-[1050] mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur transition duration-200 motion-reduce:transition-none sm:inset-x-6 sm:p-4 ${
              activePosts.length ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">Đang di chuyển: {activePosts.length > 1 ? `${activePosts.length} bài viết đã chọn` : activePosts[0]?.title}</p>
                <p aria-live="polite" className={`text-xs ${overAction ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>
                  {overAction ? `Đã nhận vùng “${overAction.label}” — thả chuột để xác nhận.` : 'Đưa con trỏ vào giữa một vùng hợp lệ.'}
                </p>
              </div>
              <Tag color={activePosts.length === 1 ? statusColor(activePosts[0].editorial_state) : 'blue'}>
                {activePosts.length === 1 ? activePosts[0].editorial_state_label : `${activePosts.length} bài`}
              </Tag>
            </div>
            <div className="grid grid-cols-2 gap-2 pb-1 sm:flex sm:overflow-x-auto">
              {POST_STATUS_ACTIONS.map((action) => <PostStatusDropZone key={action.action} action={action} activePosts={activePosts} />)}
            </div>
          </div>

          <DragOverlay
            zIndex={1100}
            modifiers={[snapPostOverlayToCursor]}
            dropAnimation={{ duration: 180, easing: 'ease-out' }}
          >
            {activePosts.length > 0 && (
              <div data-testid="post-status-drag-overlay" className={`flex w-80 max-w-[80vw] items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 shadow-2xl transition duration-150 motion-reduce:transition-none ${overAction ? 'scale-[1.03] border-emerald-600 ring-4 ring-emerald-200/70' : 'border-emerald-500'}`}>
                {overAction ? <CheckCircleOutlined className="shrink-0 text-xl text-emerald-600" /> : <HolderOutlined className="shrink-0 text-lg text-emerald-600" />}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{activePosts.length > 1 ? `${activePosts.length} bài viết đã chọn` : activePosts[0].title}</p>
                  <p className={`truncate text-xs ${overAction ? 'font-bold text-emerald-700' : 'text-slate-500'}`}>
                    {overAction ? `Đã nhận: ${overAction.label}` : `${activePosts.length > 1 ? 'Di chuyển cùng nhau' : activePosts[0].editorial_state_label} · Chọn trạng thái mới`}
                  </p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </Card>

      <Modal
        open={Boolean(pendingAction)}
        title={pendingAction?.action.confirmTitle}
        okText={pendingAction?.action.confirmText}
        okButtonProps={{ danger: pendingAction?.action.danger }}
        confirmLoading={actionMutation.isPending}
        onCancel={() => {
          if (actionMutation.isPending) return
          setPendingAction(null)
          setActionNote('')
        }}
        onOk={confirmStatusAction}
      >
        {pendingAction && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">
                {pendingAction.posts.length > 1 ? `${pendingAction.posts.length} bài viết đã chọn` : pendingAction.posts[0].title}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Tag color={pendingAction.posts.length === 1 ? statusColor(pendingAction.posts[0].editorial_state) : 'blue'}>
                  {pendingAction.posts.length === 1 ? pendingAction.posts[0].editorial_state_label : 'Nhiều trạng thái'}
                </Tag>
                <span aria-hidden="true" className="text-slate-400">→</span>
                <Tag color={pendingAction.action.danger ? 'red' : 'green'}>{pendingAction.action.targetLabel}</Tag>
              </div>
            </div>
            {pendingAction.posts.length > 1 && (
              <ul className="max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-slate-600">
                {pendingAction.posts.map((post) => <li key={post.public_id}>{post.title}</li>)}
              </ul>
            )}
            <p className="text-sm text-slate-600">{pendingAction.action.description}</p>
            {pendingAction.action.noteRequired && (
              <div>
                <label htmlFor="post-status-note" className="mb-2 block text-sm font-semibold text-slate-800">Lý do <span className="text-rose-600">*</span></label>
                <Input.TextArea
                  id="post-status-note"
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  showCount
                  placeholder={pendingAction.action.action === 'archive' ? 'Ví dụ: Nội dung đã lỗi thời hoặc cần rà soát lại' : 'Nhập lý do để người viết biết cần chỉnh sửa gì'}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

const SortableRowContext = createContext(null)

function SortableTableRow(props) {
  const { ['data-drag-disabled']: dragDisabled, ...rowProps } = props
  const id = rowProps['data-row-key']
  const sortable = useSortable({ id, disabled: dragDisabled })
  const style = {
    ...rowProps.style,
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    ...(sortable.isDragging ? {
      background: 'var(--admin-primary-soft, #ecfdf5)',
      opacity: 0.3,
    } : {}),
  }
  return (
    <SortableRowContext.Provider value={sortable}>
      <tr {...rowProps} ref={sortable.setNodeRef} style={style} />
    </SortableRowContext.Provider>
  )
}

function SortableDragHandle({ label, disabled = false }) {
  const sortable = useContext(SortableRowContext)
  return (
    <button
      {...sortable.attributes}
      {...sortable.listeners}
      type="button"
      disabled={disabled}
      className="grid min-h-11 min-w-11 cursor-grab touch-none place-items-center rounded-lg border-0 bg-transparent text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title="Kéo để đổi thứ tự"
    >
      <HolderOutlined />
    </button>
  )
}

function SortableDragOverlay({ item, testId, title, subtitle }) {
  return <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
    {item && <div data-testid={testId} aria-hidden="true" className="flex min-w-64 max-w-md items-center gap-3 rounded-xl border-2 border-emerald-500 bg-white px-4 py-3 shadow-2xl">
      <HolderOutlined className="shrink-0 text-lg text-emerald-600" />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800">{title}</p>
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>}
  </DragOverlay>
}

function CategoryManager({ canManage }) {
  const refresh = useRefresh()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: adminBlogKeys.categories, queryFn: getAdminBlogCategories })
  const [editing, setEditing] = useState(null)
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [reordering, setReordering] = useState(false)
  const [form] = Form.useForm()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const mutation = useMutation({
    mutationFn: (payload) => editing?.public_id ? updateAdminBlogCategory(editing.public_id, payload) : createAdminBlogCategory(payload),
    onSuccess: () => { message.success('Đã lưu danh mục.'); setEditing(null); form.resetFields(); refresh() },
    onError: () => message.error('Không thể lưu danh mục.'),
  })
  const rows = query.data || []
  const activeCategory = rows.find((item) => item.public_id === activeCategoryId)
  const reorder = async ({ active, over }) => {
    setActiveCategoryId(null)
    if (!canManage || !over || active.id === over.id || reordering) return
    const from = rows.findIndex((item) => item.public_id === active.id)
    const to = rows.findIndex((item) => item.public_id === over.id)
    if (from < 0 || to < 0) return
    const previous = rows
    const next = arrayMove(rows, from, to).map((item, index) => ({ ...item, order: index + 1 }))
    queryClient.setQueryData(adminBlogKeys.categories, next)
    setReordering(true)
    try {
      await reorderAdminBlogCategories(next.map((item) => item.public_id))
      message.success('Đã cập nhật thứ tự danh mục.')
    } catch {
      queryClient.setQueryData(adminBlogKeys.categories, previous)
      message.error('Không thể đổi thứ tự danh mục. Thứ tự cũ đã được khôi phục.')
    } finally {
      setReordering(false)
    }
  }
  return <Card title="Danh mục bài viết" extra={canManage ? <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing({}); form.resetFields() }}>Thêm danh mục</Button> : null}>
    <p className="mb-4 text-sm text-slate-500">{canManage ? 'Giữ và kéo tay nắm để đổi thứ tự hiển thị. ' : ''}Tắt danh mục chỉ ẩn khỏi điều hướng và mục chuyên đề, không gỡ các bài viết đã xuất bản.{canManage ? ' Có thể dùng phím Space và phím mũi tên khi thao tác bằng bàn phím.' : ''}</p>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => { if (canManage) setActiveCategoryId(active.id) }}
      onDragCancel={() => setActiveCategoryId(null)}
      onDragEnd={reorder}
    >
      <SortableContext items={rows.map((item) => item.public_id)} strategy={verticalListSortingStrategy}>
        <Table components={{ body: { row: SortableTableRow } }} onRow={() => ({ 'data-drag-disabled': reordering || !canManage })} rowKey="public_id" loading={query.isLoading} dataSource={rows} pagination={false} columns={[
          { title: <span className="sr-only">Sắp xếp</span>, width: 64, render: (_, row) => <SortableDragHandle disabled={reordering || !canManage} label={`Kéo để sắp xếp danh mục ${row.name}`} /> },
          { title: 'Thứ tự', dataIndex: 'order', width: 90 }, { title: 'Tên', dataIndex: 'name' }, { title: 'Slug', dataIndex: 'slug' }, { title: 'Số bài', dataIndex: 'post_count', width: 90 },
          { title: 'Hoạt động', dataIndex: 'is_active', width: 110, render: (value, row) => <Switch checked={value} disabled={!canManage} onChange={(is_active) => updateAdminBlogCategory(row.public_id, { is_active }).then(refresh)} /> },
          { title: 'Thao tác', width: 100, render: (_, row) => canManage ? <Button onClick={() => { setEditing(row); form.setFieldsValue(row) }}>Sửa</Button> : <span className="text-xs text-slate-400">Chỉ xem</span> },
        ]} />
      </SortableContext>
      <SortableDragOverlay item={activeCategory} testId="category-drag-overlay" title={activeCategory?.name} subtitle={activeCategory ? `/${activeCategory.slug}` : ''} />
    </DndContext>
    <Modal title={editing?.public_id ? 'Sửa danh mục' : 'Thêm danh mục'} open={Boolean(editing)} confirmLoading={mutation.isPending} onCancel={() => setEditing(null)} onOk={() => form.validateFields().then((payload) => mutation.mutate(payload))}>
      <Form form={form} layout="vertical"><Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input maxLength={150} /></Form.Item><p className="-mt-3 mb-4 text-xs text-slate-500">Slug được tạo tự động khi thêm mới và giữ ổn định khi đổi tên.</p><Form.Item name="description" label="Mô tả"><Input.TextArea maxLength={300} showCount /></Form.Item><Form.Item name="seo_title" label="SEO title"><Input maxLength={200} /></Form.Item><Form.Item name="order" label="Thứ tự" initialValue={0}><InputNumber min={0} /></Form.Item></Form>
    </Modal>
  </Card>
}

function PinManager({ canManage }) {
  const refresh = useRefresh()
  const queryClient = useQueryClient()
  const pins = useQuery({ queryKey: adminBlogKeys.pins, queryFn: getAdminBlogPins })
  const posts = useQuery({ queryKey: adminBlogKeys.posts({ status: 'published', page_size: 60 }), queryFn: () => getAdminBlogPosts({ status: 'published', page_size: 60 }) })
  const [selected, setSelected] = useState()
  const [activePinId, setActivePinId] = useState(null)
  const [operation, setOperation] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const rows = pins.data || []
  const activePin = rows.find((item) => item.public_id === activePinId)
  const run = async (key, request, success) => {
    setOperation(key)
    try {
      await request()
      await refresh()
      message.success(success)
      return true
    } catch (error) {
      const response = error.response?.data
      const detail = typeof response?.detail === 'string'
        ? response.detail
        : Object.values(response || {}).flat().find((item) => typeof item === 'string')
      message.error(detail || 'Không thể cập nhật bài ghim. Vui lòng thử lại.')
      return false
    } finally {
      setOperation(null)
    }
  }
  const add = async () => {
    if (!canManage || !selected) return
    const saved = await run('add', () => createAdminBlogPin({ post_public_id: selected, order: rows.length + 1, is_active: true }), 'Đã ghim bài viết.')
    if (saved) setSelected(undefined)
  }
  const reorder = async ({ active, over }) => {
    setActivePinId(null)
    if (!canManage || !over || active.id === over.id || operation) return
    const from = rows.findIndex((item) => item.public_id === active.id)
    const to = rows.findIndex((item) => item.public_id === over.id)
    if (from < 0 || to < 0) return
    const previous = rows
    const next = arrayMove(rows, from, to).map((item, index) => ({ ...item, order: index + 1 }))
    queryClient.setQueryData(adminBlogKeys.pins, next)
    setOperation('reorder')
    try {
      await reorderAdminBlogPins(next.map((item) => item.public_id))
      message.success('Đã cập nhật thứ tự bài ghim.')
    } catch {
      queryClient.setQueryData(adminBlogKeys.pins, previous)
      message.error('Không thể đổi thứ tự bài ghim. Thứ tự cũ đã được khôi phục.')
    } finally {
      setOperation(null)
    }
  }
  const availablePosts = (posts.data?.results || []).filter((post) => !rows.some((pin) => pin.post_public_id === post.public_id))
  return <Card title="Tài liệu hỗ trợ tìm việc" extra={canManage ? <Space wrap><Select showSearch optionFilterProp="label" className="w-full sm:w-64" loading={posts.isLoading} value={selected} onChange={setSelected} placeholder="Chọn bài đã xuất bản" options={availablePosts.map((post) => ({ value: post.public_id, label: post.title }))} /><Button type="primary" disabled={!selected} loading={operation === 'add'} onClick={add}>Ghim bài</Button></Space> : null}>
    {(pins.isError || posts.isError) && <Alert className="mb-4" type="error" showIcon message="Không thể tải dữ liệu bài ghim" description="Hãy tải lại trang hoặc thử lại sau." />}
    <p className="mb-4 text-sm text-slate-500">{canManage ? 'Giữ và kéo tay nắm để đổi thứ tự hiển thị. Có thể dùng phím Space và phím mũi tên khi thao tác bằng bàn phím.' : 'Bạn đang xem danh sách bài ghim ở chế độ chỉ đọc.'}</p>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => { if (canManage) setActivePinId(active.id) }}
      onDragCancel={() => setActivePinId(null)}
      onDragEnd={reorder}
    >
      <SortableContext items={rows.map((item) => item.public_id)} strategy={verticalListSortingStrategy}>
        <Table components={{ body: { row: SortableTableRow } }} onRow={() => ({ 'data-drag-disabled': Boolean(operation) || !canManage })} rowKey="public_id" loading={pins.isLoading} dataSource={rows} pagination={false} columns={[
          { title: <span className="sr-only">Sắp xếp</span>, width: 64, render: (_, row) => <SortableDragHandle disabled={Boolean(operation) || !canManage} label={`Kéo để sắp xếp bài ghim ${row.title}`} /> },
          { title: 'Thứ tự', dataIndex: 'order', width: 90 },
          { title: 'Bài viết', dataIndex: 'title' },
          { title: 'Hoạt động', dataIndex: 'is_active', width: 110, render: (value, row) => <Switch checked={value} loading={operation === `toggle:${row.public_id}`} disabled={!canManage || (Boolean(operation) && operation !== `toggle:${row.public_id}`)} onChange={(is_active) => run(`toggle:${row.public_id}`, () => updateAdminBlogPin(row.public_id, { is_active }), is_active ? 'Đã hiển thị bài ghim.' : 'Đã ẩn bài ghim.')} /> },
          { title: 'Thao tác', width: 120, render: (_, row) => canManage ? <Button danger loading={operation === `delete:${row.public_id}`} disabled={Boolean(operation) && operation !== `delete:${row.public_id}`} onClick={() => run(`delete:${row.public_id}`, () => deleteAdminBlogPin(row.public_id), 'Đã bỏ ghim bài viết.')}>Bỏ ghim</Button> : <span className="text-xs text-slate-400">Chỉ xem</span> },
        ]} />
      </SortableContext>
      <SortableDragOverlay item={activePin} testId="pin-drag-overlay" title={activePin?.title} subtitle={activePin ? `/${activePin.slug}` : ''} />
    </DndContext>
  </Card>
}

export default function BlogContentManagement({ tagPanel }) {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const canManage = adminAccess.has('blog.manage')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = ['posts', 'categories', 'tags', 'pins'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'posts'
  const changeTab = (key) => { const next = new URLSearchParams(searchParams); if (key === 'posts') next.delete('tab'); else next.set('tab', key); setSearchParams(next, { replace: true }) }
  const permissionAwareTagPanel = isValidElement(tagPanel) ? cloneElement(tagPanel, { canManage }) : tagPanel
  return <section className="space-y-4"><div><h1 className="text-2xl font-bold text-slate-900">Cẩm nang nghề nghiệp</h1><p className="mt-1 text-sm text-slate-500">Biên tập, duyệt và tổ chức nội dung hiển thị cho ứng viên.</p></div><Tabs activeKey={tab} onChange={changeTab} items={[{ key: 'posts', label: 'Bài viết', children: <PostList canManage={canManage} /> }, { key: 'categories', label: 'Danh mục', children: <CategoryManager canManage={canManage} /> }, { key: 'tags', label: 'Thẻ', children: permissionAwareTagPanel }, { key: 'pins', label: 'Bài ghim', children: <PinManager canManage={canManage} /> }]} /></section>
}
