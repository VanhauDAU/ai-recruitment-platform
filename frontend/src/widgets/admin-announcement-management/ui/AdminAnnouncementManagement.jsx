import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Drawer } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import {
  announcementKeys,
  getAdminAnnouncement,
  getAdminAnnouncements,
} from '@/entities/announcement'
import { useSession } from '@/entities/session'
import {
  getAnnouncementStaleConflict,
  useAnnouncementActions,
} from '@/features/manage-announcement'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { AdminDataActions } from '@/shared/ui/admin'
import AnnouncementDetailDrawer from './AnnouncementDetailDrawer'
import AnnouncementEditor from './AnnouncementEditor'
import AnnouncementFilters from './AnnouncementFilters'
import AnnouncementNameModal from './AnnouncementNameModal'
import AnnouncementTable from './AnnouncementTable'
import '../admin-announcement-management.css'

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] }
const DEFAULT_ORDERING = '-updated_at'

function value(searchParams, key, fallback = '') {
  return searchParams.get(key) || fallback
}

export default function AdminAnnouncementManagement() {
  const { message, modal } = App.useApp()
  const { user } = useSession()
  const access = useAdminAccess(user)
  const canManage = access.has('announcement.manage')
  const canPublish = access.has('announcement.publish')
  const [searchParams, setSearchParams] = useSearchParams()
  const query = value(searchParams, 'q')
  const page = Number(value(searchParams, 'page', '1')) || 1
  const ordering = value(searchParams, 'ordering', DEFAULT_ORDERING)
  const filters = {
    q: query,
    lifecycle_state: value(searchParams, 'lifecycle_state'),
    kind: value(searchParams, 'kind'),
    surface: value(searchParams, 'surface'),
  }
  const params = Object.fromEntries(
    Object.entries({ ...filters, page, ordering }).filter(([, item]) => item !== ''),
  )
  const [searchInput, setSearchInput] = useState(query)
  const [selectedId, setSelectedId] = useState(null)
  const [editorMode, setEditorMode] = useState(null)
  const [nameMode, setNameMode] = useState(null)
  const [conflict, setConflict] = useState(null)
  const listQuery = useQuery({
    queryKey: announcementKeys.adminList(params),
    queryFn: ({ signal }) => getAdminAnnouncements(params, { signal }),
  })
  const detailQuery = useQuery({
    queryKey: announcementKeys.adminDetail(selectedId),
    queryFn: ({ signal }) => getAdminAnnouncement(selectedId, { signal }),
    enabled: Boolean(selectedId),
  })
  const actions = useAnnouncementActions()
  const data = listQuery.data || EMPTY_PAGE

  useEffect(() => setSearchInput(query), [query])

  useEffect(() => {
    const normalized = searchInput.trim()
    if (normalized === query) return undefined
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (normalized) next.set('q', normalized)
      else next.delete('q')
      next.delete('page')
      setSearchParams(next, { replace: true })
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [query, searchInput, searchParams, setSearchParams])

  const updateParams = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, nextValue]) => {
      if (nextValue === '' || nextValue == null) next.delete(key)
      else next.set(key, String(nextValue))
    })
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  const handleError = (error) => {
    const stale = getAnnouncementStaleConflict(error)
    if (stale) {
      setConflict(stale)
      setEditorMode(null)
      setNameMode(null)
      return
    }
    message.error(getApiErrorMessage(error))
  }

  const submitEditor = async (payload) => {
    try {
      if (editorMode === 'create') {
        const created = await actions.create(payload)
        message.success('Đã tạo bản nháp thông báo.')
        setSelectedId(created.public_id)
      } else {
        await actions.createRevision(selectedId, {
          revision_token: detailQuery.data.revision_token,
          revision: payload.revision,
        })
        message.success('Đã tạo immutable revision mới.')
      }
      setConflict(null)
      setEditorMode(null)
    } catch (error) {
      handleError(error)
    }
  }

  const executeLifecycle = async (type, extra = {}) => {
    const detail = detailQuery.data
    if (!detail || actions.pending) return
    try {
      await actions[type](detail.public_id, {
        revision_token: detail.revision_token,
        ...extra,
      })
      setConflict(null)
      message.success({
        publish: 'Đã phát hành thông báo.',
        pause: 'Đã tạm dừng thông báo.',
        resume: 'Đã tiếp tục thông báo.',
        archive: 'Đã lưu trữ thông báo.',
        'reset-dismissals': 'Đã hiện lại thông báo cho người đã đóng.',
      }[type])
    } catch (error) {
      handleError(error)
    }
  }

  const confirmations = {
    archive: {
      title: 'Lưu trữ thông báo?',
      content: 'Thông báo đã lưu trữ là trạng thái cuối và không thể phát hành lại.',
      okText: 'Lưu trữ',
      okButtonProps: { danger: true },
    },
    'reset-dismissals': {
      title: 'Hiện lại thông báo cho người đã đóng?',
      content: 'Mọi người từng bấm đóng hoặc tạm ẩn sẽ thấy lại thông báo này. Chỉ dùng khi nội dung đã thay đổi đáng kể.',
      okText: 'Hiện lại',
    },
  }

  const onAction = (type, extra = {}) => {
    const confirmation = confirmations[type]
    if (!confirmation) {
      executeLifecycle(type, extra)
      return
    }
    modal.confirm({
      cancelText: 'Hủy',
      ...confirmation,
      onOk: () => executeLifecycle(type, extra),
    })
  }

  const submitName = async ({ internal_name: internalName }) => {
    const detail = detailQuery.data
    try {
      if (nameMode === 'rename') {
        await actions.rename(detail.public_id, {
          internal_name: internalName.trim(),
          revision_token: detail.revision_token,
        })
        message.success('Đã đổi tên vận hành.')
      } else {
        const duplicate = await actions.duplicate(detail.public_id, {
          internal_name: internalName.trim(),
          revision_token: detail.revision_token,
        })
        message.success('Đã tạo bản sao ở trạng thái draft.')
        setSelectedId(duplicate.public_id)
      }
      setNameMode(null)
      setConflict(null)
    } catch (error) {
      handleError(error)
    }
  }

  const editorDetail = editorMode === 'revision' ? detailQuery.data : null
  const duplicateName = detailQuery.data
    ? `${detailQuery.data.internal_name} — Bản sao`
    : ''
  const nameInitial = nameMode === 'rename'
    ? detailQuery.data?.internal_name
    : duplicateName
  const editorAnnouncements = useMemo(
    () => data.results.filter((item) => item.public_id !== selectedId),
    [data.results, selectedId],
  )

  return (
    <section className="admin-announcement-management" aria-label="Quản lý thông báo">
      <AnnouncementFilters
        actions={(
          <AdminDataActions
            compact
            columns={[
              { key: 'public_id', label: 'Mã thông báo' },
              { key: 'internal_name', label: 'Tên vận hành' },
              { label: 'Surface', value: (row) => row.surfaces },
              { key: 'presentation_status', label: 'Trạng thái' },
              { key: 'kind', label: 'Loại' },
              { key: 'priority', label: 'Ưu tiên' },
              { key: 'impressions', label: 'Hiển thị' },
              { key: 'clicks', label: 'Click' },
              { key: 'ctr', label: 'CTR (%)' },
              { key: 'updated_at', label: 'Cập nhật lúc' },
            ]}
            exportLabel="CSV trang này"
            exportScopeLabel={`Xuất ${data.results.length} thông báo của trang ${page}`}
            filename={`thong-bao-trang-${page}`}
            onRefresh={() => listQuery.refetch()}
            refreshing={listQuery.isFetching}
            rows={data.results}
          />
        )}
        canCreate={canManage}
        filters={filters}
        onChange={updateParams}
        onCreate={() => setEditorMode('create')}
        onReset={resetFilters}
        searchInput={searchInput}
        onSearchChange={(event) => setSearchInput(event.target.value)}
        total={data.count}
      />

      {listQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title="Không thể tải danh sách thông báo"
          description={getApiErrorMessage(listQuery.error)}
          action={<Button onClick={() => listQuery.refetch()}>Thử lại</Button>}
        />
      )}

      <AnnouncementTable
        data={data}
        loading={listQuery.isLoading}
        ordering={ordering}
        page={page}
        onOpen={(publicId) => {
          setConflict(null)
          setSelectedId(publicId)
        }}
        onChange={(pagination, _, sorter) => {
          const field = sorter.columnKey || sorter.field
          const nextOrdering = sorter.order
            ? `${sorter.order === 'descend' ? '-' : ''}${field}`
            : DEFAULT_ORDERING
          updateParams(
            { page: pagination.current, ordering: nextOrdering },
            { resetPage: false },
          )
        }}
      />

      <AnnouncementDetailDrawer
        open={Boolean(selectedId) && !editorMode}
        detail={detailQuery.data}
        loading={detailQuery.isLoading}
        error={detailQuery.error}
        canManage={canManage}
        canPublish={canPublish}
        conflict={conflict}
        pendingType={actions.pendingType}
        onClose={() => {
          setSelectedId(null)
          setConflict(null)
        }}
        onReload={() => {
          setConflict(null)
          actions.reset()
          detailQuery.refetch()
        }}
        onAction={onAction}
        onEdit={() => setEditorMode('revision')}
        onRename={() => setNameMode('rename')}
        onDuplicate={() => setNameMode('duplicate')}
      />

      <Drawer
        open={Boolean(editorMode)}
        onClose={() => setEditorMode(null)}
        size={1080}
        styles={{ wrapper: { maxWidth: '100vw' } }}
        title={editorMode === 'create' ? 'Tạo thông báo mới' : 'Tạo revision mới'}
        destroyOnHidden
      >
        <AnnouncementEditor
          key={`${editorMode}-${selectedId || 'new'}`}
          detail={editorDetail}
          announcements={editorAnnouncements}
          pending={actions.pending}
          onCancel={() => setEditorMode(null)}
          onSubmit={submitEditor}
        />
      </Drawer>

      <AnnouncementNameModal
        open={Boolean(nameMode)}
        mode={nameMode}
        initialValue={nameInitial}
        pending={actions.pending}
        onCancel={() => setNameMode(null)}
        onSubmit={submitName}
      />
    </section>
  )
}
