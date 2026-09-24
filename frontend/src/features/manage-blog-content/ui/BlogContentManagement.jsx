import {
  CheckCircleOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  ExportOutlined,
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
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { cloneElement, createContext, isValidElement, useContext, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  adminBlogKeys,
  blogPostPath,
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
import { AdminDataActions } from '@/shared/ui/admin'

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

const POST_ACTION_SUCCESS_PREFIX = {
  submit: 'Đã gửi duyệt',
  publish: 'Đã xuất bản',
  return: 'Đã trả về nháp',
  archive: 'Đã ẩn',
  restore: 'Đã khôi phục',
}

const PUBLIC_EDITORIAL_STATES = new Set(['published', 'published_with_draft', 'published_with_pending'])

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

function canTransitionPost(post) {
  return POST_STATUS_ACTIONS.some((action) => post.allowed_actions?.includes(action.action))
}

function AdminPostLink({ post, children, className = '', label }) {
  return (
    <Link
      to={adminPath(`/blog/${post.public_id}/edit`)}
      className={className}
      aria-label={label || `Mở bài “${post.title}” trong trang admin`}
    >
      {children}
    </Link>
  )
}

function PublicPostUrl({ post }) {
  const path = blogPostPath(post.slug)
  const content = (
    <>
      <span className="truncate">{path}</span>
      {PUBLIC_EDITORIAL_STATES.has(post.editorial_state) && <ExportOutlined className="shrink-0" aria-hidden="true" />}
    </>
  )
  const className = 'mt-1 flex w-fit max-w-full items-center gap-1 text-xs focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'

  if (!PUBLIC_EDITORIAL_STATES.has(post.editorial_state)) {
    return <span className={`${className} cursor-not-allowed !text-slate-400`} title="Chỉ mở được ở trang public sau khi bài viết được xuất bản">{content}</span>
  }

  return (
    <a
      href={path}
      target="_blank"
      rel="noreferrer"
      className={`${className} !text-slate-500 transition hover:!text-emerald-700 hover:underline`}
      aria-label={`Mở URL ${path} ở trang public`}
    >
      {content}
    </a>
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
  const [ordering, setOrdering] = useState('-updated_at')
  const [page, setPage] = useState(1)
  const [selectedPostIds, setSelectedPostIds] = useState([])
  const [pendingAction, setPendingAction] = useState(null)
  const [actionNote, setActionNote] = useState('')
  const params = useMemo(
    () => ({ q: q || undefined, status, category, ordering, page, page_size: 20 }),
    [category, ordering, page, q, status],
  )
  const postsQuery = useQuery({ queryKey: adminBlogKeys.posts(params), queryFn: ({ signal }) => getAdminBlogPosts(params, { signal }) })
  const summaryQuery = useQuery({ queryKey: adminBlogKeys.summary, queryFn: getAdminBlogSummary })
  const categoriesQuery = useQuery({ queryKey: adminBlogKeys.categories, queryFn: getAdminBlogCategories })
  const rows = postsQuery.data?.results || []
  const selectablePosts = rows.filter(canTransitionPost)
  const selectedPosts = selectablePosts.filter((post) => selectedPostIds.includes(post.public_id))

  useEffect(() => setSelectedPostIds([]), [category, ordering, page, q, status])

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

  const sortable = (field) => ({
    key: field,
    sorter: true,
    sortOrder: ordering === field ? 'ascend' : ordering === `-${field}` ? 'descend' : null,
  })
  const columns = [
    {
      title: 'Bài viết',
      width: 440,
      ...sortable('title'),
      render: (_, row) => (
        <div className="flex min-w-0 gap-3">
          <AdminPostLink post={row} className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" label={`Mở ảnh bài “${row.title}” trong trang admin`}>
            {row.thumbnail_url ? <img src={row.thumbnail_url} alt="" className="h-16 w-24 rounded-lg object-cover transition hover:opacity-85" /> : <span className="grid h-16 w-24 place-items-center rounded-lg bg-slate-100 text-2xl font-bold text-slate-300">{row.title?.[0]}</span>}
          </AdminPostLink>
          <div className="min-w-0">
            <AdminPostLink post={row} className="line-clamp-2 font-semibold !text-slate-800 transition hover:!text-emerald-700 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
              {row.title}
            </AdminPostLink>
            <PublicPostUrl post={row} />
          </div>
        </div>
      ),
    },
    { title: 'Danh mục', dataIndex: ['category', 'name'], width: 180, ...sortable('category'), render: (value) => value || 'Chưa phân loại' },
    { title: 'Tác giả', dataIndex: ['author', 'name'], width: 180, ...sortable('author'), render: (value) => value || 'Không xác định' },
    { title: 'Trạng thái', width: 190, ...sortable('editorial_state'), render: (_, row) => <Tag color={statusColor(row.editorial_state)}>{row.editorial_state_label}</Tag> },
    { title: 'Hoàn thiện', width: 130, ...sortable('completeness'), render: (_, row) => <Progress percent={row.completeness.score} size="small" /> },
    { title: 'Lượt xem', dataIndex: 'view_count', width: 110, ...sortable('view_count'), render: (value) => Number(value || 0).toLocaleString('vi-VN') },
    {
      title: 'Cập nhật',
      dataIndex: 'updated_at',
      width: 160,
      ...sortable('updated_at'),
      render: (value) => {
        const date = new Date(value)
        return <span title={date.toLocaleString('vi-VN')}>{date.toLocaleDateString('vi-VN')}</span>
      },
    },
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
  const allVisibleSelected = selectablePosts.length > 0 && selectedPosts.length === selectablePosts.length
  const someVisibleSelected = selectedPosts.length > 0 && !allVisibleSelected
  const hasFilters = Boolean(q || status || category)
  const clearFilters = () => {
    setQ('')
    setStatus(undefined)
    setCategory(undefined)
    setPage(1)
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {[['all', 'Tất cả'], ...STATUS_OPTIONS.map((item) => [item.value, item.label])].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="text-left"
            aria-label={`Lọc ${label}: ${stats[key] || 0} bài`}
            aria-pressed={(key === 'all' && !status) || status === key}
            onClick={() => { setStatus(key === 'all' ? undefined : key); setPage(1) }}
          >
            <Card
              size="small"
              className={`h-full cursor-pointer transition hover:border-emerald-300 hover:shadow-sm ${
                ((key === 'all' && !status) || status === key) ? 'border-emerald-500 bg-emerald-50/60' : ''
              }`}
            >
              <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{stats[key] || 0}</p>
            </Card>
          </button>
        ))}
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Danh sách bài viết</h2>
            <p className="mt-1 text-sm text-slate-500">
              {postsQuery.isLoading ? 'Đang tải dữ liệu…' : `${Number(postsQuery.data?.count || 0).toLocaleString('vi-VN')} bài viết phù hợp`}
            </p>
          </div>
          <p className="text-xs text-slate-500">Tên mở trang quản trị; URL của bài đã xuất bản mở trang public trong tab mới.</p>
        </div>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm tiêu đề hoặc slug" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} />
            <Select allowClear placeholder="Trạng thái" value={status} options={STATUS_OPTIONS} onChange={(value) => { setStatus(value); setPage(1) }} />
            <Select allowClear placeholder="Danh mục" value={category} options={(categoriesQuery.data || []).map((item) => ({ value: item.public_id, label: item.name }))} onChange={(value) => { setCategory(value); setPage(1) }} />
          </div>
          <Space wrap>
            <AdminDataActions
              compact
              columns={[
                { key: 'public_id', label: 'Mã bài viết' },
                { key: 'title', label: 'Tiêu đề' },
                { label: 'Danh mục', value: (row) => row.category?.name },
                { label: 'Tác giả', value: (row) => row.author?.name },
                { key: 'editorial_state_label', label: 'Trạng thái' },
                { key: 'view_count', label: 'Lượt xem' },
                { key: 'updated_at', label: 'Cập nhật lúc' },
              ]}
              exportLabel="CSV trang này"
              exportScopeLabel={`Xuất ${rows.length} bài viết của trang ${page}`}
              filename={`bai-viet-trang-${page}`}
              onRefresh={() => Promise.all([
                postsQuery.refetch(),
                summaryQuery.refetch(),
                categoriesQuery.refetch(),
              ])}
              refreshing={postsQuery.isFetching || summaryQuery.isFetching}
              rows={rows}
            />
            {hasFilters && <Button onClick={clearFilters}>Xóa bộ lọc</Button>}
            {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(adminPath('/blog/new'))}>Tạo bài viết</Button>}
          </Space>
        </div>
        {postsQuery.isError && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            message="Không thể tải danh sách bài viết"
            description="Hãy kiểm tra kết nối rồi thử lại."
            action={<Button size="small" onClick={() => postsQuery.refetch()}>Thử lại</Button>}
          />
        )}
        {selectedPosts.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div>
              <p className="font-semibold text-blue-950">Đã chọn {selectedPosts.length} bài viết</p>
              <p className="text-xs text-blue-700">Áp dụng cùng một thay đổi trạng thái cho các bài đã chọn.</p>
            </div>
            <Space wrap>
              <Button onClick={() => setSelectedPostIds([])}>Bỏ chọn</Button>
              <BulkPostActionMenu posts={selectedPosts} onAction={openActionConfirmation} />
            </Space>
          </div>
        )}
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table
              rowKey="public_id"
              loading={postsQuery.isLoading}
              dataSource={rows}
              columns={columns}
              onChange={(_, __, sorter, extra) => {
                if (extra.action !== 'sort') return
                const selectedSorter = Array.isArray(sorter) ? sorter[0] : sorter
                const field = selectedSorter?.columnKey
                const nextOrdering = selectedSorter?.order
                  ? `${selectedSorter.order === 'descend' ? '-' : ''}${field}`
                  : '-updated_at'
                setOrdering(nextOrdering)
                setPage(1)
              }}
              rowSelection={selectablePosts.length ? {
                selectedRowKeys: selectedPostIds,
                onChange: setSelectedPostIds,
                columnTitle: <span className="sr-only">Chọn bài viết</span>,
                getCheckboxProps: (row) => ({
                  'aria-label': `Chọn bài “${row.title}”`,
                  disabled: !canTransitionPost(row),
                }),
              } : undefined}
              scroll={{ x: 1580 }}
              showSorterTooltip={{ target: 'sorter-icon' }}
              pagination={{
                current: page,
                pageSize: 20,
                total: postsQuery.data?.count || 0,
                showSizeChanger: false,
                showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} bài`,
                onChange: setPage,
              }}
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
                  {row.thumbnail_url && (
                    <AdminPostLink post={row} className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" label={`Mở ảnh bài “${row.title}” trong trang admin`}>
                      <img src={row.thumbnail_url} alt="" className="h-16 w-24 rounded-lg object-cover" />
                    </AdminPostLink>
                  )}
                  <div className="min-w-0 flex-1">
                    <AdminPostLink post={row} className="line-clamp-2 font-semibold !text-slate-800 hover:!text-emerald-700 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                      {row.title}
                    </AdminPostLink>
                    <PublicPostUrl post={row} />
                    <Tag className="mt-2" color={statusColor(row.editorial_state)}>{row.editorial_state_label}</Tag>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <span>{row.category?.name || 'Chưa phân loại'}</span>
                  <span className="text-right">{Number(row.view_count || 0).toLocaleString('vi-VN')} lượt xem</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Progress percent={row.completeness.score} size="small" className="min-w-32 flex-1" />
                  <Space size={8}>
                    <Button icon={<EditOutlined />} onClick={() => navigate(adminPath(`/blog/${row.public_id}/edit`))}>Mở</Button>
                    <PostActionMenu post={row} onAction={openActionConfirmation} />
                  </Space>
                </div>
              </Card>
            ))}
            {!postsQuery.isLoading && rows.length === 0 && <Empty description="Không có bài viết phù hợp" />}
          </div>
        </>
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
  return <section className="space-y-4"><Tabs activeKey={tab} onChange={changeTab} items={[{ key: 'posts', label: 'Bài viết', children: <PostList canManage={canManage} /> }, { key: 'categories', label: 'Danh mục', children: <CategoryManager canManage={canManage} /> }, { key: 'tags', label: 'Thẻ', children: permissionAwareTagPanel }, { key: 'pins', label: 'Bài ghim', children: <PinManager canManage={canManage} /> }]} /></section>
}
