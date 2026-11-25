import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Input, Modal, Select, Table, Tag } from 'antd'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  DATA_REQUEST_STATUS_COLORS,
  completeAdminDataRequest,
  dataRequestKeys,
  getAdminDataRequests,
  rejectAdminDataRequest,
} from '@/entities/account/data-request'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { formatDateTime, formatElapsed } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import { AdminDataActions, AdminPanel } from '@/shared/ui/admin'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'

const DEFAULT_STATUS = 'pending'
const PAGE_SIZE = 20

function statusOptions() {
  return [
    { value: 'pending', label: m.admin_privacy_status_pending() },
    { value: 'completed', label: m.admin_privacy_status_completed() },
    { value: 'rejected', label: m.admin_privacy_status_rejected() },
    { value: 'cancelled', label: m.admin_privacy_status_cancelled() },
    { value: 'all', label: m.admin_privacy_status_all() },
  ]
}

function kindOptions() {
  return [
    { value: 'erasure', label: m.admin_privacy_kind_erasure() },
    { value: 'export', label: m.admin_privacy_kind_export() },
  ]
}

/** Hàng chờ yêu cầu xóa tài khoản / xuất dữ liệu; bộ lọc và trang nằm trên URL. */
export default function DataRequestQueue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') || DEFAULT_STATUS
  const kind = searchParams.get('kind') || ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const [rejecting, setRejecting] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const queryClient = useQueryClient()
  const params = useMemo(() => ({
    ...(status !== 'all' && { status }),
    ...(kind && { kind }),
    page,
  }), [kind, page, status])
  const listQuery = useQuery({
    queryKey: dataRequestKeys.adminList(params),
    queryFn: ({ signal }) => getAdminDataRequests(params, { signal }),
    placeholderData: (previous) => previous,
  })
  const rows = listQuery.data?.results || []
  const total = listQuery.data?.count || 0

  const patchParams = (changes) => {
    const next = new URLSearchParams(searchParams)
    next.delete('page')
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || (key === 'status' && value === DEFAULT_STATUS)) next.delete(key)
      else next.set(key, String(value))
    })
    setSearchParams(next)
  }

  const decide = useMutation({
    mutationFn: ({ action, row, note }) => (action === 'reject'
      ? rejectAdminDataRequest(row.public_id, note)
      : completeAdminDataRequest(row.public_id)),
    onSuccess: () => {
      message.success(m.admin_privacy_done())
      setRejecting(null)
      setRejectNote('')
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.admin_privacy_failed())),
    onSettled: () => queryClient.invalidateQueries({ queryKey: dataRequestKeys.adminLists }),
  })

  const columns = [
    {
      title: m.admin_privacy_col_account(),
      key: 'account',
      render: (_value, row) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-800 break-all">{row.account.email}</div>
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span>{row.account.public_id}</span>
            <Tag className="!m-0">{row.account.role === 'employer' ? m.admin_privacy_role_employer() : m.admin_privacy_role_candidate()}</Tag>
            {row.account.is_deleted && <Tag className="!m-0">{m.admin_privacy_deleted()}</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: m.admin_privacy_col_kind(),
      key: 'kind',
      render: (_value, row) => <Tag color={row.kind === 'erasure' ? 'red' : 'blue'} className="!m-0">{row.kind_label}</Tag>,
    },
    { title: m.admin_privacy_col_note(), dataIndex: 'note', key: 'note', render: (note) => note || '—' },
    {
      title: m.admin_privacy_col_created(),
      key: 'created_at',
      render: (_value, row) => (
        <div className="whitespace-nowrap">
          {formatDateTime(row.created_at)}
          {row.status === 'pending' && <div className="text-xs text-slate-500">{m.admin_privacy_waiting({ time: formatElapsed(row.created_at) })}</div>}
        </div>
      ),
    },
    {
      title: m.admin_privacy_col_status(),
      key: 'status',
      render: (_value, row) => (
        <div className="min-w-0 text-xs text-slate-500">
          <Tag color={DATA_REQUEST_STATUS_COLORS[row.status]} className="!m-0">{row.status_label}</Tag>
          {row.handled_at && <div className="mt-1">{m.admin_privacy_handled({ email: row.handled_by_email || '—', time: formatDateTime(row.handled_at) })}</div>}
          {row.resolution_note && <div className="mt-1 text-slate-600">{row.resolution_note}</div>}
        </div>
      ),
    },
    {
      title: m.admin_privacy_col_actions(),
      key: 'actions',
      render: (_value, row) => row.status === 'pending' && (
        <div className="flex flex-wrap gap-2">
          <ConfirmAction
            title={row.kind === 'erasure' ? m.admin_privacy_complete_erasure_title() : m.admin_privacy_complete_export_title()}
            description={row.kind === 'erasure' ? m.admin_privacy_complete_erasure_desc() : m.admin_privacy_complete_export_desc()}
            confirmText={m.admin_privacy_complete_confirm()}
            danger={row.kind === 'erasure'}
            onConfirm={() => decide.mutateAsync({ action: 'complete', row })}
          >
            <Button size="small" type="primary" danger={row.kind === 'erasure'} disabled={decide.isPending}>{m.admin_privacy_complete()}</Button>
          </ConfirmAction>
          <Button size="small" disabled={decide.isPending} onClick={() => setRejecting(row)}>{m.admin_privacy_reject()}</Button>
        </div>
      ),
    },
  ]

  return (
    <AdminPanel
      description={m.admin_privacy_description({ count: total.toLocaleString(getIntlLocale()) })}
      extra={<AdminDataActions allowExport={false} onRefresh={() => listQuery.refetch()} refreshing={listQuery.isFetching} />}
    >
      <div className="admin-list-toolbar">
        <div className="admin-list-toolbar__filters">
          <Select
            aria-label={m.admin_privacy_filter_status()}
            className="w-full sm:w-52"
            onChange={(value) => patchParams({ status: value })}
            options={statusOptions()}
            value={status}
          />
          <Select
            allowClear
            aria-label={m.admin_privacy_filter_kind()}
            className="w-full sm:w-52"
            onChange={(value) => patchParams({ kind: value })}
            options={kindOptions()}
            placeholder={m.admin_privacy_kind_all()}
            value={kind || undefined}
          />
        </div>
      </div>
      {listQuery.isError && (
        <Alert
          action={<Button onClick={() => listQuery.refetch()} size="small">{m.admin_privacy_retry()}</Button>}
          className="mb-4"
          showIcon
          title={`${m.admin_privacy_load_failed()} ${getApiErrorMessage(listQuery.error)}`}
          type="error"
        />
      )}
      <div className="overflow-x-auto">
        <Table
          columns={columns}
          dataSource={rows}
          loading={listQuery.isFetching}
          locale={{ emptyText: m.admin_privacy_empty() }}
          onChange={(pagination) => patchParams({ page: pagination.current > 1 ? pagination.current : '' })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, hideOnSinglePage: true }}
          rowKey="public_id"
          scroll={{ x: 960 }}
          size="middle"
        />
      </div>
      <Modal
        open={Boolean(rejecting)}
        title={m.admin_privacy_reject_title()}
        okText={m.admin_privacy_reject()}
        okButtonProps={{ danger: true, loading: decide.isPending }}
        cancelText={m.common_action_cancel()}
        onOk={() => {
          if (!rejectNote.trim()) {
            message.error(m.admin_privacy_reject_note_required())
            return
          }
          decide.mutate({ action: 'reject', row: rejecting, note: rejectNote.trim() })
        }}
        onCancel={() => { setRejecting(null); setRejectNote('') }}
        destroyOnHidden
      >
        <label className="block text-sm font-medium text-slate-700" htmlFor="privacy-reject-note">{m.admin_privacy_reject_note()}</label>
        <Input.TextArea
          id="privacy-reject-note"
          className="!mt-1"
          maxLength={1000}
          rows={3}
          value={rejectNote}
          onChange={(event) => setRejectNote(event.target.value)}
        />
      </Modal>
    </AdminPanel>
  )
}
