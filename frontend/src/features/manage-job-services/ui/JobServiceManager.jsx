import { RocketOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Modal, Radio, Skeleton, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  activateEmployerService,
  getEmployerActiveServices,
  getEmployerServiceHistory,
  getEmployerServiceInventory,
  previewEmployerServiceActivation,
} from '@/entities/service-package'
import { employerMarketingPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import {
  formatServiceDate,
  serviceActionKey,
  serviceErrorMessage,
} from '../model/service-presentation'
import ServiceActivationList from './ServiceActivationList'
import JobServiceHistoryTable from './JobServiceHistoryTable'

export default function JobServiceManager({
  jobPublicId,
  jobStatus,
  campaignPublicId,
  activationEnabled = false,
  refreshEnabled = false,
  alertEnabled = false,
  metricsEnabled = false,
  showInventory = Boolean(jobPublicId),
  showActive = Boolean(jobPublicId || campaignPublicId),
}) {
  const [selectedId, setSelectedId] = useState()
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [activating, setActivating] = useState(false)
  const [jobServiceView, setJobServiceView] = useState('history')
  const scope = useMemo(() => ({
    ...(jobPublicId ? { job_public_id: jobPublicId } : {}),
    ...(campaignPublicId ? { campaign_public_id: campaignPublicId } : {}),
  }), [campaignPublicId, jobPublicId])
  const activeQuery = useQuery({
    queryKey: ['services', 'employer', 'active', scope],
    queryFn: () => getEmployerActiveServices(scope),
    enabled: activationEnabled && showActive && !jobPublicId,
  })
  const historyQuery = useQuery({
    queryKey: ['services', 'employer', 'history', 'job', jobPublicId],
    queryFn: () => getEmployerServiceHistory({
      job_public_id: jobPublicId,
      ordering: '-starts_at',
      page_size: 100,
    }),
    enabled: activationEnabled && showActive && Boolean(jobPublicId),
  })
  const inventoryQuery = useQuery({
    queryKey: ['services', 'employer', 'inventory'],
    queryFn: getEmployerServiceInventory,
    enabled: activationEnabled && showInventory,
  })
  const availableUnits = useMemo(() => (inventoryQuery.data || []).filter((unit) => (
    unit.status === 'available' && unit.is_activatable !== false
  )), [inventoryQuery.data])
  const canActivate = Boolean(jobPublicId && jobStatus === 'active')
  const jobHistory = historyQuery.data?.results || []
  const extensionRequired = Boolean(
    preview?.extension_required
      ?? (preview?.deadline_extension_required || preview?.visibility_extension_days > 0),
  )

  useEffect(() => {
    setSelectedId((current) => availableUnits.some((unit) => unit.public_id === current)
      ? current
      : availableUnits[0]?.public_id)
  }, [availableUnits])

  const refresh = async () => Promise.all([
    jobPublicId ? historyQuery.refetch() : activeQuery.refetch(),
    showInventory ? inventoryQuery.refetch() : Promise.resolve(),
  ])

  const openPreview = async () => {
    if (!selectedId || !jobPublicId) return
    setPreviewing(true)
    try {
      const result = await previewEmployerServiceActivation({
        unit_public_id: selectedId,
        job_public_id: jobPublicId,
      })
      setPreview(result)
    } catch (error) {
      message.error(serviceErrorMessage(error, 'Không thể kiểm tra điều kiện kích hoạt.'))
    } finally {
      setPreviewing(false)
    }
  }

  const activate = async (confirmExtension = false) => {
    setActivating(true)
    try {
      await activateEmployerService({
        unit_public_id: selectedId,
        job_public_id: jobPublicId,
        confirm_extension: confirmExtension,
      }, serviceActionKey('activation'))
      message.success('Dịch vụ đã được kích hoạt cho tin này.')
      setPreview(null)
      await refresh()
    } catch (error) {
      message.error(serviceErrorMessage(error, 'Không thể kích hoạt dịch vụ.'))
    } finally {
      setActivating(false)
    }
  }

  if (!activationEnabled) {
    return (
      <Alert
        type="info"
        showIcon
        title="Dịch vụ đang được mở theo từng nhóm doanh nghiệp"
        description="Khi được mở, bạn có thể theo dõi và sử dụng quyền lợi ngay tại đây."
      />
    )
  }
  if ((showActive && (jobPublicId ? historyQuery.isLoading : activeQuery.isLoading)) || (showInventory && inventoryQuery.isLoading)) {
    return <Skeleton active paragraph={{ rows: 4 }} />
  }
  if ((showActive && (jobPublicId ? historyQuery.isError : activeQuery.isError)) || (showInventory && inventoryQuery.isError)) {
    return (
      <Alert
        type="error"
        showIcon
        title="Không thể tải dữ liệu dịch vụ"
        description="Vui lòng thử lại sau. Trạng thái dịch vụ hiện tại không bị thay đổi."
        action={<Button size="small" onClick={refresh}>Thử lại</Button>}
      />
    )
  }

  const activeContent = showActive ? (
    <div className="space-y-4">
      <Alert
        showIcon
        type="info"
        title="Thời gian dịch vụ độc lập với trạng thái tin"
        description="Dịch vụ vẫn tiếp tục đếm ngược nếu tin hoặc chiến dịch bị tạm ẩn; thời gian đã trôi qua không được hoàn lại."
      />
      <Alert
        showIcon
        type="info"
        title="Quy tắc kết hợp dịch vụ"
        description="Các quyền lợi khác loại có thể chạy cùng nhau. Hiệu ứng cùng loại không được kích hoạt chồng thời gian; Làm mới tin và Job Alert là quyền lợi theo lượt nên vẫn cộng dồn."
      />
      {jobPublicId ? (
        <JobServiceHistoryTable
          activations={jobHistory}
          alertEnabled={alertEnabled}
          metricsEnabled={metricsEnabled}
          refreshEnabled={refreshEnabled}
          onChanged={refresh}
        />
      ) : (
        <ServiceActivationList
          activations={activeQuery.data || []}
          actionsEnabled
          alertEnabled={alertEnabled}
          metricsEnabled={metricsEnabled}
          refreshEnabled={refreshEnabled}
          onChanged={refresh}
          emptyDescription="Chiến dịch chưa có dịch vụ đang chạy"
        />
      )}
    </div>
  ) : null

  const inventoryContent = showInventory ? (availableUnits.length ? (
    <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-slate-900">Kho dịch vụ có thể kích hoạt</h2>
          <p className="mt-1 text-sm text-slate-500">Chọn một lượt và xem đầy đủ tác động trước khi xác nhận.</p>
        </div>
        <Link target="_blank" rel="noreferrer" to={employerMarketingPath('/bao-gia')} className="text-sm text-slate-500 underline underline-offset-4 hover:text-emerald-700">Xem bảng giá</Link>
      </div>
      <Radio.Group className="grid w-full gap-2 sm:grid-cols-2" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        {availableUnits.map((unit) => (
          <Radio.Button key={unit.public_id} value={unit.public_id} className="!h-auto !whitespace-normal !rounded-lg !p-3">
            <span className="block font-semibold">{unit.package_name}</span>
            <span className="mt-1 block text-xs text-slate-500">Kích hoạt trước {formatServiceDate(unit.activate_by)}</span>
          </Radio.Button>
        ))}
      </Radio.Group>
      {!canActivate && <Alert className="mt-3" type="info" showIcon title="Tin phải đang công khai trước khi kích hoạt dịch vụ." />}
      <Button className="mt-4 w-full sm:w-auto" type="primary" disabled={!canActivate || !selectedId} loading={previewing} onClick={openPreview}>Xem trước và kích hoạt</Button>
    </section>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lượt dịch vụ khả dụng">
      <Link target="_blank" rel="noreferrer" to={employerMarketingPath('/bao-gia')}><Button>Xem gói dịch vụ</Button></Link>
    </Empty>
  )) : null

  return (
    <div className="space-y-4">
      {jobPublicId && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl text-emerald-600 shadow-sm"><RocketOutlined /></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-slate-900">Tin đăng cơ bản</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Hiển thị theo thứ tự tự nhiên trong vòng đời công khai của tin.</p>
            </div>
            <Tag color="green">Đang áp dụng</Tag>
          </div>
        </div>
      )}

      {jobPublicId && showActive && showInventory ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div
            aria-label="Quản lý dịch vụ của tin"
            className="flex overflow-x-auto border-b border-slate-200 px-4"
            role="tablist"
          >
            {[
              ['history', `Lịch sử sử dụng dịch vụ/tiện ích (${historyQuery.data?.count ?? jobHistory.length})`],
              ['activate', `Kích hoạt thêm dịch vụ/tiện ích (${availableUnits.length})`],
            ].map(([key, label]) => (
              <button
                aria-selected={jobServiceView === key}
                className={`shrink-0 border-b-2 px-3 py-4 text-sm font-semibold transition sm:text-base ${jobServiceView === key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                key={key}
                onClick={() => setJobServiceView(key)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-4 sm:p-5" role="tabpanel">
            {jobServiceView === 'history' ? activeContent : inventoryContent}
          </div>
        </div>
      ) : (
        <>
          {activeContent}
          {inventoryContent}
        </>
      )}

      <Modal
        title={extensionRequired ? 'Gói vượt thời hạn hiện tại của tin' : 'Xác nhận kích hoạt dịch vụ'}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        closable={!activating}
        mask={{ closable: !activating }}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              disabled={activating}
              onClick={() => setPreview(null)}
            >
              {extensionRequired ? 'Giữ nguyên hạn' : 'Đóng'}
            </Button>
            <Button
              className="w-full sm:w-auto"
              type="primary"
              disabled={!preview?.can_activate}
              loading={activating}
              onClick={() => activate(extensionRequired)}
            >
              {extensionRequired
                ? `Gia hạn đến ${formatServiceDate(preview?.required_application_deadline)} và kích hoạt`
                : 'Kích hoạt ngay'}
            </Button>
          </div>
        )}
        destroyOnHidden
      >
        {preview && (
          <div className="space-y-4">
            {preview.blockers?.length > 0 && (
              <Alert type="warning" showIcon title="Chưa thể kích hoạt" description={preview.blockers.join(' ')} />
            )}
            {extensionRequired && preview.blockers?.length === 0 && (
              <Alert
                type="warning"
                showIcon
                title={preview.deadline_extension_required
                  ? 'Dịch vụ kết thúc sau hạn nhận hồ sơ hiện tại'
                  : 'Dịch vụ cần thêm thời gian công khai'}
                description={(
                  <div className="space-y-1">
                    {preview.current_application_deadline && (
                      <p>Hạn nhận hồ sơ hiện tại: <strong>{formatServiceDate(preview.current_application_deadline)}</strong>.</p>
                    )}
                    <p>Hệ thống sẽ không tự thay đổi tin. Chỉ nút “Gia hạn và kích hoạt” mới cập nhật thời hạn.</p>
                    <p>Nếu giữ nguyên hạn, dịch vụ chưa được kích hoạt và lượt vẫn nằm trong kho.</p>
                  </div>
                )}
              />
            )}
            <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              <p>Dịch vụ chạy đến <strong>{formatServiceDate(preview.ends_at)}</strong>.</p>
              {extensionRequired && preview.required_application_deadline && (
                <p>Muốn chạy đủ thời lượng, hạn nhận hồ sơ cần đến <strong>{formatServiceDate(preview.required_application_deadline)}</strong>.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
