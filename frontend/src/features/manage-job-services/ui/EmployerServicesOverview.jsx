import {
  BarChartOutlined,
  ClockCircleOutlined,
  GiftOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Empty, Pagination, Select, Skeleton, Tabs, Tag } from 'antd'
import { useMemo, useState } from 'react'
import {
  getEmployerActiveServices,
  getEmployerServiceHistory,
  getEmployerServiceInventory,
} from '@/entities/service-package'
import { formatServiceDate } from '../model/service-presentation'
import ServiceActivationList from './ServiceActivationList'

function SummaryCard({ icon, label, value, helper }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">{icon}</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">{helper}</p>
    </article>
  )
}

export default function EmployerServicesOverview({
  activationEnabled = false,
  refreshEnabled = false,
  alertEnabled = false,
  metricsEnabled = false,
}) {
  const [historyPage, setHistoryPage] = useState(1)
  const [historyStatus, setHistoryStatus] = useState('')
  const historyParams = useMemo(() => ({
    page: historyPage,
    page_size: 10,
    ordering: '-starts_at',
    ...(historyStatus ? { status: historyStatus } : {}),
  }), [historyPage, historyStatus])
  const activeQuery = useQuery({
    queryKey: ['services', 'employer', 'active', 'all'],
    queryFn: () => getEmployerActiveServices({}),
    enabled: activationEnabled,
  })
  const inventoryQuery = useQuery({
    queryKey: ['services', 'employer', 'inventory'],
    queryFn: getEmployerServiceInventory,
    enabled: activationEnabled,
  })
  const historyQuery = useQuery({
    queryKey: ['services', 'employer', 'history', historyParams],
    queryFn: () => getEmployerServiceHistory(historyParams),
    enabled: activationEnabled,
  })
  const inventory = inventoryQuery.data || []
  const availableUnits = inventory.filter((unit) => unit.status === 'available')
  const active = activeQuery.data || []
  const history = historyQuery.data || { count: 0, results: [] }
  const sponsored = active.filter((activation) => activation.items?.some(
    (item) => item.capability === 'sponsored_placement',
  ))
  const metricsAvailable = sponsored.some(
    (activation) => activation.metrics?.available !== false,
  )
  const impressions = sponsored.reduce(
    (total, activation) => total + Number(activation.metrics?.impressions || 0),
    0,
  )
  const applies = sponsored.reduce(
    (total, activation) => total + Number(activation.metrics?.applies || 0),
    0,
  )
  const loading = activeQuery.isLoading || inventoryQuery.isLoading || historyQuery.isLoading
  const error = activeQuery.isError || inventoryQuery.isError || historyQuery.isError
  const refresh = async () => Promise.all([
    activeQuery.refetch(),
    inventoryQuery.refetch(),
    historyQuery.refetch(),
  ])

  if (!activationEnabled) {
    return (
      <Alert
        type="info"
        showIcon
        title="Dịch vụ của tôi đang được mở theo từng nhóm doanh nghiệp"
        description="Trang này sẽ hiển thị kho lượt, dịch vụ đang chạy và lịch sử ngay khi doanh nghiệp được bật quyền kích hoạt."
      />
    )
  }
  if (loading && !activeQuery.data) return <Skeleton active paragraph={{ rows: 10 }} />
  if (error && !activeQuery.data) {
    return <Alert type="error" showIcon title="Không thể tải dịch vụ của doanh nghiệp" description="Vui lòng tải lại trang. Không có dịch vụ nào bị thay đổi." />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<RocketOutlined />} label="Đang chạy" value={active.length} helper="Dịch vụ còn hiệu lực trên tin của bạn" />
        <SummaryCard icon={<GiftOutlined />} label="Chưa sử dụng" value={availableUnits.length} helper="Gồm cả lượt đã quá hạn kích hoạt" />
        <SummaryCard icon={<BarChartOutlined />} label="Hiển thị tài trợ" value={metricsEnabled && metricsAvailable ? impressions.toLocaleString('vi-VN') : '—'} helper="Chỉ số được gắn với activation tài trợ" />
        <SummaryCard icon={<ClockCircleOutlined />} label="Ứng tuyển ghi nhận" value={metricsEnabled && metricsAvailable ? applies.toLocaleString('vi-VN') : '—'} helper="Không phải mức tăng thuần so với organic" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Tabs
          className="[&_.ant-tabs-nav]:!mb-0 [&_.ant-tabs-nav]:px-4 [&_.ant-tabs-content]:p-4 sm:[&_.ant-tabs-content]:p-5"
          items={[
            {
              key: 'active',
              label: `Đang chạy (${active.length})`,
              children: (
                <ServiceActivationList
                  activations={active}
                  actionsEnabled
                  alertEnabled={alertEnabled}
                  metricsEnabled={metricsEnabled}
                  refreshEnabled={refreshEnabled}
                  onChanged={refresh}
                  emptyDescription="Bạn chưa có dịch vụ đang chạy"
                />
              ),
            },
            {
              key: 'inventory',
              label: `Chưa sử dụng (${availableUnits.length})`,
              children: availableUnits.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {availableUnits.map((unit) => (
                    <article key={unit.public_id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900">{unit.package_name}</h3>
                        <Tag color={unit.is_activatable === false ? 'red' : 'green'}>
                          {unit.is_activatable === false ? 'Quá hạn kích hoạt' : 'Sẵn sàng'}
                        </Tag>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">Kích hoạt trước {formatServiceDate(unit.activate_by)}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(unit.items || []).map((item) => (
                          <Tag key={item.capability || item.code || item.name}>{item.name || item.capability_name || item.capability || item.code}</Tag>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">Mở một tin đang công khai và vào tab “Dịch vụ & hiệu quả” để kích hoạt lượt này.</p>
                    </article>
                  ))}
                </div>
              ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lượt dịch vụ chưa sử dụng" />,
            },
            {
              key: 'history',
              label: `Lịch sử (${history.count || 0})`,
              children: (
                <div className="space-y-4">
                  <Select
                    aria-label="Lọc trạng thái lịch sử dịch vụ"
                    className="w-full sm:w-56"
                    value={historyStatus}
                    options={[
                      { value: '', label: 'Tất cả trạng thái' },
                      { value: 'active', label: 'Đang chạy' },
                      { value: 'expired', label: 'Đã kết thúc' },
                      { value: 'terminated', label: 'Đã dừng' },
                    ]}
                    onChange={(value) => { setHistoryStatus(value); setHistoryPage(1) }}
                  />
                  <ServiceActivationList
                    activations={history.results || []}
                    metricsEnabled={metricsEnabled}
                    emptyDescription="Chưa có lịch sử kích hoạt"
                  />
                  {(history.count || 0) > 10 && (
                    <Pagination
                      current={historyPage}
                      pageSize={10}
                      total={history.count}
                      showSizeChanger={false}
                      onChange={setHistoryPage}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
