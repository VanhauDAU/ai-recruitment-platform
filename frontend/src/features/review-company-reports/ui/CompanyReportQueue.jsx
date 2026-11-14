import { FilterOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Empty, Input, Select, Table, Tag } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import {
  COMPANY_REPORT_REASON_OPTIONS,
  COMPANY_REPORT_STATUS_OPTIONS,
  companyReportKeys,
  getAdminCompanyReports,
  resolveAdminCompanyReport,
  reverseAdminCompanyReport,
} from '@/entities/company-report'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { AdminDataActions, AdminPanel } from '@/shared/ui/admin'
import { companyReportColumns, formatDateTime } from './company-report-columns'
import CompanyReportDecisionModal from './CompanyReportDecisionModal'

const PAGE_SIZE = 20
const DEFAULT_STATUS = 'pending'
const DEFAULT_ORDERING = '-created_at'
const URL_DEFAULTS = { status: DEFAULT_STATUS, ordering: DEFAULT_ORDERING, page: '1' }
const FILTER_KEYS = ['status', 'reason', 'q', 'company', 'ordering', 'page']
const SUCCESS_MESSAGES = {
  uphold: 'Đã xác nhận báo cáo vi phạm.',
  dismiss: 'Đã bác báo cáo.',
  reverse: 'Đã gỡ kết luận, báo cáo quay lại hàng chờ.',
}

