import {
  ClockCircleOutlined,
  FileTextOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button, Tag } from 'antd'
import { Link } from 'react-router'
import { refreshEmployerJobService } from '@/entities/service-package'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/use-confirm-action'
import {
  formatServiceDate,
  SERVICE_STATUS_META,
  serviceActionKey,
  serviceDaysRemaining,
  serviceErrorMessage,
} from '../model/service-presentation'
import JobAlertAction from './JobAlertAction'

const METRICS = [
  ['Hiển thị tài trợ', 'impressions'],
  ['Lượt xem', 'views'],
  ['Lưu tin', 'saves'],
  ['Ứng tuyển', 'applies'],
]

export default function ServiceActivationCard({
  activation,
  actionsEnabled = false,
  alertEnabled = false,
  metricsEnabled = false,
  refreshEnabled = false,
  onChanged,
}) {
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const items = activation.items || []
  const refreshItem = items.find((item) => item.capability === 'job_refresh')
  const alertItem = items.find((item) => item.capability === 'job_alert')
  const hasSponsoredMetrics = items.some((item) => item.capability === 'sponsored_placement')
  const effective = activation.is_effective !== false && activation.status === 'active'
  const canUse = effective && activation.job_status === 'active'
  const statusMeta = activation.status === 'active' && !effective
    ? { color: 'default', label: 'Đã hết hiệu lực' }
    : SERVICE_STATUS_META[activation.status] || {
    color: 'default',
    label: activation.status,
      }
  const daysRemaining = effective
    ? serviceDaysRemaining(activation.ends_at)
    : null

  const requestRefresh = () => {
    requestConfirmation({
      title: 'Làm mới tin tuyển dụng',
      confirmText: 'Dùng 1 lượt',
      cancelText: 'Đóng',
      children: (
        <div className="space-y-2 text-sm text-slate-600">
          <p>Tin <strong className="text-slate-900">{activation.job_title}</strong> sẽ được đưa lên đầu nhóm tin tài trợ phù hợp.</p>
          <p>Thao tác dùng 1 lượt làm mới và không thay đổi ngày đăng. Hiện còn <strong>{refreshItem.remaining_quantity} lượt</strong>.</p>
        </div>
      ),
      onConfirm: async () => {
        await refreshEmployerJobService(
          activation.public_id,
          serviceActionKey('job-refresh'),
        )
        message.success('Tin đã được làm mới trong nhóm tài trợ.')
        await onChanged?.()
      },
      onConfirmError: (error) => message.error(
        serviceErrorMessage(error, 'Không thể làm mới tin.'),
      ),
    })
  }

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900">{activation.package_name}</h3>
            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            {daysRemaining != null && (
              <Tag color={daysRemaining <= 3 ? 'orange' : 'cyan'}>
                Còn {daysRemaining} ngày
              </Tag>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <Link
              className="inline-flex min-w-0 items-center gap-1 font-medium text-emerald-700 hover:text-emerald-600"
              to={employerAppPath(`/jobs/${activation.job_public_id}`)}
            >
              <FileTextOutlined /> <span className="truncate">{activation.job_title}</span>
            </Link>
            {activation.campaign_public_id && (
              <Link
                className="inline-flex min-w-0 items-center gap-1 font-medium text-sky-700 hover:text-sky-600"
                to={`${employerAppPath(`/campaigns/${activation.campaign_public_id}`)}?active_tab=services`}
              >
                <ThunderboltOutlined /> <span className="truncate">{activation.campaign_name}</span>
              </Link>
            )}
            <span><ClockCircleOutlined /> {formatServiceDate(activation.starts_at)} – {formatServiceDate(activation.ends_at)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {items.map((item) => (
              <Tag key={item.capability}>
                {item.name || item.capability_name || item.capability}
                {item.quantity > 1
                  ? ` · còn ${item.remaining_quantity}/${item.quantity}`
                  : ''}
              </Tag>
            ))}
          </div>
          {activation.status === 'terminated' && activation.termination_reason && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Dừng lúc {formatServiceDate(activation.terminated_at, true)} · {activation.termination_reason}
            </p>
          )}
        </div>
        {actionsEnabled && (refreshItem || alertItem) && (
          <div className="flex w-full shrink-0 flex-col gap-2 lg:w-auto">
            {refreshEnabled && refreshItem && (
              <Button
                className="w-full lg:w-auto"
                icon={<SyncOutlined />}
                disabled={!canUse || refreshItem.remaining_quantity < 1}
                onClick={requestRefresh}
              >
                {refreshItem.remaining_quantity > 0 ? 'Làm mới tin' : 'Đã dùng hết lượt'}
              </Button>
            )}
            {alertEnabled && alertItem && (
              <JobAlertAction
                activation={activation}
                item={alertItem}
                canUse={canUse}
                onChanged={onChanged}
              />
            )}
          </div>
        )}
      </div>

      {metricsEnabled && hasSponsoredMetrics && activation.metrics?.available !== false ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs text-slate-500">Số liệu được ghi nhận trong thời gian quyền lợi tài trợ hoạt động; không phải mức tăng thuần so với lượt tiếp cận tự nhiên.</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METRICS.map(([label, key]) => (
              <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 font-extrabold text-slate-800">
                  {Number(activation.metrics?.[key] || 0).toLocaleString('vi-VN')}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : metricsEnabled && hasSponsoredMetrics ? (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Chưa có số liệu quảng bá được ghi nhận cho dịch vụ này.
        </p>
      ) : metricsEnabled ? (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Gói này không có quyền lợi hiển thị tài trợ nên không áp dụng số liệu quảng bá.
        </p>
      ) : null}
      {confirmationModal}
    </article>
  )
}
