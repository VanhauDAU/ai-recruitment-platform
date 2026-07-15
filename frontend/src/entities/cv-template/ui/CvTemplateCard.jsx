import { CrownFilled } from '@ant-design/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { templateColors, templatePreviewForColor } from '../model/template-colors'
import CvTemplatePreview from './CvTemplatePreview'
import TemplateColorSwatches from './TemplateColorSwatches'

export default function CvTemplateCard({ template, onUse, detailBasePath = '/mau-cv' }) {
  // Chi tiết mẫu CV dùng segment /chi-tiet/ để phân biệt với URL danh mục
  const detailPath = `${detailBasePath}/chi-tiet/${template.slug}`
  const colors = templateColors(template)
  const [selectedColor, setSelectedColor] = useState(colors[0])
  const [hovered, setHovered] = useState(false)

  const openWith = (color) => {
    setSelectedColor(color)
    onUse?.(template, color.hex_code)
  }

  // Chuyển hex sang rgba với alpha nhạt hơn để làm background hover
  const getHoverBgColor = (hex) => {
    if (!hex || !hex.startsWith('#')) return '#ebf0f5'
    const cleanHex = hex.replace('#', '')
    const num = parseInt(cleanHex, 16)
    let r, g, b
    if (cleanHex.length === 3) {
      r = (num >> 8) & 0xf
      r = (r << 4) | r
      g = (num >> 4) & 0xf
      g = (g << 4) | g
      b = num & 0xf
      b = (b << 4) | b
    } else {
      r = (num >> 16) & 0xff
      g = (num >> 8) & 0xff
      b = num & 0xff
    }
    return `rgba(${r}, ${g}, ${b}, 0.08)`
  }

  return (
    <article 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex flex-col rounded-2xl border bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
      style={{
        borderColor: hovered ? selectedColor.hex_code : '#f1f5f9',
        backgroundColor: hovered ? getHoverBgColor(selectedColor.hex_code) : '#ffffff',
      }}
    >
      {/* Container của preview (đã bỏ bg và padding để chỉ dùng khung ngoài) */}
      <div className="relative overflow-hidden rounded-xl">
        <Link 
          to={detailPath} 
          className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow duration-300 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]" 
          aria-label={`Xem trước ${template.display_name}`}
        >
          <CvTemplatePreview
            template={{ ...template, theme_color: selectedColor.hex_code }}
            imageUrl={templatePreviewForColor(template, selectedColor)}
            compact
          />
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
      <div className="mt-3.5 px-1">
        <TemplateColorSwatches
          colors={colors}
          selectedKey={selectedColor.slug}
          onSelect={setSelectedColor}
          onActivate={openWith}
          sizeClass="h-3.5 w-3.5"
        />
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
