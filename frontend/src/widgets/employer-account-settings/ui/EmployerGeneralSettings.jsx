import { MailOutlined } from '@ant-design/icons'
import { Switch, Tooltip } from 'antd'
import { TwoFactorMethodsPanel } from '@/features/two-factor'

export default function EmployerGeneralSettings() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-slate-200 p-3 sm:gap-4 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600"><MailOutlined /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-800">Thông báo CV ứng tuyển</p>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">Đang hoạt động</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">Tự động gửi email khi ứng viên ứng tuyển vào tin tuyển dụng của bạn</p>
        </div>
        <Tooltip title="Thông báo email luôn được bật; tùy chọn cấu hình sẽ có ở giai đoạn tiếp theo."><Switch checked disabled /></Tooltip>
      </div>

      <TwoFactorMethodsPanel />
    </div>
  )
}
