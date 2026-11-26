import { MailFilled, PhoneFilled } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { settingText, useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'
import ChatShowcase from '@/shared/ui/ChatShowcase'

const HOTLINE_BG_URL = '/images/home/hotline-bg.webp'
const HOTLINE_ILLUSTRATION_URL = '/images/home/hotline-consultation.webp'

const HOTLINE_TABS = [
  {
    key: 'candidate',
    label: 'Dành cho Người tìm việc',
    lead: 'Tìm việc khó',
    accent: 'đã có ProCV',
    emailLabel: 'Email hỗ trợ Ứng viên:',
    chatName: m.candidate_hotline_chat_candidate_name,
    badge: 'Xin chào',
    message: 'ProCV có thể giúp bạn điều gì?',
    chatData: {
      avatarInitials: 'TV',
      headerStatus: 'Trực tuyến',
      messages: [
        { from: 'support', text: 'Chào bạn! Mình là tư vấn viên ProCV, mình có thể giúp gì cho hành trình tìm việc của bạn?' },
        { from: 'user', text: 'Chào bạn, làm sao để CV của mình thu hút nhà tuyển dụng hơn ạ?' },
        { from: 'support', text: 'Bạn thử tính năng AI phân tích CV nhé, hệ thống sẽ gợi ý sửa chi tiết từng mục!' },
        { from: 'user', text: 'Tuyệt quá, để mình thử luôn. Cảm ơn bạn nhiều!' },
      ],
    },
  },
  {
    key: 'employer',
    label: 'Dành cho Nhà tuyển dụng',
    lead: 'Tuyển dụng hiệu quả',
    accent: 'đã có ProCV',
    emailLabel: 'Email hỗ trợ Nhà tuyển dụng:',
    chatName: m.candidate_hotline_chat_employer_name,
    badge: 'Tư vấn ngay',
    message: 'ProCV đồng hành cùng đội ngũ tuyển dụng',
    chatData: {
      avatarInitials: 'TV',
      headerStatus: 'Trực tuyến',
      messages: [
        { from: 'support', text: 'Kính chào Quý công ty! ProCV hỗ trợ tìm kiếm ứng viên chất lượng.' },
        { from: 'user', text: 'Chào bạn, bên mình muốn chạy lọc CV tự động theo JD có được không?' },
        { from: 'support', text: 'Dạ được ạ, hệ thống AI sẽ phân tích và xếp hạng độ trùng khớp ngay lập tức.' },
        { from: 'user', text: 'Hay quá, liên hệ tư vấn chi tiết cho mình nhé!' },
      ],
    },
  },
]

const telHref = (phone) => `tel:${phone.replace(/[^+\d]/g, '')}`

export default function HotlineConsultation() {
  const { settings } = useSiteSettings()
  const [activeKey, setActiveKey] = useState(HOTLINE_TABS[0].key)
  // Số/email lấy từ cấu hình hệ thống (nhóm Liên hệ), không viết cứng.
  const hotline = settingText(settings.hotline)
  const contact = {
    candidate: hotline,
    employer: settingText(settings.employer_hotline_north, hotline),
  }
  const email = settingText(settings.support_email)
  const active = useMemo(
    () => HOTLINE_TABS.find((tab) => tab.key === activeKey) || HOTLINE_TABS[0],
    [activeKey],
  )

  return (
    <section
      className="bg-[#063f36] bg-cover bg-center py-12 md:py-18"
      style={{ backgroundImage: `url("${HOTLINE_BG_URL}")` }}
    >
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="hotline-consultation-title" className="text-2xl font-extrabold text-white">Hotline Tư Vấn</h2>

        <div className="mt-4">
          <div role="tablist" aria-labelledby="hotline-consultation-title" className="flex items-end overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {HOTLINE_TABS.map((tab, index) => {
              const activeTab = tab.key === activeKey
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab}
                  onClick={() => setActiveKey(tab.key)}
                  className={`relative h-[50px] shrink-0 overflow-visible px-6 text-left text-xs font-extrabold transition md:h-[58px] md:w-[300px] md:text-base ${
                    activeTab
                      ? 'z-20 cursor-pointer text-[var(--brand-primary)]'
                      : 'z-10 cursor-pointer text-gray-500 hover:text-gray-600'
                  } ${index > 0 ? '-ml-8 pl-10 md:-ml-12 md:pl-16' : 'min-w-[200px] md:min-w-0'}`}
                >
                  <svg
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full drop-shadow-sm"
                    viewBox="0 0 430 82"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 14C0 6.3 6.3 0 14 0H314C345 0 363 18 389 46C409 68 428 82 430 82H0Z"
                      fill={activeTab ? '#ffffff' : '#e5e7eb'}
                    />
                  </svg>
                  <span className="relative z-10 block whitespace-nowrap pt-4 md:pt-[18px]">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="relative overflow-hidden rounded-b-3xl rounded-tr-3xl bg-[linear-gradient(100deg,#ffffff_0%,#ffffff_48%,#e4ffef_100%)] px-6 py-8 shadow-xl shadow-slate-900/10 md:px-12 md:py-12">
            {/* Ảnh minh hoạ làm nền mờ phía sau nội dung (trang trí, không cần alt) */}
            <img
              src={HOTLINE_ILLUSTRATION_URL}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-20 blur-sm"
            />
            <div className="relative z-10 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <h3 className="text-2xl font-extrabold leading-tight text-[#1f2937] md:text-3xl">
                  {active.lead} <span className="text-[var(--brand-primary)]">{active.accent}</span>
                </h3>

                {contact[active.key] && <div className="mt-7 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={telHref(contact[active.key])}
                    className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full !bg-[var(--brand-primary)] px-5 text-base font-extrabold !text-white shadow-lg shadow-[var(--brand-primary)]/20 transition hover:!bg-[var(--brand-primary-hover)]"
                  >
                    {contact[active.key]}
                  </a>
                  <a
                    href={telHref(contact[active.key])}
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] !bg-white px-7 text-sm font-extrabold !text-[var(--brand-primary)] transition hover:!bg-[var(--brand-primary-soft)]"
                  >
                    <PhoneFilled />
                    GỌI NGAY
                  </a>
                </div>}

                {email && <div className="mt-6 flex flex-wrap items-center gap-3 text-base font-bold text-gray-500">
                  <span>{active.emailLabel}</span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                    <MailFilled className="text-sm" />
                  </span>
                  <a href={`mailto:${email}`} className="font-extrabold !text-[var(--brand-primary)] hover:underline">
                    {email}
                  </a>
                </div>}
              </div>

              <div className="hidden md:flex justify-end items-center">
                <ChatShowcase dark={false} {...active.chatData} headerName={active.chatName()} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
