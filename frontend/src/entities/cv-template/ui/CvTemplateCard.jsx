import { CrownFilled } from '@ant-design/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import CvTemplatePreview from './CvTemplatePreview'

const FALLBACK_VARIANTS = ['#1f2937', '#334e68', '#5b2333']

function templateColorVariants(template) {
  const variants = Array.isArray(template.color_variants) && template.color_variants.length
    ? template.color_variants
    : [template.theme_color || '#00A66A', ...FALLBACK_VARIANTS]
  return [...new Set(variants)].slice(0, 6)
}

export default function CvTemplateCard({ template, onUse, detailBasePath = '/mau-cv', sampleContent: _sampleContent }) {
  // Chi tiết mẫu CV dùng segment /chi-tiet/ để phân biệt với URL danh mục
  const detailPath = `${detailBasePath}/chi-tiet/${template.slug}`
  const variants = templateColorVariants(template)
  const [selectedColor, setSelectedColor] = useState(variants[0])

  const openWith = (color) => {
    setSelectedColor(color)
    onUse?.(template, color)
  }

  return (
    <article className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-primary)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      {/* Container của preview có padding và background màu xám nhẹ, tạo hiệu ứng CV nổi bật */}
      <div className="relative overflow-hidden rounded-xl bg-[#f5f7fa] p-4 pb-2 transition-colors duration-300 group-hover:bg-[#ebf0f5]">
        <Link 
          to={detailPath} 
          className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow duration-300 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]" 
          aria-label={`Xem trước ${template.display_name}`}
        >
          <CvTemplatePreview template={{ ...template, theme_color: selectedColor }} compact />
        </Link>

        {template.is_premium && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <CrownFilled className="text-[9px]" /> PREMIUM
          </span>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/30 to-transparent p-4 opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <button
            type="button"
            onClick={() => openWith(selectedColor)}
            className="pointer-events-auto w-[85%] cursor-pointer rounded-lg bg-[var(--brand-primary)] py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--brand-primary-hover)] hover:scale-[1.02]"
          >
            Dùng mẫu
          </button>
        </div>
      </div>

      {/* Danh sách các nút chọn màu */}
      <div className="mt-3.5 flex items-center gap-1.5 px-1" role="radiogroup" aria-label="Chọn màu mẫu CV">
        {variants.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selectedColor === color}
            title={color}
            onMouseEnter={() => setSelectedColor(color)}
            onFocus={() => setSelectedColor(color)}
            onClick={() => openWith(color)}
            className={[
              'h-3.5 w-3.5 cursor-pointer rounded-full transition-all duration-200',
              selectedColor === color
                ? 'ring-2 ring-slate-900 ring-offset-2 scale-110'
                : 'ring-1 ring-black/10 hover:ring-2 hover:ring-slate-400 hover:scale-105',
            ].join(' ')}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Tiêu đề CV */}
      <Link 
        to={detailPath} 
        className="mt-2.5 line-clamp-1 px-1 text-[18px] font-extrabold !text-black transition-colors duration-200 hover:opacity-85"
      >
        {template.display_name}
      </Link>

      {/* Danh mục/Tags dưới tiêu đề */}
      <div className="mt-1.5 flex flex-wrap gap-1 px-1 pb-1">
        {template.categories?.length > 0 ? (
          template.categories.slice(0, 3).map((cat) => (
            <span
              key={cat.public_id || cat.slug}
              className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors duration-200 group-hover:bg-slate-200/70"
            >
              {cat.name}
            </span>
          ))
        ) : (
          template.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag.public_id}
              className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors duration-200 group-hover:bg-slate-200/70"
            >
              {tag.name}
            </span>
          ))
        )}
      </div>
    </article>
  )
}
