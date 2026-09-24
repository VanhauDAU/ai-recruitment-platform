import { CheckCircleOutlined, FilterOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Empty, Input, Select, Table, Tag, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import {
  consultationLeadKeys,
  exportAdminConsultationLeads,
  getAdminConsultationLeads,
  updateAdminConsultationLead,
} from '@/entities/consultation-lead'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { AdminDataActions, AdminPanel } from '@/shared/ui/admin'

const PAGE_SIZE = 20
const DEFAULT_STATUS = 'new'
const DEFAULT_ORDERING = '-created_at'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Mới' },
  { value: 'contacted', label: 'Đã liên hệ' },
  { value: 'all', label: 'Tất cả trạng thái' },
]

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function AdminConsultationLeads() {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const canExport = access.isSuperuser || access.has('consultation_lead.export')
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? DEFAULT_STATUS
  const query = searchParams.get('q') || ''
  const createdFrom = searchParams.get('created_from') || ''
  const createdTo = searchParams.get('created_to') || ''
  const ordering = searchParams.get('ordering') || DEFAULT_ORDERING
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1)
  const [searchInput, setSearchInput] = useState(query)
  const queryClient = useQueryClient()
  const params = useMemo(() => Object.fromEntries(Object.entries({
    ...(status !== 'all' ? { status } : {}),
    ...(query ? { q: query } : {}),
    ...(createdFrom ? { created_from: createdFrom } : {}),
    ...(createdTo ? { created_to: createdTo } : {}),
    ordering,
    page,
  }).filter(([, value]) => value !== '')), [
    createdFrom,
    createdTo,
    ordering,
    page,
    query,
    status,
  ])
  const leadsQuery = useQuery({
    queryKey: consultationLeadKeys.adminList(params),
    queryFn: ({ signal }) => getAdminConsultationLeads(params, { signal }),
    placeholderData: (previousData) => previousData,
  })
  const response = leadsQuery.data
  const data = response?.results || (Array.isArray(response) ? response : [])
  const total = response?.count ?? data.length
  const activeFilterCount = [
    query,
    createdFrom && createdTo ? 'created_range' : '',
    status !== DEFAULT_STATUS ? status : '',
  ].filter(Boolean).length

  useEffect(() => setSearchInput(query), [query])

  const patchParams = (changes, { resetPage = true, replace = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value == null || value === '' || (key === 'ordering' && value === DEFAULT_ORDERING)) {
        next.delete(key)
      } else {
        next.set(key, String(value))
      }
    })
    if (resetPage) next.delete('page')
    setSearchParams(next, { replace })
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  const contactMutation = useMutation({
    mutationFn: ({ id }) => updateAdminConsultationLead(id, { status: 'contacted' }),
    onSuccess: () => {
      message.success('Đã đánh dấu lead là đã liên hệ.')
      if (status === 'new' && data.length === 1 && page > 1) {
        patchParams({ page: page - 1 }, { resetPage: false, replace: true })
        return queryClient.invalidateQueries({
          queryKey: consultationLeadKeys.adminLists,
          refetchType: 'none',
        })
      }
      return queryClient.invalidateQueries({ queryKey: consultationLeadKeys.adminLists })
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể cập nhật trạng thái lead.'))
    },
  })
  const exportMutation = useMutation({
    mutationFn: () => {
      const exportParams = { ...params }
      delete exportParams.page
      return exportAdminConsultationLeads(exportParams)
    },
    onSuccess: ({ blob, filename, truncated, rowLimit }) => {
      triggerDownload(blob, filename)
      if (truncated) {
        const safeRowLimit = rowLimit || 10000
        message.warning(`File đã giới hạn ở ${safeRowLimit.toLocaleString('vi-VN')} dòng. Hãy thu hẹp bộ lọc để xuất đủ dữ liệu.`)
      } else {
        message.success('Đã xuất danh sách lead theo bộ lọc hiện tại.')
      }
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể xuất danh sách lead.'))
    },
  })

  useEffect(() => {
    if (leadsQuery.isError) {
      message.error(getApiErrorMessage(
        leadsQuery.error,
        'Không thể tải danh sách yêu cầu tư vấn.',
      ))
    }
  }, [leadsQuery.error, leadsQuery.isError])

  const updatingId = contactMutation.isPending ? contactMutation.variables?.id : null
  const columns = [
    {
      title: 'Khách hàng',
      dataIndex: 'full_name',
      key: 'full_name',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'full_name'),
      width: 190,
      render: (value, row) => (
        <div>
          <strong>{value}</strong>
          <div className="font-mono text-[11px] text-slate-400">#{row.id}</div>
        </div>
      ),
    },
    {
      title: 'Công ty',
      dataIndex: 'company_name',
      key: 'company_name',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'company_name'),
      width: 190,
      render: (value) => value || '—',
    },
    {
      title: 'Liên hệ',
      key: 'email',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'email'),
      width: 230,
      render: (_, row) => (
        <div>
          <a href={`mailto:${row.email}`}>{row.email}</a>
          <div><a href={`tel:${row.phone}`} className="text-xs">{row.phone}</a></div>
        </div>
      ),
    },
    {
      title: 'Tỉnh/TP',
      dataIndex: 'province',
      key: 'province',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'province'),
      width: 130,
      render: (value) => value || '—',
    },
    {
      title: 'Nhu cầu, nguồn & ghi chú',
      dataIndex: 'need_label',
      key: 'need',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'need'),
      width: 330,
      render: (value, row) => (
        <div>
          <strong className="text-sm">{value || 'Chưa phân loại'}</strong>
          <div className="mt-1 text-xs text-slate-500">Nguồn: {row.source_page || '—'}</div>
          <div className="mt-1 line-clamp-2 text-xs text-slate-500" title={row.note || ''}>
            {row.note || 'Không có ghi chú'}
          </div>
        </div>
      ),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'created_at'),
      width: 175,
      render: (value) => new Date(value).toLocaleString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'status'),
      width: 135,
      render: (value) => (
        <Tag color={value === 'new' ? 'orange' : 'green'}>
          {value === 'new' ? 'Mới' : 'Đã liên hệ'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 78,
      render: (_, row) => row.status === 'new' ? (
        <Tooltip title="Đánh dấu đã liên hệ">
          <Button
            aria-label="Đã liên hệ"
            icon={<CheckCircleOutlined />}
            size="small"
            type="primary"
            loading={updatingId === row.id}
            disabled={contactMutation.isPending && updatingId !== row.id}
            onClick={() => contactMutation.mutate({ id: row.id })}
          />
        </Tooltip>
      ) : '—',
    },
  ]

  return (
    <AdminPanel
      title="Danh sách khách hàng"
      description={`${total.toLocaleString('vi-VN')} yêu cầu phù hợp với bộ lọc hiện tại`}
      extra={(
        <AdminDataActions
          allowExport={canExport}
          exportDisabled={total === 0}
          exportDisabledReason="Không có lead phù hợp để xuất"
          exportLabel="Xuất toàn bộ CSV"
          exportScopeLabel={`Xuất tối đa ${total.toLocaleString('vi-VN')} lead theo bộ lọc hiện tại`}
          exporting={exportMutation.isPending}
          onExport={() => exportMutation.mutate()}
          onRefresh={() => leadsQuery.refetch()}
          refreshing={leadsQuery.isFetching}
        />
      )}
    >
      <div className="admin-list-toolbar" data-print-hide="true">
        <div className="admin-list-toolbar__filters">
          <Input.Search
            allowClear
            aria-label="Tìm lead tư vấn"
            className="w-full sm:w-72"
            placeholder="Tên, công ty, email, SĐT"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onSearch={(value) => patchParams({ q: value.trim() })}
          />
          <Select
            aria-label="Lọc trạng thái lead"
            value={status}
            onChange={(value) => patchParams({ status: value })}
            className="w-full sm:w-48"
            options={STATUS_OPTIONS}
          />
          <DatePicker.RangePicker
            aria-label="Lọc ngày gửi lead"
            className="w-full sm:w-auto"
            format="DD/MM/YYYY"
            value={createdFrom && createdTo ? [dayjs(createdFrom), dayjs(createdTo)] : null}
            onChange={(dates) => patchParams({
              created_from: dates?.[0]?.format('YYYY-MM-DD') || '',
              created_to: dates?.[1]?.format('YYYY-MM-DD') || '',
            })}
          />
        </div>
        {activeFilterCount > 0 && (
          <Button icon={<FilterOutlined />} onClick={clearFilters}>
            Xóa {activeFilterCount} bộ lọc
          </Button>
        )}
      </div>

      {leadsQuery.isError && (
        <Alert
          action={<Button onClick={() => leadsQuery.refetch()}>Thử lại</Button>}
          className="mb-4"
          description={getApiErrorMessage(leadsQuery.error)}
          showIcon
          title="Không thể tải danh sách yêu cầu tư vấn"
          type="error"
        />
      )}

      <div className="overflow-x-auto">
        <Table
          rowKey="id"
          loading={leadsQuery.isFetching}
          dataSource={data}
          columns={columns}
          locale={{
            emptyText: (
              <Empty
                description={activeFilterCount
                  ? 'Không có lead phù hợp với bộ lọc'
                  : 'Chưa có yêu cầu tư vấn'}
              />
            ),
          }}
          onChange={(pagination, _, sorter) => {
            const selectedSorter = Array.isArray(sorter) ? sorter[0] : sorter
            const field = selectedSorter?.columnKey || selectedSorter?.field
            const nextOrdering = selectedSorter?.order
              ? `${selectedSorter.order === 'descend' ? '-' : ''}${field}`
              : DEFAULT_ORDERING
            patchParams({
              ordering: nextOrdering,
              page: pagination.current,
            }, { resetPage: false })
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (count, range) => `${range[0]}–${range[1]} / ${count} lead`,
          }}
          scroll={{ x: 1510 }}
          showSorterTooltip={{ target: 'sorter-icon' }}
        />
      </div>
    </AdminPanel>
  )
}
