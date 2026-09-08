import {
  AppstoreOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Form, Input, Select, Skeleton, Table, Tag } from 'antd'
import { useSearchParams } from 'react-router'
import { getAdminCompanies } from '@/entities/admin-company'
import {
  getAdminServiceActivations,
  getAdminServiceActivationSummary,
  terminateAdminServiceActivation,
} from '@/entities/service-package'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { message } from '@/shared/lib/toast'
import ConfirmActionModal from '@/shared/ui/ConfirmActionModal'
import { AdminPanel, AdminStatCard } from '@/shared/ui/admin'

const DEFAULT_ORDERING = '-created_at'
const DEFAULT_PAGE_SIZE = 20
const EMPTY_PAGE = { count: 0, results: [] }
const EMPTY_SUMMARY = {
  activation_counts: { total: 0, active: 0, expired: 0, terminated: 0 },
  active_total: 0,
  metrics: { available: false, impressions: 0, views: 0, saves: 0, applies: 0 },
  unit_counts: { available: 0, consumed: 0, expired: 0, revoked: 0 },
}
const STATUS_META = {
  active: { color: 'green', label: 'Đang chạy' },
  expired: { color: 'default', label: 'Đã kết thúc' },
  terminated: { color: 'red', label: 'Đã dừng' },
}
const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, item]) => ({
  value,
  label: item.label,
}))
const SEARCH_SCOPE_OPTIONS = [
  { value: 'job', label: 'Mã tin' },
  { value: 'campaign', label: 'Mã chiến dịch' },
]
const COLUMN_ORDERING = {
  company: 'company_name',
  job: 'job_title',
  package: 'package_name',
  status: 'status',
  starts_at: 'starts_at',
  ends_at: 'ends_at',
}

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value) {
  return number(value).toLocaleString('vi-VN')
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

function sortOrder(ordering, field) {
  if (ordering.replace(/^-/, '') !== field) return null
  return ordering.startsWith('-') ? 'descend' : 'ascend'
}

function orderingFor(sorter) {
  const field = COLUMN_ORDERING[sorter.columnKey]
  if (!field || !sorter.order) return DEFAULT_ORDERING
  return `${sorter.order === 'descend' ? '-' : ''}${field}`
}

function configurationLabel(value) {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ActivationDetails({ activation }) {
  const metrics = activation.metrics || {}
  const items = activation.items || []
  return (
    <div className="space-y-4 bg-slate-50 p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Hiệu quả dịch vụ">
        {[
          ['Hiển thị', metrics.impressions],
          ['Lượt xem', metrics.views],
          ['Lưu tin', metrics.saves],
          ['Ứng tuyển', metrics.applies],
        ].map(([label, value]) => (
          <article className="rounded-lg border border-slate-200 bg-white p-3" key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <strong className="mt-1 block text-lg text-slate-800">
              {metrics.available === false ? '—' : formatNumber(value)}
            </strong>
          </article>
        ))}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-800">Quyền lợi trong gói</h4>
          <span className="font-mono text-xs text-slate-500">{activation.public_id}</span>
        </div>
        {items.length ? (
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {items.map((item) => (
              <article
                className="rounded-lg border border-slate-200 bg-white p-3"
                key={`${activation.public_id}-${item.capability}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{item.name || item.capability}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.capability}</p>
                  </div>
                  <Tag>
                    Còn {number(item.remaining_quantity)}/{number(item.quantity)}
                  </Tag>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatDateTime(item.starts_at)} – {formatDateTime(item.ends_at)}
                </p>
                {Object.keys(item.configuration || {}).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(item.configuration).map(([key, value]) => (
                      <Tag key={key}>{key}: {configurationLabel(value)}</Tag>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Không có quyền lợi chi tiết.</p>
        )}
      </div>

      {metrics.available === false && (
        <p className="text-xs text-slate-500">Chưa có số liệu quảng bá được ghi nhận cho activation này.</p>
      )}

      {activation.status === 'terminated' && (
        <Alert
          showIcon
          type="error"
          title={`Đã dừng lúc ${formatDateTime(activation.terminated_at)}`}
          description={activation.termination_reason || 'Không có lý do được ghi nhận.'}
        />
      )}
    </div>
  )
}

export default function ServiceActivationsPanel({
  canManage = false,
  jobPublicId = '',
  jobTitle = '',
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [terminateForm] = Form.useForm()
  const terminationReason = Form.useWatch('reason', terminateForm) || ''
  const [pageData, setPageData] = useState(EMPTY_PAGE)
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [companies, setCompanies] = useState([])
  const [companySearch, setCompanySearch] = useState('')
  const [searchDraft, setSearchDraft] = useState(
    searchParams.get('activation_search') || '',
  )
  const [loadingList, setLoadingList] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [listError, setListError] = useState(null)
  const [summaryError, setSummaryError] = useState(null)
  const [terminateTarget, setTerminateTarget] = useState(null)
  const [terminating, setTerminating] = useState(false)
  const debouncedCompanySearch = useDebouncedValue(companySearch.trim(), 350)
  const isJobScoped = Boolean(jobPublicId)

  const page = positiveInteger(searchParams.get('activation_page'), 1)
  const pageSize = positiveInteger(
    searchParams.get('activation_page_size'),
    DEFAULT_PAGE_SIZE,
  )
  const ordering = searchParams.get('activation_ordering') || DEFAULT_ORDERING
  const companyPublicId = isJobScoped ? '' : searchParams.get('activation_company') || ''
  const status = isJobScoped ? '' : searchParams.get('activation_status') || ''
  const requestedSearchScope = searchParams.get('activation_search_scope') || 'job'
  const searchScope = SEARCH_SCOPE_OPTIONS.some((item) => item.value === requestedSearchScope)
    ? requestedSearchScope
    : 'job'
  const searchValue = isJobScoped ? '' : searchParams.get('activation_search') || ''

  const scopedSearchParams = useMemo(() => {
    if (isJobScoped) return { job_public_id: jobPublicId }
    if (!searchValue) return {}
    return searchScope === 'campaign'
      ? { campaign_public_id: searchValue }
      : { job_public_id: searchValue }
  }, [isJobScoped, jobPublicId, searchScope, searchValue])

  const updateParams = useCallback((updates, replace = true) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === '' || value === false) next.delete(key)
      else next.set(key, String(value))
    })
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const response = await getAdminServiceActivations({
        page,
        page_size: pageSize,
        ordering,
        ...(companyPublicId ? { company_public_id: companyPublicId } : {}),
        ...(status ? { status } : {}),
        ...scopedSearchParams,
      })
      setPageData(response || EMPTY_PAGE)
    } catch (error) {
      setListError(error)
    } finally {
      setLoadingList(false)
    }
  }, [companyPublicId, ordering, page, pageSize, scopedSearchParams, status])

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    setSummaryError(null)
    try {
      const response = await getAdminServiceActivationSummary({
        ...(companyPublicId ? { company_public_id: companyPublicId } : {}),
        ...scopedSearchParams,
      })
      setSummary(response || EMPTY_SUMMARY)
    } catch (error) {
      setSummaryError(error)
    } finally {
      setLoadingSummary(false)
    }
  }, [companyPublicId, scopedSearchParams])

  const searchCompanies = useCallback(async (query = '') => {
    try {
      const response = await getAdminCompanies({ q: query, page: 1, page_size: 20 })
      setCompanies(response?.results || [])
    } catch {
      setCompanies([])
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => {
    if (!isJobScoped) searchCompanies(debouncedCompanySearch)
  }, [debouncedCompanySearch, isJobScoped, searchCompanies])
  useEffect(() => { setSearchDraft(searchValue) }, [searchValue])

  const companyOptions = useMemo(() => {
    const options = companies.map((company) => ({
      value: company.public_id,
      label: `${company.company_name} · ${company.public_id}`,
    }))
    if (companyPublicId && !options.some((item) => item.value === companyPublicId)) {
      options.unshift({ value: companyPublicId, label: companyPublicId })
    }
    return options
  }, [companies, companyPublicId])

  const refresh = async () => Promise.all([loadList(), loadSummary()])

  const openTermination = (activation) => {
    terminateForm.resetFields()
    setTerminateTarget(activation)
  }

  const closeTermination = () => {
    if (terminating) return
    setTerminateTarget(null)
    terminateForm.resetFields()
  }

  const terminate = async () => {
    let values
    try {
      values = await terminateForm.validateFields()
    } catch {
      return
    }
    setTerminating(true)
    try {
      await terminateAdminServiceActivation(terminateTarget.public_id, values.reason.trim())
      message.success('Đã dừng dịch vụ và ghi nhận vào lịch sử.')
      setTerminateTarget(null)
      terminateForm.resetFields()
      await refresh()
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể dừng dịch vụ.'))
    } finally {
      setTerminating(false)
    }
  }

  const activationCounts = summary.activation_counts || EMPTY_SUMMARY.activation_counts
  const unitCounts = summary.unit_counts || EMPTY_SUMMARY.unit_counts
  const aggregateMetrics = summary.metrics || EMPTY_SUMMARY.metrics
  const columns = [
    {
      title: 'Doanh nghiệp',
      dataIndex: 'company_name',
      key: 'company',
      sorter: true,
      sortOrder: sortOrder(ordering, 'company_name'),
      width: 230,
      render: (value, row) => (
        <div className="min-w-44">
          <p className="font-medium text-slate-800">{value || '—'}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{row.company_public_id}</p>
        </div>
      ),
    },
    {
      title: 'Tin / chiến dịch',
      dataIndex: 'job_title',
      key: 'job',
      sorter: true,
      sortOrder: sortOrder(ordering, 'job_title'),
      width: 270,
      render: (value, row) => (
        <div className="min-w-52">
          <p className="font-medium text-slate-800">{value || '—'}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{row.job_public_id}</p>
          {row.campaign_name && (
            <p className="mt-1 truncate text-xs text-slate-500" title={row.campaign_name}>
              Chiến dịch: {row.campaign_name} · {row.campaign_public_id}
            </p>
          )}
        </div>
      ),
    },
    {
      title: 'Gói dịch vụ',
      dataIndex: 'package_name',
      key: 'package',
      sorter: true,
      sortOrder: sortOrder(ordering, 'package_name'),
      width: 190,
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800">{value || '—'}</p>
          {row.version_number && <p className="mt-1 text-xs text-slate-500">Phiên bản {row.version_number}</p>}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sortOrder(ordering, 'status'),
      width: 130,
      render: (value, row) => (
        <Tag color={value === 'active' && row.is_effective === false ? 'default' : STATUS_META[value]?.color}>
          {value === 'active' && row.is_effective === false
            ? 'Đã hết hiệu lực'
            : STATUS_META[value]?.label || value}
        </Tag>
      ),
    },
    {
      title: 'Bắt đầu',
      dataIndex: 'starts_at',
      key: 'starts_at',
      sorter: true,
      sortOrder: sortOrder(ordering, 'starts_at'),
      width: 165,
      render: formatDateTime,
    },
    {
      title: 'Kết thúc',
      dataIndex: 'ends_at',
      key: 'ends_at',
      sorter: true,
      sortOrder: sortOrder(ordering, 'ends_at'),
      width: 165,
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, activation) => (
        canManage && activation.status === 'active' && activation.is_effective !== false
          ? (
              <Button
                danger
                icon={<StopOutlined />}
                size="small"
                onClick={() => openTermination(activation)}
              >
                Dừng dịch vụ
              </Button>
            )
          : '—'
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {summaryError && (
        <Alert
          action={<Button size="small" onClick={loadSummary}>Thử lại</Button>}
          showIcon
          type="warning"
          title="Không thể tải thống kê dịch vụ."
        />
      )}

      {loadingSummary && !summaryError ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng quan kích hoạt dịch vụ">
            <AdminStatCard
              icon={<PlayCircleOutlined />}
              label="Đang chạy thực tế"
              value={formatNumber(summary.active_total)}
              detail="Trong thời gian hiệu lực"
              tone="green"
            />
            <AdminStatCard
              icon={<AppstoreOutlined />}
              label="Tổng kích hoạt"
              value={formatNumber(activationCounts.total)}
              detail={`${formatNumber(activationCounts.active)} bản ghi trạng thái đang chạy`}
            />
            <AdminStatCard
              icon={<CheckCircleOutlined />}
              label="Đã kết thúc"
              value={formatNumber(activationCounts.expired)}
              detail="Kết thúc theo thời hạn"
              tone="amber"
            />
            <AdminStatCard
              icon={<StopOutlined />}
              label="Đã dừng"
              value={formatNumber(activationCounts.terminated)}
              detail="Dừng sớm bởi quản trị viên"
              tone="red"
            />
          </section>

          <AdminPanel
            title="Hiệu quả và kho lượt"
            description="Số liệu cộng dồn theo doanh nghiệp, tin hoặc chiến dịch đang chọn; không suy diễn doanh thu."
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                [BarChartOutlined, 'Hiển thị', aggregateMetrics.impressions],
                [EyeOutlined, 'Lượt xem', aggregateMetrics.views],
                [SaveOutlined, 'Lưu tin', aggregateMetrics.saves],
                [FileDoneOutlined, 'Ứng tuyển', aggregateMetrics.applies],
              ].map(([Icon, label, value]) => (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-3.5" key={label}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                    <Icon className="text-emerald-600" aria-hidden />
                  </div>
                  <strong className="mt-2 block text-xl text-slate-800">
                    {aggregateMetrics.available === false ? '—' : formatNumber(value)}
                  </strong>
                </article>
              ))}
            </div>
            {aggregateMetrics.available === false && (
              <p className="mt-3 text-xs text-slate-500">Chưa có số liệu quảng bá trong phạm vi đang chọn.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <strong>Kho lượt:</strong>
              <Tag color="green">{formatNumber(unitCounts.available)} khả dụng</Tag>
              <Tag color="blue">{formatNumber(unitCounts.consumed)} đã dùng</Tag>
              <Tag>{formatNumber(unitCounts.expired)} hết hạn</Tag>
              <Tag color="red">{formatNumber(unitCounts.revoked)} thu hồi</Tag>
            </div>
          </AdminPanel>
        </>
      )}

      <AdminPanel
        title={isJobScoped ? 'Dịch vụ của tin tuyển dụng' : 'Danh sách kích hoạt'}
        description={isJobScoped
          ? `Toàn bộ lịch sử kích hoạt của ${jobTitle || jobPublicId}; số liệu phía trên chỉ thuộc tin này.`
          : 'Bộ lọc trạng thái chỉ áp dụng cho bảng; thống kê phía trên giữ tổng hợp đầy đủ trong cùng phạm vi.'}
        extra={(
          <Button
            icon={<ReloadOutlined />}
            loading={loadingList || loadingSummary}
            onClick={refresh}
          >
            Làm mới
          </Button>
        )}
      >
        {!isJobScoped && (
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(260px,1.1fr)_180px_160px_minmax(220px,1fr)]">
            <Select
              allowClear
              aria-label="Lọc theo doanh nghiệp"
              filterOption={false}
              onChange={(value) => updateParams({
                activation_company: value,
                activation_page: null,
              })}
              onSearch={setCompanySearch}
              options={companyOptions}
              placeholder="Tất cả doanh nghiệp"
              showSearch
              value={companyPublicId || undefined}
            />
            <Select
              allowClear
              aria-label="Lọc trạng thái dịch vụ"
              onChange={(value) => updateParams({
                activation_status: value,
                activation_page: null,
              })}
              options={STATUS_OPTIONS}
              placeholder="Tất cả trạng thái"
              value={status || undefined}
            />
            <Select
              aria-label="Chọn phạm vi tìm kiếm"
              onChange={(value) => updateParams({
                activation_search_scope: value === 'job' ? null : value,
                activation_page: null,
              })}
              options={SEARCH_SCOPE_OPTIONS}
              value={searchScope}
            />
            <Input.Search
              allowClear
              aria-label="Tìm dịch vụ theo mã"
              onChange={(event) => setSearchDraft(event.target.value)}
              onSearch={(value) => updateParams({
                activation_search: value.trim(),
                activation_page: null,
              })}
              placeholder={searchScope === 'campaign' ? 'Nhập mã chiến dịch' : 'Nhập mã tin tuyển dụng'}
              value={searchDraft}
            />
          </div>
        )}

        {listError && (
          <Alert
            action={<Button size="small" onClick={loadList}>Thử lại</Button>}
            className="mb-4"
            description={getApiErrorMessage(listError, 'Vui lòng kiểm tra kết nối và thử lại.')}
            showIcon
            title="Không thể tải danh sách dịch vụ."
            type="error"
          />
        )}

        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={pageData.results || []}
            expandable={{
              expandedRowRender: (activation) => <ActivationDetails activation={activation} />,
              rowExpandable: () => true,
            }}
            loading={loadingList}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Không có dịch vụ phù hợp với bộ lọc"
                />
              ),
            }}
            onChange={(pagination, _, sorter) => {
              const nextOrdering = orderingFor(sorter)
              const pageSizeChanged = pagination.pageSize !== pageSize
              const orderingChanged = nextOrdering !== ordering
              updateParams({
                activation_page: pageSizeChanged || orderingChanged || pagination.current === 1
                  ? null
                  : pagination.current,
                activation_page_size: pagination.pageSize === DEFAULT_PAGE_SIZE
                  ? null
                  : pagination.pageSize,
                activation_ordering: nextOrdering === DEFAULT_ORDERING
                  ? null
                  : nextOrdering,
              })
            }}
            pagination={{
              current: page,
              pageSize,
              showSizeChanger: true,
              showTotal: (total) => `${formatNumber(total)} dịch vụ`,
              total: number(pageData.count),
            }}
            rowKey="public_id"
            scroll={{ x: 1400 }}
            showSorterTooltip={{ target: 'sorter-icon' }}
          />
        </div>
      </AdminPanel>

      <ConfirmActionModal
        cancelText="Đóng"
        confirmDisabled={!terminationReason.trim()}
        confirmLoading={terminating}
        confirmText="Dừng dịch vụ"
        danger
        onCancel={closeTermination}
        onConfirm={terminate}
        open={Boolean(terminateTarget)}
        title="Dừng dịch vụ đang chạy"
      >
        <div className="text-left">
          <p>
            Dịch vụ <strong>{terminateTarget?.package_name}</strong> của tin{' '}
            <strong>{terminateTarget?.job_title}</strong> sẽ dừng ngay.
          </p>
          <Alert
            className="mt-3"
            showIcon
            type="error"
            title="Quyền lợi chưa dùng sẽ không được hoàn lại vào kho lượt."
            description="Thao tác được lưu vào lịch sử dịch vụ và không thể hoàn tác."
          />
          <Form className="mt-4" form={terminateForm} layout="vertical">
            <Form.Item
              label="Lý do dừng"
              name="reason"
              rules={[
                { required: true, whitespace: true, message: 'Nhập lý do dừng dịch vụ.' },
                { max: 500, message: 'Lý do tối đa 500 ký tự.' },
              ]}
            >
              <Input.TextArea
                aria-label="Lý do dừng dịch vụ"
                maxLength={500}
                placeholder="Nêu lý do để đối soát và hỗ trợ doanh nghiệp"
                rows={4}
                showCount
              />
            </Form.Item>
          </Form>
        </div>
      </ConfirmActionModal>
    </div>
  )
}
