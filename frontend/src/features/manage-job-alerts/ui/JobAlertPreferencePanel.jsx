import { CheckCircleOutlined, MailOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, Button, Skeleton, Switch } from 'antd'

function PreferenceRow({ checked, description, disabled, icon, label, loading, onChange }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-slate-200 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-700">{icon}</span>
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-slate-800">{label}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <Switch aria-label={label} checked={checked} disabled={disabled} loading={loading} onChange={onChange} />
    </div>
  )
}

export default function JobAlertPreferencePanel({
  disabled,
  error,
  loading,
  masterEnabled,
  onChange,
  onRetry,
  savingField,
  suitableEnabled,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <SafetyCertificateOutlined className="text-emerald-600" />
        <h2 className="text-sm font-bold text-slate-800">Cài đặt nhận email</h2>
      </div>
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : error ? (
        <Alert
          showIcon
          type="error"
          title="Không thể tải cài đặt nhận email"
          action={<Button icon={<ReloadOutlined />} onClick={onRetry}>Thử lại</Button>}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          <PreferenceRow
            icon={<MailOutlined />}
            label="Nhận thông báo việc làm theo thiết lập"
            description="Công tắc chung cho toàn bộ bộ tiêu chí bạn tạo bên dưới."
            checked={masterEnabled}
            loading={savingField === 'configured_job_alerts'}
            disabled={disabled}
            onChange={(checked) => onChange('configured_job_alerts', checked)}
          />
          <PreferenceRow
            icon={<CheckCircleOutlined />}
            label="Nhận thông báo việc làm phù hợp"
            description="Nhận bản tổng hợp gợi ý dựa trên nhu cầu công việc và CV vào 08:00 thứ Hai hằng tuần."
            checked={suitableEnabled}
            loading={savingField === 'suitable_job_recommendations'}
            disabled={disabled}
            onChange={(checked) => onChange('suitable_job_recommendations', checked)}
          />
        </div>
      )}
    </div>
  )
}
