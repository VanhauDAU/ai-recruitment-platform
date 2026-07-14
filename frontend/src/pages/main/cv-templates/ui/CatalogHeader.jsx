import { RightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

const HERO_IMAGE = 'https://www.topcv.vn/v4/image/cv-template/cv-sample/toppy-list-mau-cv.png'

export default function CatalogHeader({ breadcrumbLabel, title, subtitle }) {
  return (
    <header className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
      {/* Cột trái: breadcrumb + tiêu đề + caption */}
      <div className="flex-1">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-slate-500"
        >
          <Link to="/" className="transition hover:text-[var(--brand-primary)]">
            Trang chủ
          </Link>
          <RightOutlined className="text-[10px] text-slate-400" />
          <span className="font-medium text-slate-700">{breadcrumbLabel}</span>
        </nav>

        <h1 className="mt-4 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl md:text-[2rem]">
          {title}
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
          {subtitle}
        </p>
      </div>

      {/* Cột phải: ảnh minh hoạ */}
      <div className="hidden shrink-0 lg:block">
        <img
          src={HERO_IMAGE}
          alt="Toppy hướng dẫn chọn mẫu CV"
          className="h-44 w-auto object-contain drop-shadow-lg"
          loading="lazy"
        />
      </div>
    </header>
  )
}
