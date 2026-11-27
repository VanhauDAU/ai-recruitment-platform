import { ArrowRightOutlined, BgColorsOutlined, CrownFilled, EditOutlined, FilePdfOutlined, RobotOutlined, StarFilled } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CvTemplatePreview, getCvTemplates, TemplateColorSwatches, templateColors, templatePreviewForColor } from '@/entities/cv/cv-template'
import { m } from '@/shared/config/i18n'
import { showcaseSlot, useShowcaseRotation } from '../model/use-showcase-rotation'
import './cv-showcase.css'

const FEATURES = [
  { icon: <BgColorsOutlined />, label: 'Mẫu thiết kế đa dạng', detail: 'Đổi màu tự do theo cá tính' },
  { icon: <EditOutlined />, label: 'Chỉnh sửa trực tuyến', detail: 'Tự động lưu mọi thay đổi' },
  { icon: <RobotOutlined />, label: 'Nhập CV bằng AI', detail: 'Tải PDF/DOCX, AI tự điền nội dung' },
  { icon: <FilePdfOutlined />, label: 'Xuất PDF chuẩn', detail: 'Sẵn sàng ứng tuyển ngay' },
]

// Đủ cho băng chuyền 5 vị trí desktop xoay vòng mà không quá nhiều ảnh xem trước phải tải.
const SHOWCASE_LIMIT = 10

// Desktop: băng chuyền 3D, thẻ đổi vị trí trái/giữa/phải (data-slot) theo nhịp. Dưới lg:
// dãy thẻ vuốt kiểu coverflow, tự trượt sang thẻ kế. Hiệu ứng ở cv-showcase.css.
function ShowcaseCard({ template, slot }) {
  const colors = templateColors(template)
  const [color, setColor] = useState(colors[0])
  return (
    // Lớp ngoài là điểm snap + xòe quạt desktop; hiệu ứng vuốt chạy ở lớp trong để
    // trình duyệt không tính điểm snap theo khung đang biến dạng.
    <div data-slot={slot} className="cv-showcase__card group w-[228px] shrink-0 snap-center">
      <div className="cv-showcase__card-body rounded-2xl border border-slate-100 bg-white p-2.5 shadow-[0_10px_30px_rgba(2,44,34,0.10)] transition-shadow duration-300">
        <Link
          to={`/mau-cv/chi-tiet/${template.slug}`}
          aria-label={`Xem mẫu CV ${template.display_name}`}
          className="relative block overflow-hidden rounded-xl"
        >
          <CvTemplatePreview template={{ ...template, theme_color: color.hex_code }} imageUrl={templatePreviewForColor(template, color)} />
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

  const templates = (data?.results || []).slice(0, SHOWCASE_LIMIT)
  const { center, deckRef, goTo, deckProps } = useShowcaseRotation(templates.length)

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

        {/* ── Cột phải: fan 3 mẫu CV thật; dưới lg là dãy vuốt có chấm trang ── */}
        <div className="cv-showcase__stage">
          <div ref={deckRef} {...deckProps} className="cv-showcase__deck flex snap-x snap-mandatory items-center gap-4 overflow-x-auto pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center lg:gap-0 lg:overflow-visible lg:pb-0">
            {templates.length > 0
              ? templates.map((template, index) => (
                  <ShowcaseCard key={template.public_id || template.slug} template={template} slot={showcaseSlot(index, center, templates.length)} />
                ))
              : Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} data-slot={showcaseSlot(index, 1, 3)} className="cv-showcase__card w-[228px] shrink-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                    <div className="aspect-[3/4] animate-pulse rounded-xl bg-slate-100" />
                    <div className="mt-3 h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
          </div>
          {templates.length > 1 && (
            <div className="cv-showcase__dots" role="group" aria-label={m.candidate_cv_showcase_pick()}>
              {templates.map((template, index) => (
                <button
                  key={template.public_id || template.slug}
                  type="button"
                  aria-label={m.candidate_cv_showcase_view({ name: template.display_name })}
                  aria-current={index === center}
                  onClick={() => goTo(index)}
                  className={`cv-showcase__dot${index === center ? ' is-active' : ''}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
