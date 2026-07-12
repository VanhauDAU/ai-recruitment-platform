import {
  CloseOutlined,
  CommentOutlined,
  CustomerServiceOutlined,
  HeartFilled,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SafetyOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { App, Badge, Modal, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLoginPrompt } from '../../hooks/useLoginPrompt'
import { useSavedJobs } from '@/features/saved-jobs'
import { useSiteSettings } from '../../hooks/useSiteSettings'
import FeedbackModal from './FeedbackModal'

export default function FloatingActions() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { settings, siteName } = useSiteSettings()
  const { items, saveSuccess } = useSavedJobs()

  // Khách bấm "Việc làm đã lưu" -> popup đăng nhập rồi mới vào trang, thay vì bị đá về /login.
  function openSavedJobs() {
    setSupportOpen(false)
    if (isAuthenticated) navigate('/viec-lam-da-luu')
    else promptLogin(() => navigate('/viec-lam-da-luu'))
  }
  const [supportOpen, setSupportOpen] = useState(false)
  const [wantOpen, setWantOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [saveNoticeOpen, setSaveNoticeOpen] = useState(false)
  const [heartPulseKey, setHeartPulseKey] = useState(0)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    if (!saveSuccess) return undefined
    setSaveNoticeOpen(true)
    setHeartPulseKey((key) => key + 1)
    const timer = window.setTimeout(() => setSaveNoticeOpen(false), 9000)
    return () => window.clearTimeout(timer)
  }, [saveSuccess])

  useEffect(() => {
    if (!location.pathname.startsWith('/blog')) {
      setShowScrollTop(false)
      return undefined
    }
    const update = () => setShowScrollTop(window.scrollY > 420)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [location.pathname])

  const zaloUrl = settings.contact_zalo_url
  const hotline = settings.hotline

  function openZalo() {
    if (!zaloUrl) {
      message.info('Kênh Zalo chưa được cấu hình.')
      return
    }
    window.open(zaloUrl, '_blank', 'noreferrer')
  }

  const supportItems = [
    { key: 'safety', icon: <SafetyOutlined />, label: 'Hướng dẫn tìm việc an toàn', required: true, onClick: () => message.info('Nội dung sẽ sớm ra mắt.') },
    { key: 'faq', icon: <QuestionCircleOutlined />, label: 'Các câu hỏi thường gặp', onClick: () => message.info('Nội dung sẽ sớm ra mắt.') },
    { key: 'zalo', icon: <MessageOutlined />, label: 'Hỗ trợ qua Zalo', onClick: openZalo },
    {
      key: 'contact',
      icon: <PhoneOutlined />,
      label: `Liên hệ ${siteName}`,
      onClick: () => (hotline ? (window.location.href = `tel:${String(hotline).replace(/\s/g, '')}`) : message.info('Hotline chưa được cấu hình.')),
    },
  ]

  return (
    <>
      <div className="fixed bottom-5 right-4 z-30 flex flex-col items-end gap-2.5 md:bottom-8 md:right-6">
        {showScrollTop && (
          <Tooltip title="Lên đầu trang" placement="left">
            <button
              type="button"
              aria-label="Lên đầu trang"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-base text-slate-600 shadow-lg shadow-gray-500/15 transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              <UpOutlined />
            </button>
          </Tooltip>
        )}
        <div className="relative">
          {saveNoticeOpen && (
            <div
              role="status"
              className="absolute bottom-[calc(100%+12px)] right-0 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-emerald-100 bg-[#053a2c] p-3.5 text-xs leading-relaxed text-emerald-50 shadow-xl shadow-emerald-900/20"
              style={{ animation: 'savedNoticeIn 0.25s ease both' }}
            >
              <p className="font-bold text-white">Lưu tin thành công!</p>
              <p className="mt-0.5">
                Để xem <button type="button" onClick={openSavedJobs} className="cursor-pointer font-bold text-white underline underline-offset-2">Danh sách việc làm đã lưu</button>, click vào đây:
              </p>
            </div>
          )}
          <Tooltip title="Việc làm đã lưu" placement="left">
            <Badge count={items.length} size="small" offset={[-4, 4]}>
              <button
                key={heartPulseKey}
                type="button"
                aria-label="Việc làm đã lưu"
                onClick={openSavedJobs}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-lg text-rose-500 shadow-lg shadow-gray-500/15 transition hover:-translate-y-0.5 hover:border-rose-300"
                style={{ animation: heartPulseKey ? 'savedHeartButton 0.9s cubic-bezier(.2,.8,.2,1) both' : undefined }}
              >
                <HeartFilled />
              </button>
            </Badge>
          </Tooltip>
          <style>{`
            @keyframes savedHeartButton{0%{transform:scale(.72);box-shadow:0 0 0 0 rgba(16,185,129,.45)}45%{transform:scale(1.16);box-shadow:0 0 0 12px rgba(16,185,129,0)}75%{transform:scale(.96)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(16,185,129,0)}}
            @keyframes savedNoticeIn{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
          `}</style>
        </div>

        <button
          type="button"
          onClick={() => setWantOpen(true)}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white py-2.5 pl-3 pr-4 text-sm font-semibold text-gray-700 shadow-lg shadow-gray-500/15 transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          <CommentOutlined className="text-base" />
          Góp ý
        </button>

        {/* Bọc riêng nút Hỗ trợ trong 1 khối `relative` để panel neo `absolute`
            đúng ngay phía trên nút này (mép phải trùng mép phải nút), thay vì
            xếp chung hàng với cả cụm 3 nút — nếu không panel (rộng 300px) sẽ
            mở ra phía trên toàn bộ cụm nút hẹp hơn, trông như lệch/nổi bên trái. */}
        <div className="relative">
          {supportOpen && (
            <div
              className="absolute bottom-[calc(100%+12px)] right-0 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-500/15"
              style={{ animation: 'supportPanelIn 0.18s ease both' }}
            >
              <style>{`
                @keyframes supportPanelIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
              `}</style>
              <div className="flex items-start gap-3 bg-gradient-to-br from-[#053a2c] to-[var(--brand-primary)] p-4 text-white">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl">
                  <CustomerServiceOutlined />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Trung tâm hỗ trợ ứng viên</p>
                  <p className="mt-0.5 text-xs text-emerald-50">{siteName} thường phản hồi trong vòng 24h</p>
                </div>
                <button type="button" aria-label="Đóng" onClick={() => setSupportOpen(false)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white/80 hover:bg-white/15">
                  <CloseOutlined className="text-xs" />
                </button>
              </div>

              <div className="p-2">
                {supportItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-emerald-50/60"
                  >
                    <span className="text-base text-[var(--brand-primary)]">{item.icon}</span>
                    <span className="flex-1 text-sm font-medium text-gray-700">
                      {item.label}
                      {item.required && <span className="text-red-500"> *</span>}
                    </span>
                    <RightOutlined className="text-[10px] text-gray-300 transition group-hover:text-[var(--brand-primary)]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSupportOpen((open) => !open)}
            className={`flex cursor-pointer items-center gap-2 rounded-full py-2.5 pl-3 pr-4 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:-translate-y-0.5 ${
              supportOpen ? 'bg-[var(--brand-primary-hover)]' : 'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)]'
            }`}
          >
            <CustomerServiceOutlined className="text-base" />
            Hỗ trợ
          </button>
        </div>
      </div>

      {/* ── Modal giữa màn hình "Bạn muốn?" (từ nút Góp ý) ── */}
      <Modal open={wantOpen} onCancel={() => setWantOpen(false)} footer={null} centered width={560} title={null}>
        <div className="pt-2">
          <h3 className="text-center text-xl font-extrabold text-gray-900">Bạn muốn?</h3>
          <p className="mt-1 text-center text-sm text-gray-500">Chọn cách bạn muốn kết nối với {siteName}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setWantOpen(false); setFeedbackOpen(true) }}
              className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-gray-100 p-6 text-center transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:bg-emerald-50/40 hover:shadow-lg hover:shadow-emerald-600/10"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl text-[var(--brand-primary)] transition group-hover:scale-105">
                <MailOutlined />
              </span>
              <span className="text-base font-bold text-gray-900">Góp ý sản phẩm</span>
              <span className="text-sm leading-snug text-gray-500">Chia sẻ ý kiến, đề xuất và nhận xét về sản phẩm</span>
            </button>

            <button
              type="button"
              onClick={() => { setWantOpen(false); openZalo() }}
              className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-gray-100 p-6 text-center transition hover:-translate-y-0.5 hover:border-[#0068ff] hover:bg-blue-50/40 hover:shadow-lg hover:shadow-blue-600/10"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-lg font-extrabold text-[#0068ff] transition group-hover:scale-105">
                Zalo
              </span>
              <span className="text-base font-bold text-gray-900">Chat Zalo để được hỗ trợ</span>
              <span className="text-sm leading-snug text-gray-500">Yêu cầu hỗ trợ liên quan đến sản phẩm hoặc dịch vụ</span>
            </button>
          </div>

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs leading-snug text-emerald-800">
            <span className="text-sm">ℹ️</span>
            <span>Bạn đang gửi góp ý/yêu cầu hỗ trợ tới {siteName} — Nền tảng kết nối Ứng viên và Nhà tuyển dụng. Nhà tuyển dụng sẽ không đọc được góp ý này.</span>
          </p>
        </div>
      </Modal>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  )
}