function positivePage(value) {
  const parsed = Number(value || 1)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

/** Hàng chờ báo cáo công ty; bộ lọc, thứ tự và trang đều là trạng thái URL. */
export default function CompanyReportQueue() {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const canResolve = adminAccess.has('company_report.resolve')
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawStatus = searchParams.get('status')
  const statusFilter = rawStatus === 'all' ? '' : rawStatus || DEFAULT_STATUS
  const reasonFilter = searchParams.get('reason') || ''
  const companyFilter = searchParams.get('company') || ''
  const query = searchParams.get('q') || ''
  const ordering = searchParams.get('ordering') || DEFAULT_ORDERING
  const page = positivePage(searchParams.get('page'))
  const [searchInput, setSearchInput] = useState(query)
  const [decision, setDecision] = useState({ action: 'uphold', open: false, report: null })
  const queryClient = useQueryClient()
  const params = useMemo(() => ({
    ...(statusFilter && { status: statusFilter }),
    ...(reasonFilter && { reason: reasonFilter }),
    ...(companyFilter && { company: companyFilter }),
    ...(query && { q: query }),
    ordering,
    page,
  }), [companyFilter, ordering, page, query, reasonFilter, statusFilter])
  const reportsQuery = useQuery({
    queryKey: companyReportKeys.adminList(params),
    queryFn: ({ signal }) => getAdminCompanyReports(params, { signal }),
    placeholderData: (previousData) => previousData,
  })
  const reports = reportsQuery.data?.results || []
  const total = reportsQuery.data?.count || 0
  const activeFilterCount = [
    query,
    reasonFilter,
    companyFilter,
    statusFilter !== DEFAULT_STATUS ? statusFilter || 'all' : '',
  ].filter(Boolean).length

  // Đổi bộ lọc hoặc thứ tự luôn về trang 1; giá trị mặc định không nằm trên URL.
  const patchParams = useCallback((changes, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    next.delete('page')
    Object.entries(changes).forEach(([key, value]) => {
      if (value == null || value === '' || String(value) === URL_DEFAULTS[key]) next.delete(key)
      else next.set(key, String(value))
    })
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  useEffect(() => setSearchInput(query), [query])

  useEffect(() => {
    const normalized = searchInput.trim()
    if (normalized === query) return undefined
    const timeoutId = window.setTimeout(() => patchParams({ q: normalized }, { replace: true }), 400)
    return () => window.clearTimeout(timeoutId)
  }, [patchParams, query, searchInput])

  const closeDecision = () => setDecision((current) => ({ ...current, open: false }))
  const decisionMutation = useMutation({
    mutationFn: ({ action, report, note, applyHold }) => (action === 'reverse'
      ? reverseAdminCompanyReport(report.public_id, note)
      : resolveAdminCompanyReport(report.public_id, {
          status: action === 'uphold' ? 'upheld' : 'dismissed',
          note,
          apply_hold: action === 'uphold' && applyHold,
        })),
    onSuccess: (_report, { action }) => {
      message.success(SUCCESS_MESSAGES[action])
      closeDecision()
      queryClient.invalidateQueries({ queryKey: companyReportKeys.adminLists })
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể cập nhật báo cáo. Danh sách sẽ được tải lại.'))
      queryClient.invalidateQueries({ queryKey: companyReportKeys.adminLists })
    },
  })

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    FILTER_KEYS.forEach((key) => next.delete(key))
    setSearchInput('')
    setSearchParams(next)
  }

  function changeTable(pagination, _filters, sorter, { action }) {
    if (action !== 'sort') {
      patchParams({ page: pagination.current })
      return
    }
    // Bỏ chọn sorter quay về thứ tự mặc định; đang ở mặc định thì đảo chiều để
    // cột thời điểm vẫn sắp tăng dần được.
    const cleared = ordering === DEFAULT_ORDERING ? DEFAULT_ORDERING.slice(1) : DEFAULT_ORDERING
    patchParams({
      ordering: sorter.order ? `${sorter.order === 'descend' ? '-' : ''}${sorter.columnKey}` : cleared,
    })
  }

  const columns = companyReportColumns({
    ordering,
    origin: { pathname: location.pathname, search: location.search, label: 'Báo cáo công ty' },
    busy: decisionMutation.isPending,
    canOpenCompany: adminAccess.has('company.view'),
    canResolve,
    onDecide: (report, action) => setDecision({ action, open: true, report }),
    onFilterCompany: companyFilter ? undefined : (company) => patchParams({ company }),
  })

  return (
    <AdminPanel
      description={`${total.toLocaleString('vi-VN')} báo cáo phù hợp. Trang công ty chỉ bị tạm ẩn khi quản trị viên chọn lúc xác nhận vi phạm.`}
      extra={(
        <AdminDataActions
          allowExport={false}
          onRefresh={() => reportsQuery.refetch()}
          refreshing={reportsQuery.isFetching}
        />
      )}
    >
      <div className="admin-list-toolbar" data-print-hide="true">
        <div className="admin-list-toolbar__filters">
          <Input.Search
            allowClear
            aria-label="Tìm báo cáo công ty"
            className="w-full sm:w-72"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Mã, công ty, email, nội dung"
            value={searchInput}
          />
          <Select
            aria-label="Lọc trạng thái báo cáo"
            className="w-full sm:w-52"
            onChange={(value) => patchParams({ status: value || 'all' })}
            options={[...COMPANY_REPORT_STATUS_OPTIONS, { value: '', label: 'Tất cả trạng thái' }]}
            value={statusFilter}
          />
          <Select
            allowClear
            aria-label="Lọc lý do báo cáo"
            className="w-full sm:w-60"
            onChange={(value) => patchParams({ reason: value })}
            options={COMPANY_REPORT_REASON_OPTIONS}
            placeholder="Tất cả lý do"
            value={reasonFilter || undefined}
          />
          {companyFilter && (
            <Tag closable onClose={() => patchParams({ company: '' })}>
              {`Công ty: ${reports[0]?.company.display_name || companyFilter}`}
            </Tag>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button icon={<FilterOutlined />} onClick={clearFilters}>
            Xóa {activeFilterCount} bộ lọc
          </Button>
        )}
      </div>

      {!canResolve && (
        <Alert
          className="mb-4"
          showIcon
          title="Bạn có quyền xem nhưng không có quyền xử lý báo cáo."
          type="info"
        />
      )}
      {reportsQuery.isError && (
        <Alert
          action={<Button onClick={() => reportsQuery.refetch()} size="small">Thử lại</Button>}
          className="mb-4"
          showIcon
          title={`Không thể tải danh sách báo cáo. ${getApiErrorMessage(reportsQuery.error)}`}
          type="error"
        />
      )}
      <div className="overflow-x-auto">
        <Table
          columns={columns}
          dataSource={reports}
          expandable={{
            expandedRowRender: (report) => (
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                size="small"
                items={[
                  { key: 'resolution_note', label: 'Ghi chú kết luận gần nhất', children: report.resolution_note || '—' },
                  { key: 'resolved_by', label: 'Người xử lý gần nhất', children: report.resolved_by_email || '—' },
                  { key: 'resolved_at', label: 'Thời điểm xử lý', children: formatDateTime(report.resolved_at) },
                  { key: 'history', label: 'Số lần quyết định', children: report.resolution_history?.length || 0 },
                ]}
              />
            ),
          }}
          loading={reportsQuery.isFetching}
          locale={{
            emptyText: (
              <Empty description={activeFilterCount
                ? 'Không có báo cáo phù hợp với bộ lọc.'
                : 'Chưa có báo cáo trong hàng đợi.'}
              />
            ),
          }}
          onChange={changeTable}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            showTotal: (count, range) => `${range[0]}–${range[1]} / ${count} báo cáo`,
            total,
          }}
          rowKey="public_id"
          scroll={{ x: 1510 }}
          showSorterTooltip={{ target: 'sorter-icon' }}
        />
      </div>
      <CompanyReportDecisionModal
        canHoldPage={adminAccess.has('company_page.moderate')}
        decision={decision}
        onCancel={() => {
          if (!decisionMutation.isPending) closeDecision()
        }}
        onSubmit={(values) => decisionMutation.mutate({ ...decision, ...values })}
        pending={decisionMutation.isPending}
      />
    </AdminPanel>
  )
}
