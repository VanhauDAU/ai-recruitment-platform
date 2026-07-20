import { MailFilled, PhoneFilled } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import ChatShowcase from '@/shared/ui/ChatShowcase'

const HOTLINE_BG_URL = 'https://pub-8375cfb0dcca48ed8459003b91080f08.r2.dev/frontend/legacy/home/hotline-bg.png'

const HOTLINE_TABS = [
  {
    key: 'candidate',
    label: 'Dành cho Người tìm việc',
    lead: 'Tìm việc khó',
    accent: 'đã có ProCV',
    phone: '1900 068 889 | Nhánh 2',
    emailLabel: 'Email hỗ trợ Ứng viên:',
    email: 'hotro@aicareer.vn',
    badge: 'Xin chào',
    message: 'ProCV có thể giúp bạn điều gì?',
    chatData: {
      avatarInitials: 'AI',
      headerName: 'AI Coach',
      headerStatus: 'Trực tuyến',
      messages: [
        { from: 'recruiter', text: 'Chào bạn! Mình có thể giúp gì cho hành trình tìm việc của bạn hôm nay?' },
        { from: 'candidate', text: 'Chào Coach, làm sao để tối ưu CV thu hút nhà tuyển dụng hơn ạ?' },
        { from: 'recruiter', text: 'Bạn hãy bật tính năng AI Phân tích CV, hệ thống sẽ gợi ý sửa chi tiết nhé!' },
        { from: 'candidate', text: 'Tuyệt quá, để mình thử luôn. Cảm ơn Coach nhiều!' },
      ],
    },
  },
  {
    key: 'employer',
    label: 'Dành cho Nhà tuyển dụng',
    lead: 'Tuyển dụng hiệu quả',
    accent: 'đã có ProCV',
    phone: '1900 068 889 | Nhánh 1',
    emailLabel: 'Email hỗ trợ Nhà tuyển dụng:',
    email: 'hotro@aicareer.vn',
    badge: 'Tư vấn ngay',
    message: 'ProCV đồng hành cùng đội ngũ tuyển dụng',
    chatData: {
      avatarInitials: 'HR',
      headerName: 'Hỗ Trợ Tuyển Dụng',
      headerStatus: 'Trực tuyến',
      messages: [
        { from: 'recruiter', text: 'Kính chào Quý công ty! ProCV hỗ trợ tìm kiếm ứng viên chất lượng.' },
        { from: 'candidate', text: 'Chào bạn, bên mình muốn chạy lọc CV tự động theo JD có được không?' },
        { from: 'recruiter', text: 'Dạ được ạ, hệ thống AI sẽ phân tích và xếp hạng độ trùng khớp ngay lập tức.' },
        { from: 'candidate', text: 'Hay quá, liên hệ tư vấn chi tiết cho mình nhé!' },
      ],
    },
  },
]

export default function HotlineConsultation() {
  const [activeKey, setActiveKey] = useState(HOTLINE_TABS[0].key)
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
        <h2 className="text-2xl font-extrabold text-white">Hotline Tư Vấn</h2>

        <div className="mt-4">
          <div className="flex items-end overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

          <div className="relative overflow-hidden rounded-b-3xl rounded-tr-3xl bg-[linear-gradient(100deg,#ffffff_0%,#ffffff_48%,#e4ffef_100%)] px-6 py-8 shadow-xl shadow-emerald-950/15 md:px-12 md:py-12">
            <div className="relative z-10 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <h3 className="text-2xl font-extrabold leading-tight text-[#1f2937] md:text-3xl">
                  {active.lead} <span className="text-[var(--brand-primary)]">{active.accent}</span>
                </h3>

                <div className="mt-7 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href="tel:1900068889"
                    className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full bg-[#039b49] px-5 text-base font-extrabold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-[var(--brand-primary-hover)]"
                  >
                    {active.phone}
                  </a>
                  <a
                    href="tel:1900068889"
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-7 text-sm font-extrabold text-[var(--brand-primary)] transition hover:bg-green-50"
                  >
                    <PhoneFilled />
                    GỌI NGAY
                  </a>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 text-base font-bold text-gray-500">
                  <span>{active.emailLabel}</span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-[var(--brand-primary)]">
                    <MailFilled className="text-sm" />
                  </span>
                  <a href={`mailto:${active.email}`} className="font-extrabold text-[var(--brand-primary)] hover:underline">
                    {active.email}
                  </a>
                </div>
              </div>

              <div className="hidden md:flex justify-end items-center">
                <ChatShowcase dark={false} {...active.chatData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
