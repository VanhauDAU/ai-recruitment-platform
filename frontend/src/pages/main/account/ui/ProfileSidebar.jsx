import {
  CameraOutlined, CheckCircleFilled,
  QrcodeOutlined, QuestionCircleOutlined, WarningFilled,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { getMyCvs } from '@/entities/cv/cv'
import { useSession } from '@/entities/account/session'
import { AvatarEditorModal } from '@/features/common/account/edit-profile'
import { RecruiterSearchListModal } from '@/features/main/cv/update-recruiter-visibility'
import { DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/system/site-settings'

// Cột phải của layout tài khoản (theo ảnh mẫu): thẻ chào + trạng thái tìm việc,
// gợi ý việc làm, cho phép NTD tìm hồ sơ và banner app.
export default function ProfileSidebar() {
  return (
    <aside className="flex flex-col gap-4">
      <GreetingCard />
    </aside>
  )
}

function GreetingCard() {
  const { user } = useSession()
  // "Tài khoản đã xác thực" = đã chứng minh sở hữu email (link/OTP xác thực,
  // đăng nhập Google, đặt lại mật khẩu hoặc đổi email qua mã).
  const verified = user?.email_verified
  const [avatarOpen, setAvatarOpen] = useState(false)

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <div className="relative shrink-0">
          <Avatar size={64} src={user?.avatar_url || undefined} icon={<CameraOutlined />} />
          {verified && (
            <span className="absolute -left-1 -top-1 rounded bg-slate-800/90 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
              Verified
            </span>
          )}
          <button
            type="button"
            aria-label="Đổi ảnh đại diện"
            onClick={() => setAvatarOpen(true)}
            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] text-white ring-2 ring-white transition hover:bg-[var(--brand-primary-hover)]"
          >
            <CameraOutlined />
          </button>
          <AvatarEditorModal open={avatarOpen} onClose={() => setAvatarOpen(false)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">Chào bạn trở lại,</p>
          <p className="truncate text-base font-bold text-slate-900">{user?.full_name || 'Ứng viên'}</p>
          {verified ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-600 px-2 py-0.5 text-xs font-medium text-white">
              <CheckCircleFilled className="text-[10px]" /> Tài khoản đã xác thực
            </span>
          ) : (
            <Link
              to="/tai-khoan/xac-thuc-email"
              className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 hover:underline"
            >
              <WarningFilled /> Tài khoản chưa xác thực
            </Link>
          )}
        </div>
      </div>

      <SuggestionToggleRow />
      <RecruiterSearchBlock />
      <AppBanner />
    </section>
  )
}

function SuggestionToggleRow() {
  const { user } = useSession()
  const configured = Boolean(user?.job_preferences_configured)

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        Gợi ý việc làm
        <QuestionCircleOutlined className="text-xs text-slate-400" title="Nhận gợi ý việc làm phù hợp với hồ sơ của bạn" />
      </span>
      <Link
        to="/tai-khoan/cai-dat-goi-y-viec-lam"
        className="rounded-full border border-[var(--brand-primary)] px-4 py-1.5 text-sm font-bold text-[var(--brand-primary)] transition-colors duration-200 hover:bg-[var(--brand-primary-soft)]"
      >
        {configured ? 'Quản lý' : 'Thiết lập'}
      </Link>
    </div>
  )
}

function RecruiterSearchBlock() {
  // Công tắc trên thẻ CV làm mới ['my-cvs'] nên số này cập nhật ngay.
  const { data: cvs = [] } = useQuery({ queryKey: ['my-cvs', 'recruiter-searchable'], queryFn: getMyCvs })
  const cvCount = cvs.filter((cv) => cv.recruiter_searchable).length
  const [listOpen, setListOpen] = useState(false)

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <h3 className="text-sm font-bold text-slate-800">Cho phép NTD tìm kiếm hồ sơ</h3>
      <p className="mt-1 text-sm text-slate-600">
        Có <b>{cvCount} CV</b> đang bật cho phép NTD tìm kiếm
      </p>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        className="mt-2 inline-flex cursor-pointer rounded-full border border-[var(--brand-primary)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary-soft)]"
      >
        Quản lý danh sách
      </button>
      <RecruiterSearchListModal open={listOpen} onClose={() => setListOpen(false)} />
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        Tính năng NTD tìm kiếm ứng viên sắp ra mắt. Khi đó, NTD chỉ tìm thấy những CV bạn bật
        tại đây; tắt đồng ý sẽ gỡ toàn bộ CV khỏi tìm kiếm.
      </div>
    </div>
  )
}

function AppBanner() {
  const { settings } = useSiteSettings()
  const siteName = settingText(settings.site_name, DEFAULT_SITE_SETTINGS.site_name || 'ProCV')

  return (
    <div className="p-4 pt-1">
      {/* TODO(app-banner): thay bằng Banner placement riêng khi có app/QR thật. */}
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-600 p-3.5 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Tải App {siteName} ngay!</p>
          <p className="mt-0.5 text-xs leading-4 opacity-90">
            Để không bỏ lỡ bất cứ cơ hội nào từ Nhà tuyển dụng
          </p>
        </div>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-3xl text-slate-800">
          <QrcodeOutlined />
        </span>
      </div>
    </div>
  )
}
