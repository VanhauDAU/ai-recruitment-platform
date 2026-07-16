import { ArrowRightOutlined, BgColorsOutlined, CrownFilled, EditOutlined, FilePdfOutlined, RobotOutlined, StarFilled } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CvTemplatePreview, getCvTemplates, TemplateColorSwatches, templateColors, templatePreviewForColor } from '@/entities/cv-template'

const FEATURES = [
  { icon: <BgColorsOutlined />, label: 'Mẫu thiết kế đa dạng', detail: 'Đổi màu tự do theo cá tính' },
  { icon: <EditOutlined />, label: 'Chỉnh sửa trực tuyến', detail: 'Tự động lưu mọi thay đổi' },
  { icon: <RobotOutlined />, label: 'Nhập CV bằng AI', detail: 'Tải PDF/DOCX, AI tự điền nội dung' },
  { icon: <FilePdfOutlined />, label: 'Xuất PDF chuẩn', detail: 'Sẵn sàng ứng tuyển ngay' },
]

// Độ nghiêng/nâng của các card trên desktop tạo hiệu ứng "xòe quạt" theo số lượng; mobile trượt ngang.
const FAN_LAYOUTS = {
  1: ['lg:scale-[1.06]'],
  2: ['lg:rotate-[-6deg] lg:translate-y-3 lg:translate-x-4', 'lg:z-10 lg:rotate-[6deg] lg:-translate-x-4'],
  3: [
    'lg:rotate-[-7deg] lg:translate-y-6 lg:translate-x-5',
    'lg:z-10 lg:scale-[1.08] lg:-translate-y-2',
    'lg:rotate-[7deg] lg:translate-y-6 lg:-translate-x-5',
  ],
}

function ShowcaseCard({ template, fanClass }) {
  const colors = templateColors(template)
  const [color, setColor] = useState(colors[0])
  return (
    <div
      className={`group w-[228px] shrink-0 snap-center rounded-2xl border border-slate-100 bg-white p-2.5 shadow-[0_10px_30px_rgba(2,44,34,0.10)] transition-all duration-300 hover:z-20 hover:-translate-y-3 hover:rotate-0 hover:shadow-[0_22px_44px_rgba(2,44,34,0.18)] ${fanClass}`}
    >
      <Link
        to={`/mau-cv/chi-tiet/${template.slug}`}
        aria-label={`Xem mẫu CV ${template.display_name}`}
        className="relative block overflow-hidden rounded-xl"
      >
        <CvTemplatePreview template={{ ...template, theme_color: color.hex_code }} imageUrl={templatePreviewForColor(template, color)} compact />
        {template.is_premium && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <CrownFilled className="text-[9px]" /> PREMIUM
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/35 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-[var(--brand-primary-hover)] shadow">Xem mẫu này</span>
        </span>
      </Link>
      <div className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-2.5">
        <p className="line-clamp-1 text-sm font-bold text-slate-900">{template.display_name}</p>
        <TemplateColorSwatches colors={colors.slice(0, 4)} selectedKey={color.slug} onSelect={setColor} sizeClass="h-3 w-3" ariaLabel={`Đổi màu mẫu ${template.display_name}`} />
      </div>
    </div>
  )
}

// Section "Tạo CV ấn tượng": showcase mẫu CV thật từ catalogue để kéo ứng viên vào CV Builder.
export default function CvTemplateShowcase() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['cv-templates', 'home-showcase'],
    queryFn: () => getCvTemplates(),
    staleTime: 5 * 60_000,
  })

  const templates = (data?.results || []).slice(0, 3)
  if (!isLoading && templates.length === 0) return null

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/70 to-white py-14">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[var(--brand-primary)]/10 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.35] bg-[radial-gradient(circle_at_1px_1px,rgba(4,107,50,0.10)_1px,transparent_0)] bg-[length:26px_26px]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-[1fr_1.15fr]">
        {/* ── Cột trái: thông điệp + CTA ── */}
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/20 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-hover)] shadow-sm">
            <StarFilled className="text-amber-400" /> CV Builder
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-4xl">
            Tạo CV ấn tượng,{' '}
            <span className="bg-gradient-to-r from-[var(--brand-primary)] to-teal-500 bg-clip-text text-transparent">chinh phục nhà tuyển dụng</span>
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
            Chọn mẫu, đổi màu, điền nội dung — một chiếc CV chuyên nghiệp chỉ mất vài phút. Hoàn toàn miễn phí.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.label} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white/85 p-3 shadow-sm backdrop-blur transition-shadow hover:shadow-md">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10 text-base text-[var(--brand-primary)]">{feature.icon}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{feature.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{feature.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/mau-cv')}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5 hover:bg-[var(--brand-primary-hover)] hover:shadow-xl active:scale-95"
            >
              Tạo CV ngay <ArrowRightOutlined className="text-xs" />
            </button>
          </div>
        </div>

        {/* ── Cột phải: fan 3 mẫu CV thật ── */}
        <div className="flex snap-x snap-mandatory items-center gap-4 overflow-x-auto pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center lg:gap-0 lg:overflow-visible lg:pb-0">
          {templates.length > 0
            ? templates.map((template, index) => (
                <ShowcaseCard key={template.public_id || template.slug} template={template} fanClass={FAN_LAYOUTS[templates.length]?.[index] || ''} />
              ))
            : Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={`w-[228px] shrink-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm ${FAN_LAYOUTS[3][index]}`}>
                  <div className="aspect-[3/4] animate-pulse rounded-xl bg-slate-100" />
                  <div className="mt-3 h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
        </div>
      </div>
    </section>
  )
}
