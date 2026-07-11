import { useEffect, useState } from 'react'
import { getBanners } from '../../../../../api/siteService'

const THEME_CLASS = {
  green: 'from-emerald-700 to-emerald-500',
  blue: 'from-sky-700 to-blue-500',
  orange: 'from-orange-600 to-rose-500',
}

// Banner placement riêng để admin chủ động thêm/xóa/sắp xếp ảnh kèm URL cho sidebar.
export default function JobSidebarPromos() {
  const [banners, setBanners] = useState([])

  useEffect(() => {
    let cancelled = false
    getBanners('job_detail_sidebar')
      .then((items) => { if (!cancelled) setBanners(items.slice(0, 3)) })
      .catch(() => { if (!cancelled) setBanners([]) })
    return () => { cancelled = true }
  }, [])

  if (!banners.length) return null
  return (
    <div className="space-y-4">
      {banners.map((banner) => {
        const content = (
          <article className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${THEME_CLASS[banner.theme] || THEME_CLASS.green} p-4 text-white shadow-sm`}>
            {banner.image_url && <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="lazy" />}
            <div className="relative">
              {banner.eyebrow && <p className="text-[10px] font-bold tracking-[0.14em] text-white/80">{banner.eyebrow}</p>}
              <h2 className="mt-1 text-base font-bold leading-5">{banner.title}</h2>
              {banner.subtitle && <p className="mt-2 text-xs leading-5 text-white/85">{banner.subtitle}</p>}
              {banner.cta_label && <span className="mt-3 inline-flex text-xs font-bold underline underline-offset-2">{banner.cta_label} →</span>}
            </div>
          </article>
        )
        return banner.cta_url ? (
          <a key={banner.id} href={banner.cta_url} target={banner.cta_url.startsWith('http') ? '_blank' : undefined} rel={banner.cta_url.startsWith('http') ? 'noopener noreferrer' : undefined} className="block transition hover:-translate-y-0.5 hover:shadow-md">
            {content}
          </a>
        ) : <div key={banner.id}>{content}</div>
      })}
    </div>
  )
}
