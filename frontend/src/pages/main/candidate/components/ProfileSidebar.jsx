import {
  CameraOutlined, CheckCircleFilled, CheckOutlined, PlusCircleOutlined,
  QrcodeOutlined, QuestionCircleOutlined, WarningFilled,
} from '@ant-design/icons'
import { App, Avatar, Switch } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { settingText, useSiteSettings } from '@/hooks/useSiteSettings'
import { DEFAULT_SITE_SETTINGS } from '@/contexts/siteSettingsContext'

// Cột phải của layout tài khoản (theo ảnh mẫu): thẻ chào + trạng thái tìm việc,
// cho phép NTD tìm hồ sơ, banner app và thẻ chất lượng CV.
// Giai đoạn khung: toggle chỉ đổi state cục bộ — wiring API đánh dấu TODO.
export default function ProfileSidebar() {
  return (
    <aside className="flex flex-col gap-4">
      <GreetingCard />
      <CvQualityCard />
    </aside>
  )
}

function GreetingCard() {
  const { user } = useAuth()
  const verified = user?.email_verified

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
          {/* TODO(profile): đổi avatar tại chỗ (upload) — làm ở phần thông tin cá nhân */}
          <button
            type="button"
            aria-label="Đổi ảnh đại diện"
            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] text-white ring-2 ring-white transition hover:bg-[var(--brand-primary-hover)]"
          >
            <CameraOutlined />
          </button>
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
          {/* Nâng cấp VIP là trang layout khác — chưa xây (todo trong candidateMenu). */}
          <button
            type="button"
            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            <PlusCircleOutlined /> Nâng cấp tài khoản
          </button>
        </div>
      </div>

      <SuggestionToggleRow />
      <JobSeekingToggleBlock />
      <RecruiterSearchBlock />
      <AppBanner />
    </section>
  )
}

function SuggestionToggleRow() {
  const { message } = App.useApp()
  // TODO(candidate-settings): đọc/ghi cờ gợi ý việc làm qua API candidate profile.
  const [enabled, setEnabled] = useState(false)

  function toggle(next) {
    setEnabled(next)
    message.success(next ? 'Đã bật gợi ý việc làm.' : 'Đã tắt gợi ý việc làm.')
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        Gợi ý việc làm
        <QuestionCircleOutlined className="text-xs text-slate-400" title="Nhận gợi ý việc làm phù hợp với hồ sơ của bạn" />
      </span>
      <button
        type="button"
        onClick={() => toggle(!enabled)}
        className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-bold transition-colors duration-200 ${
          enabled
            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
            : 'border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]'
        }`}
      >
        {enabled ? 'Đang bật' : 'Bật gợi ý'}
      </button>
    </div>
  )
}

function JobSeekingToggleBlock() {
  // TODO(candidate-settings): đồng bộ trạng thái "đang tìm việc" với backend.
  const [seeking, setSeeking] = useState(false)

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-800">
          Đang {seeking ? 'Bật' : 'Tắt'} tìm việc
        </span>
        <Switch checked={seeking} onChange={setSeeking} />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">Khi bật tìm việc:</p>
      <ul className="mt-1.5 space-y-1.5">
        <BenefitLine>
          Nhà tuyển dụng (NTD) có thể <b>tìm thấy</b> và mang đến cho bạn những cơ hội hấp dẫn
          (xem thêm tại phần Cho phép NTD tìm kiếm bên dưới).
        </BenefitLine>
        <BenefitLine>
          Hồ sơ của bạn sẽ <b>hiển thị nổi bật</b> trên kết quả tìm kiếm của Nhà tuyển dụng.
        </BenefitLine>
      </ul>
    </div>
  )
}

function RecruiterSearchBlock() {
  // TODO(candidate-settings): đếm CV đang bật cho phép tìm kiếm từ API user_cvs.
  const cvCount = 0

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <h3 className="text-sm font-bold text-slate-800">Cho phép NTD tìm kiếm hồ sơ</h3>
      <p className="mt-1 text-sm text-slate-600">
        Có <b>{cvCount} CV</b> đang bật cho phép NTD tìm kiếm
      </p>
      <Link
        to="/tai-khoan/cv-cua-toi"
        className="mt-2 inline-flex rounded-full border border-[var(--brand-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary-soft)]"
      >
        Quản lý danh sách
      </Link>
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        Khi bạn cho phép Nhà tuyển dụng (NTD) tìm kiếm hồ sơ, các NTD uy tín có thể tiếp cận
        thông tin kinh nghiệm làm việc, học vấn, kỹ năng... trên CV của bạn.
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

function CvQualityCard() {
  // TODO(profile-views): số lượt NTD xem CV lấy từ API khi xây trang "NTD xem hồ sơ".
  const viewCount = 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-bold text-[var(--brand-primary)]">CV của bạn đã đủ tốt?</h3>
      <p className="mt-1 text-sm text-slate-600">Bao nhiêu NTD đang quan tâm tới Hồ sơ của bạn?</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full bg-slate-400 text-white">
          <span className="text-2xl font-extrabold leading-6">{viewCount}</span>
          <span className="text-xs">lượt</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 text-slate-600">
            Mỗi lượt Nhà tuyển dụng xem CV mang đến một cơ hội để bạn gần hơn với công việc phù hợp.
          </p>
          <Link
            to="/tai-khoan/nha-tuyen-dung-xem-ho-so"
            className="mt-2 inline-flex rounded-lg border border-[var(--brand-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary-soft)]"
          >
            Khám phá ngay
          </Link>
        </div>
      </div>
    </section>
  )
}

function BenefitLine({ children }) {
  return (
    <li className="flex gap-2 text-xs leading-5 text-slate-500">
      <CheckOutlined className="mt-0.5 shrink-0 text-[var(--brand-primary)]" />
      <span>{children}</span>
    </li>
  )
}
