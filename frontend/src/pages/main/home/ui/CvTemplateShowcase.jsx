import { ArrowRightOutlined, BgColorsOutlined, EditOutlined, FilePdfOutlined, RobotOutlined, StarFilled } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { getCvTemplates } from '@/entities/cv/cv-template'
import CvFlipBook from './CvFlipBook'
import './cv-showcase.css'

const FEATURES = [
  { icon: <BgColorsOutlined />, label: 'Mẫu thiết kế đa dạng', detail: 'Đổi màu tự do theo cá tính' },
  { icon: <EditOutlined />, label: 'Chỉnh sửa trực tuyến', detail: 'Tự động lưu mọi thay đổi' },
  { icon: <RobotOutlined />, label: 'Nhập CV bằng AI', detail: 'Tải PDF/DOCX, AI tự điền nội dung' },
  { icon: <FilePdfOutlined />, label: 'Xuất PDF chuẩn', detail: 'Sẵn sàng ứng tuyển ngay' },
]

// Mỗi mẫu là một trang của cuốn sách (CvFlipBook); đủ để lật mà không tải quá nhiều ảnh.
const SHOWCASE_LIMIT = 10

// Section "Tạo CV ấn tượng": showcase mẫu CV thật từ catalogue để kéo ứng viên vào CV Builder.
export default function CvTemplateShowcase() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['cv-templates', 'home-showcase'],
    queryFn: () => getCvTemplates(),
    staleTime: 5 * 60_000,
  })

  const templates = (data?.results || []).slice(0, SHOWCASE_LIMIT)

  if (!isLoading && templates.length === 0) return null

  return (
    <section className="cv-showcase relative overflow-hidden bg-gradient-to-b from-white via-[var(--brand-primary)]/70 to-white py-14">
      <div className="pointer-events-none absolute inset-0">
        <div className="home-parallax absolute -left-24 top-10 h-72 w-72 rounded-full bg-[var(--brand-primary)]/10 blur-3xl" />
        <div className="home-parallax home-parallax--reverse absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.35] bg-[radial-gradient(circle_at_1px_1px,rgba(4,107,50,0.10)_1px,transparent_0)] bg-[length:26px_26px]" />
      </div>

      <div className="cv-showcase__grid relative mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-[1fr_1.15fr]">
        {/* ── Cột trái: thông điệp + CTA (dưới lg tách ra để dãy thẻ chen giữa) ── */}
        <div className="cv-showcase__copy">
          <div className="cv-showcase__intro">
            <span className="cv-showcase__badge inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/20 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-hover)] shadow-sm">
              <StarFilled className="text-amber-400" /> CV Builder
            </span>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-4xl">
              Tạo CV ấn tượng,{' '}
              <span className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] bg-clip-text text-transparent">chinh phục nhà tuyển dụng</span>
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
              Chọn mẫu, đổi màu, điền nội dung — một chiếc CV chuyên nghiệp chỉ mất vài phút. Hoàn toàn miễn phí.
            </p>
          </div>

          <div data-reveal-stagger className="cv-showcase__features mt-6 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.label} className="cv-showcase__feature flex items-start gap-3 rounded-xl border border-slate-100 bg-white/85 p-3 shadow-sm backdrop-blur transition-shadow hover:shadow-md">
                <span className="cv-showcase__feature-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10 text-base text-[var(--brand-primary)]">{feature.icon}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{feature.label}</p>
                  <p className="cv-showcase__feature-detail mt-0.5 text-xs leading-snug text-slate-500">{feature.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="cv-showcase__cta mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/mau-cv')}
              className="cv-showcase__cta-button inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--brand-primary)]/25 transition-all hover:-translate-y-0.5 hover:bg-[var(--brand-primary-hover)] hover:shadow-xl active:scale-95"
            >
              Tạo CV ngay <ArrowRightOutlined className="text-xs" />
            </button>
          </div>
        </div>

        {/* ── Cột phải: cuốn sách mẫu CV đang lật; dưới lg nằm giữa tiêu đề và tính năng ── */}
        <div className="cv-showcase__stage">
          <CvFlipBook templates={templates} loading={isLoading} />
        </div>
      </div>
    </section>
  )
}
