import { RightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { legacyAsset } from '@/shared/config/assets'

const HERO_IMAGE = legacyAsset('cv-template/toppy-list-mau-cv.png')

export default function CatalogHeader({ activeCategory, localeLabel, year, subtitle }) {
  // Xác định xem danh mục có thuộc nhóm style hay ngành nghề
  const isPosition = activeCategory?.category_type === 'position' || activeCategory?.slug?.includes('it') || activeCategory?.slug?.includes('marketing')
  const groupLabel = isPosition ? 'Mẫu CV theo ngành nghề' : 'Mẫu CV theo style'
  
  // Tên danh mục đang kích hoạt
  const catName = activeCategory?.name || ''
  
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      {/* Cột trái: breadcrumb + tiêu đề + caption */}
      <div className="flex-1">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500 font-medium"
        >
          <Link to="/" className="transition hover:text-[var(--brand-primary)]">
            Trang chủ
          </Link>
          <RightOutlined className="text-[9px] text-slate-400" />
          
          {activeCategory ? (
            <>
              <span className="transition hover:text-[var(--brand-primary)] cursor-pointer">{groupLabel}</span>
              <RightOutlined className="text-[9px] text-slate-400" />
              <span className="text-slate-800 font-semibold">
                Mẫu CV xin việc {localeLabel} {catName} chuẩn {year}
              </span>
            </>
          ) : (
            <span className="text-slate-800 font-semibold">Mẫu CV {localeLabel}</span>
          )}
        </nav>

        <h1 className="mt-4 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl md:text-[32px] tracking-tight">
          Mẫu CV xin việc {localeLabel}{' '}
          {activeCategory && (
            <span className="text-[var(--brand-primary)] font-extrabold">
              {catName}
            </span>
          )}{' '}
          chuẩn {year}
        </h1>

        <p className="mt-2.5 max-w-2xl text-[14px] leading-6 text-slate-500">
          {subtitle}
        </p>
      </div>

      {/* Cột phải: ảnh mascot */}
      <div className="hidden shrink-0 lg:block">
        <img
          src={HERO_IMAGE}
          alt="Toppy hướng dẫn chọn mẫu CV"
          className="h-28 w-auto object-contain drop-shadow-md"
          loading="lazy"
        />
      </div>
    </header>
  )
}
