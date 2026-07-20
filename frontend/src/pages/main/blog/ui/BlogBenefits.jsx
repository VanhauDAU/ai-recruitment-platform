import { ArrowRightOutlined, CloseOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/site-settings'
import { legacyAsset } from '@/shared/config/assets'

const BENEFITS = [
  {
    title: '60.000+ Việc làm chất lượng',
    action: 'Tìm việc ngay',
    to: '/viec-lam',
    image: legacyAsset('blog/search-tool-v2.png'),
  },
  {
    title: 'Công cụ tạo CV chuyên nghiệp',
    action: 'Tạo CV',
    to: '/',
    image: legacyAsset('blog/cv-tool-v2.png'),
  },
  {
    title: 'Trắc nghiệm tính cách, nghề nghiệp',
    action: 'Khám phá ngay',
    to: '/blog',
    image: legacyAsset('blog/survey-tool-v2.png'),
  },
]

// Section đầu trang chi tiết bài viết: ba lợi ích và CTA có cùng nhịp thị giác.
export default function BlogBenefits() {
  const { settings } = useSiteSettings()
  const siteName = settingText(settings.site_name, DEFAULT_SITE_SETTINGS.site_name || 'ProCV')
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <section className="relative w-full border-y border-emerald-400/20 bg-[#005c49] py-6 text-white sm:py-10">
      <button
        type="button"
        aria-label="Ẩn khối lợi ích"
        title="Ẩn khối lợi ích"
        onClick={() => setVisible(false)}
        className="absolute right-2 top-2 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/10 text-sm text-emerald-200 transition hover:bg-black/20 hover:text-white sm:right-6 sm:top-5 sm:h-9 sm:w-9"
      >
        <CloseOutlined />
      </button>

      <div className="mx-auto max-w-4xl px-3 sm:px-4">
        <h2 className="px-8 text-center text-lg font-extrabold leading-6 text-white sm:text-2xl sm:leading-8">
          Lợi ích khi sử dụng {siteName}
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
          {BENEFITS.map((item) => (
            <div
              key={item.title}
              className="group relative flex min-h-48 overflow-hidden rounded-xl border border-emerald-300/50 bg-[#004f40] text-center transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200/80 hover:shadow-lg hover:shadow-black/10 sm:min-h-56 sm:rounded-2xl"
              style={{
                backgroundImage: `url(${item.image})`,
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#003e33] via-[#005c49]/65 to-[#005c49]/10 transition-colors duration-300 group-hover:via-[#005c49]/50" />
              <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-end px-3 pb-4 pt-20 sm:px-4 sm:pb-5 sm:pt-24">
                <h3 className="text-sm font-bold leading-5 text-white">{item.title}</h3>
                <Link
                  to={item.to}
                  className="mt-3 inline-flex min-w-36 items-center justify-center gap-2 rounded-full border border-transparent px-4 py-2 text-xs font-extrabold !text-[#57d991] transition-all duration-200 hover:gap-3 hover:border-[#57d991] hover:brightness-110 hover:!text-[#57d991] sm:mt-4 sm:min-w-40 sm:px-5 sm:py-2.5 sm:text-sm"
                  style={{
                    backgroundColor: '#0b5342',
                    boxShadow: '0 7px 18px rgba(0,0,0,0.22)',
                    color: '#57d991',
                  }}
                >
                  {item.action}
                  <ArrowRightOutlined className="text-[10px]" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
