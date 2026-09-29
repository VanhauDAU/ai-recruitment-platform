import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { Button, Switch } from 'antd'
import { Link } from 'react-router'
import ConfirmAction from '@/shared/ui/ConfirmAction'
import {
  formatJobAlertDelivery,
  JOB_ALERT_EMPLOYMENT_TYPE_OPTIONS,
  JOB_ALERT_EXPERIENCE_OPTIONS,
  JOB_ALERT_FREQUENCY_OPTIONS,
  JOB_ALERT_SALARY_OPTIONS,
  JOB_ALERT_SCOPE_OPTIONS,
  JOB_ALERT_WORK_TYPE_OPTIONS,
  labelFor,
  jobAlertResultsPath,
} from '../model/job-alert-form'

function CriteriaChip({ children }) {
  if (!children) return null
  return (
    <span title={typeof children === 'string' ? children : undefined} className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {children}
    </span>
  )
}

export default function JobAlertCard({
  alert,
  deleting,
  globalEnabled,
  interactionsDisabled,
  onDelete,
  onEdit,
  onToggle,
  toggling,
}) {
  const titleId = `candidate-job-alert-${alert.public_id}`
  const location = [alert.province?.name, alert.ward?.name].filter(Boolean).join(' · ')
  const nextDelivery = formatJobAlertDelivery(alert.next_delivery_at)
    || 'Được lên lịch sau khi có việc làm mới phù hợp'
  const categories = alert.categories || []
  const visibleCategories = categories.slice(0, 3)
  const hiddenCategoryCount = Math.max(categories.length - visibleCategories.length, 0)

  return (
    <article aria-labelledby={titleId} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-200 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 id={titleId} className="min-w-0 break-words text-base font-bold text-slate-900">{alert.keyword}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${alert.is_active && globalEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {alert.is_active && globalEnabled ? 'Đang nhận tin' : 'Đang tạm dừng'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {labelFor(JOB_ALERT_SCOPE_OPTIONS, alert.keyword_scope) || 'Tên vị trí tuyển dụng'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-0.5">
            <Button
              type="text"
              shape="circle"
              size="small"
              title="Sửa"
              aria-label={`Chỉnh sửa ${alert.keyword}`}
              icon={<EditOutlined />}
              disabled={interactionsDisabled}
              onClick={() => onEdit(alert)}
              className="!h-8 !w-8 !text-slate-500 hover:!bg-emerald-50 hover:!text-emerald-700"
            />
            <ConfirmAction
              title="Xóa thông báo"
              description={(
                <>
                  <p>Bạn có chắc muốn xóa thông báo việc làm <strong className="font-semibold">{alert.keyword}</strong> không?</p>
                  <p>Bạn sẽ ngừng nhận thông báo việc làm này.</p>
                </>
              )}
              confirmText="Xóa"
              cancelText="Đóng"
              danger
              disabled={interactionsDisabled}
              confirmLoading={deleting}
              onConfirm={() => onDelete(alert)}
            >
              <Button
                danger
                type="text"
                shape="circle"
                size="small"
                loading={deleting}
                title="Xóa"
                aria-label={`Xóa ${alert.keyword}`}
                icon={<DeleteOutlined />}
                disabled={interactionsDisabled}
                className="!h-8 !w-8"
              />
            </ConfirmAction>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Nhận tin</span>
            <Switch
              aria-label={`Nhận thông báo ${alert.keyword}`}
              checked={Boolean(alert.is_active)}
              loading={toggling}
              disabled={interactionsDisabled}
              onChange={(checked) => onToggle(alert, checked)}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {visibleCategories.map((category) => (
          <CriteriaChip key={category.id}>{category.name}</CriteriaChip>
        ))}
        {hiddenCategoryCount > 0 && (
          <CriteriaChip>{`+${hiddenCategoryCount} ngành nghề`}</CriteriaChip>
        )}
        <CriteriaChip>{location}</CriteriaChip>
        <CriteriaChip>{labelFor(JOB_ALERT_SALARY_OPTIONS, alert.salary_bucket)}</CriteriaChip>
        <CriteriaChip>{labelFor(JOB_ALERT_EXPERIENCE_OPTIONS, alert.experience_years)}</CriteriaChip>
        <CriteriaChip>{labelFor(JOB_ALERT_WORK_TYPE_OPTIONS, alert.work_type)}</CriteriaChip>
        <CriteriaChip>{labelFor(JOB_ALERT_EMPLOYMENT_TYPE_OPTIONS, alert.employment_type)}</CriteriaChip>
      </div>

      <div className="mt-3 flex flex-col gap-2.5 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs leading-5 text-slate-500">
          <p className="break-words">
            <b className="text-slate-700">{labelFor(JOB_ALERT_FREQUENCY_OPTIONS, alert.frequency) || 'Hàng ngày'} qua email</b>
            <span aria-hidden="true"> · </span>
            Gửi tiếp: {nextDelivery}
          </p>
          {!globalEnabled && <p className="font-medium text-amber-700">Cài đặt nhận email theo thiết lập đang tắt.</p>}
        </div>
        <Link
          to={jobAlertResultsPath(alert)}
          aria-label={`Xem danh sách việc làm ${alert.keyword}`}
          className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50"
        >
          Xem danh sách việc làm
        </Link>
      </div>
    </article>
  )
}
