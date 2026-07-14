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
  const [hoverColor, setHoverColor] = useState(null)
  const previewColor = hoverColor || selectedColor

  const openWith = (color) => {
    setSelectedColor(color)
    onUse?.(template, color)
  }

  return (
    <article className="group flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-[var(--brand-primary)] hover:shadow-lg">
      <div className="relative overflow-hidden rounded-lg border border-slate-100">
        <Link to={detailPath} className="block" aria-label={`Xem trước ${template.display_name}`}>
          <CvTemplatePreview template={{ ...template, theme_color: previewColor }} compact />
        </Link>
        {template.is_premium && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            <CrownFilled className="text-[10px]" /> Premium
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/30 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => openWith(previewColor)}
            className="pointer-events-auto w-[80%] cursor-pointer rounded-md bg-[var(--brand-primary)] py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--brand-primary-hover)]"
          >
            Dùng mẫu
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5" role="radiogroup" aria-label="Chọn màu mẫu CV">
        {variants.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selectedColor === color}
            title={color}
            onMouseEnter={() => setHoverColor(color)}
            onMouseLeave={() => setHoverColor(null)}
            onFocus={() => setHoverColor(color)}
            onBlur={() => setHoverColor(null)}
            onClick={() => openWith(color)}
            className={[
              'h-4 w-4 cursor-pointer rounded-full ring-offset-1 transition',
              selectedColor === color
                ? 'ring-2 ring-slate-900'
                : 'ring-1 ring-black/10 hover:ring-2 hover:ring-slate-400',
            ].join(' ')}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <Link to={detailPath} className="mt-2 line-clamp-1 text-lg font-bold !text-slate-900 leading-snug">
        {template.display_name}
      </Link>

      {/* Danh mục của template (từ API, mỗi template có thể thuộc nhiều danh mục) */}
      {template.categories?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {template.categories.slice(0, 3).map((cat) => (
            <span
              key={cat.public_id || cat.slug}
              className="inline-flex items-center rounded-full bg-[var(--brand-primary-soft,#e6f7f1)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--brand-primary)]"
            >
              {cat.name}
            </span>
          ))}
        </div>
      )}
      {!template.categories?.length && template.tags?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.public_id}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
