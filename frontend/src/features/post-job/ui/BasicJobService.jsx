import { CheckCircleFilled, ClockCircleOutlined, RocketOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Modal, Radio, Skeleton, Tag } from 'antd'
import { Link } from 'react-router'
import {
  activateEmployerService,
  getEmployerServiceInventory,
  previewEmployerServiceActivation,
} from '@/entities/service-package'
import { employerMarketingPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'

function formatDate(value) {
  return new Date(value).toLocaleDateString('vi-VN')
}

function activationKey() {
  return globalThis.crypto?.randomUUID?.() || `activation-${Date.now()}-${Math.random()}`
}

function errorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.join(' ')
  return fallback
}

export default function BasicJobService({ jobPublicId, jobStatus, activationEnabled = false }) {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState()
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [activating, setActivating] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const canActivate = Boolean(jobPublicId && jobStatus === 'active')

  const load = useCallback(async () => {
    if (!activationEnabled) {
      setUnits([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const inventory = await getEmployerServiceInventory()
      const available = inventory.filter((unit) => unit.is_activatable !== false && unit.status === 'available')
      setUnits(available)
      setSelectedId((current) => available.some((unit) => unit.public_id === current)
        ? current
        : available[0]?.public_id)
    } catch {
      message.error('Không thể tải kho dịch vụ.')
    } finally {
      setLoading(false)
    }
  }, [activationEnabled])

  useEffect(() => { load() }, [load])

  const openPreview = async () => {
    if (!selectedId || !jobPublicId) return
    setPreviewing(true)
    try {
      const result = await previewEmployerServiceActivation({
        unit_public_id: selectedId,
        job_public_id: jobPublicId,
      })
      setPreview(result)
      setConfirmed(false)
    } catch (error) {
      message.error(errorMessage(error, 'Không thể kiểm tra điều kiện kích hoạt.'))
    } finally {
      setPreviewing(false)
    }
  }

  const activate = async () => {
    setActivating(true)
    try {
      await activateEmployerService({
        unit_public_id: selectedId,
        job_public_id: jobPublicId,
        confirm_extension: confirmed,
      }, activationKey())
      message.success('Dịch vụ đã được kích hoạt cho tin này.')
      setPreview(null)
      await load()
    } catch (error) {
      message.error(errorMessage(error, 'Không thể kích hoạt dịch vụ.'))
    } finally {
      setActivating(false)
    }
  }

  if (loading) return <Skeleton active paragraph={{ rows: 2 }} />

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl text-emerald-600 shadow-sm"><RocketOutlined /></span>
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-slate-900">Tin đăng cơ bản</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">Hiển thị theo thứ tự tự nhiên sau khi được duyệt, không phát sinh chi phí.</p>
          </div>
          <Tag color="green" icon={<CheckCircleFilled />}>Đang áp dụng</Tag>
        </div>
      </div>

      {activationEnabled && units.length ? (
        <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Kho dịch vụ của doanh nghiệp</h3>
              <p className="mt-1 text-sm text-slate-500">Chọn một lượt và xem đầy đủ tác động trước khi xác nhận.</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-emerald-700">{units.length} lượt khả dụng</span>
              <Link target="_blank" rel="noreferrer" to={employerMarketingPath('/bao-gia')} className="text-slate-500 underline underline-offset-4 hover:text-emerald-700">Xem bảng giá</Link>
            </div>
          </div>
          <Radio.Group className="grid w-full gap-2 sm:grid-cols-2" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {units.map((unit) => (
              <Radio.Button key={unit.public_id} value={unit.public_id} className="!h-auto !whitespace-normal !rounded-lg !p-3">
                <span className="block font-semibold">{unit.package_name}</span>
                <span className="mt-1 block text-xs text-slate-500"><ClockCircleOutlined /> Kích hoạt trước {formatDate(unit.activate_by)}</span>
              </Radio.Button>
            ))}
          </Radio.Group>
          {!canActivate && <Alert className="mt-3" type="info" showIcon message="Lưu và chờ tin được duyệt trước khi kích hoạt dịch vụ." />}
          <Button className="mt-4 w-full sm:w-auto" type="primary" disabled={!canActivate || !selectedId} loading={previewing} onClick={openPreview}>Xem trước và kích hoạt</Button>
        </div>
      ) : activationEnabled ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lượt dịch vụ khả dụng">
          <Link target="_blank" rel="noreferrer" to={employerMarketingPath('/bao-gia')}><Button>Xem gói dịch vụ</Button></Link>
        </Empty>
      ) : (
        <div className="text-center">
          <Link target="_blank" rel="noreferrer" to={employerMarketingPath('/bao-gia')}><Button>Xem các gói gia tăng hiệu quả</Button></Link>
        </div>
      )}

      <Modal
        title="Xác nhận kích hoạt dịch vụ"
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        onOk={activate}
        okText="Kích hoạt ngay"
        cancelText="Đóng"
        confirmLoading={activating}
        okButtonProps={{ disabled: !preview?.can_activate || ((preview?.deadline_extension_required || preview?.visibility_extension_days > 0) && !confirmed) }}
        destroyOnHidden
      >
        {preview && <div className="space-y-4">
          {preview.blockers?.length > 0 && <Alert type="error" showIcon message="Chưa thể kích hoạt" description={preview.blockers.join(' ')} />}
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div><strong>Thời gian chạy:</strong> {formatDate(preview.starts_at)} – {formatDate(preview.ends_at)}</div>
            <div className="mt-2"><strong>Quyền lợi:</strong> {preview.items.map((item) => `${item.name}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join(', ')}</div>
          </div>
          {(preview.deadline_extension_required || preview.visibility_extension_days > 0) && (
            <Alert
              type="warning"
              showIcon
              message="Cần gia hạn tin để dịch vụ chạy đủ thời lượng"
              description={<>Hạn nhận hồ sơ sẽ được cập nhật đến <strong>{formatDate(preview.required_application_deadline)}</strong>. Tin được duy trì công khai đủ thời lượng dịch vụ; bạn không cần chọn thêm mốc thời gian nào.</>}
            />
          )}
          {(preview.deadline_extension_required || preview.visibility_extension_days > 0) && (
            <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>Tôi xác nhận gia hạn tin và kích hoạt trong cùng một giao dịch.</Checkbox>
          )}
        </div>}
      </Modal>
    </div>
  )
}
