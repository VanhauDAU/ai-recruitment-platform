import { FireOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobCategories, getJobs } from '../api/jobService'
import { getBanners } from '../api/siteService'
import { formatNumber } from '../constants/jobOptions'
import BannerCarousel from '../components/ui/BannerCarousel'
import BestJobs from '../components/home/BestJobs'
import CategoryMenu from '../components/home/CategoryMenu'
import FeaturedIndustriesEmployers from '../components/home/FeaturedIndustriesEmployers'
import FlashBadge from '../components/home/FlashBadge'
import HotlineConsultation from '../components/home/HotlineConsultation'
import LocationFilter from '../components/job/LocationFilter'
import MarketStats from '../components/home/MarketStats'
import SearchDropdown, { saveHistory } from '../components/ui/SearchDropdown'
import { useSiteSettings } from '../hooks/useSiteSettings'

const SUGGESTED_JOBS = [
  'Lập trình viên React',
  'Kế toán tổng hợp',
  'Nhân viên kinh doanh',
  'Marketing Executive',
  'Chăm sóc khách hàng',
  'Data Analyst',
]

// Khớp với Banner.Theme ở backend — banner nhập qua admin chọn 1 trong 3 tông này.
const BANNER_THEMES = {
  green: { gradient: 'from-[#00b14f] to-[#008a3e]', text: 'text-green-50', eyebrow: 'text-green-100', button: 'text-[#008a3e] hover:bg-green-50' },
  blue: { gradient: 'from-blue-600 to-blue-800', text: 'text-blue-50', eyebrow: 'text-blue-100', button: 'text-blue-700 hover:bg-blue-50' },
  orange: { gradient: 'from-orange-500 to-pink-600', text: 'text-orange-50', eyebrow: 'text-orange-100', button: 'text-orange-700 hover:bg-orange-50' },
}

function normalizePublicUrl(url = '#') {
  if (url === '/jobs') return '/viec-lam'
  if (url.startsWith('/jobs?')) return url.replace('/jobs?', '/viec-lam?')
  if (url.startsWith('/jobs/')) return url.replace('/jobs/', '/viec-lam/')
  if (url === '/register') return '/sign-up'
  return url
}

function PromoBanner({ banner, navigate }) {
  const t = BANNER_THEMES[banner.theme] || BANNER_THEMES.green
  const hasImage = Boolean(banner.image_url)
  const bg = hasImage
    ? { backgroundImage: `url(${banner.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined
  return (
    <div
      className={`relative h-full flex flex-col justify-center overflow-hidden rounded-md text-white px-12 py-6 ${!hasImage ? `bg-gradient-to-br ${t.gradient}` : ''}`}
      style={bg}
    >
      {hasImage && <div className="absolute inset-0 bg-black/45" />}
      <div className="relative">
        {banner.eyebrow && <p className={`text-sm font-semibold mb-1 ${t.eyebrow}`}>{banner.eyebrow}</p>}
        <h3 className="text-2xl font-bold">{banner.title}</h3>
        {banner.subtitle && <p className={`mt-2 max-w-md ${t.text}`}>{banner.subtitle}</p>}
        {banner.cta_label && (
          <button
            onClick={() => navigate(normalizePublicUrl(banner.cta_url || '#'))}
            className={`mt-4 self-start bg-white font-medium px-4 py-2 rounded-lg text-sm cursor-pointer transition ${t.button}`}
          >
            {banner.cta_label}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const { siteName } = useSiteSettings()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [searchBy, setSearchBy] = useState('title')
  const [locationIds, setLocationIds] = useState([])
  const [categories, setCategories] = useState([])
  const [jobCount, setJobCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [banners, setBanners] = useState([])
  const searchBoxRef = useRef(null)

  useEffect(() => {
    getJobCategories().then(setCategories).catch(() => {})
    getJobs()
      .then((data) => setJobCount(data.count ?? (data.results || data).length))
      .catch(() => {})
    getBanners('home_hero').then(setBanners).catch(() => {})
  }, [])

  function searchWith(extraLocationIds, nextKeyword = keyword, by = searchBy) {
    const params = new URLSearchParams()
    const kw = nextKeyword.trim()
    if (kw) {
      params.set('search', kw)
      if (by !== 'title') params.set('search_by', by)
    }
    const nextLocationIds = extraLocationIds ?? locationIds
    if (nextLocationIds.length) params.set('locations', nextLocationIds.join(','))
    navigate(`/viec-lam?${params.toString()}`)
  }

  function handleSearch() {
    saveHistory(keyword, searchBy)
    setDropdownOpen(false)
    searchWith()
  }

  function handleDropdownSelect(kw, by = searchBy) {
    setKeyword(kw)
    setSearchBy(by)
    saveHistory(kw, by)
    setDropdownOpen(false)
    searchWith(locationIds, kw, by)
  }

  function handleLocationApply(ids) {
    setLocationIds(ids)
    searchWith(ids)
  }

  function handleSuggestedJob(job) {
    setKeyword(job)
    searchWith(locationIds, job)
  }

  const searchPlaceholder =
    searchBy === 'company' ? 'Tên công ty' : searchBy === 'both' ? 'Vị trí tuyển dụng, tên công ty' : 'Vị trí tuyển dụng'

  const bannerSlides = [
    <div key="stats" className="h-full flex flex-col justify-center rounded-md bg-gradient-to-br from-[#00b14f] to-[#008a3e] text-white px-12 py-6">
      <h3 className="text-2xl font-bold">Tiếp lợi thế, nối thành công</h3>
      <p className="mt-2 text-green-50 max-w-md">
        Hệ sinh thái nhân sự ứng dụng AI: tạo CV chuyên nghiệp, phân tích CV, so khớp việc làm và luyện phỏng vấn thông minh.
      </p>
      <div className="mt-5 flex gap-8">
        <div>
          <p className="text-2xl font-bold">{formatNumber(jobCount)}</p>
          <p className="text-sm text-green-50">Việc làm đang tuyển</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{categories.length}</p>
          <p className="text-sm text-green-50">Danh mục ngành nghề</p>
        </div>
      </div>
    </div>,
    ...banners.map((banner) => <PromoBanner key={banner.id} banner={banner} navigate={navigate} />),
  ]

  return (
    <div className="pb-10">
      <section id="section-header" className="text-white">
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          <div className="absolute left-1/2 top-0 h-64 w-[760px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.32)_1px,transparent_0)] bg-[length:30px_30px]" />
          <div className="absolute bottom-[-120px] right-[18%] h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-12 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-1.5 text-sm font-semibold text-green-50 shadow-sm backdrop-blur">
            <FireOutlined className="text-amber-200" />
            {formatNumber(jobCount)} việc làm đang tuyển hôm nay
          </div>

          <Typography.Title level={1} className="!text-white !mb-3 !mt-5 !text-3xl md:!text-4xl !font-extrabold">
            {siteName} — Tạo CV, Tìm việc làm, Tuyển dụng hiệu quả
          </Typography.Title>
          <Typography.Paragraph className="!text-green-50 !text-base md:!text-lg !mb-0">
            Tiếp lợi thế, nối thành công cùng nền tảng nhân sự ứng dụng AI.
          </Typography.Paragraph>

          <div className="mt-7 max-w-6xl mx-auto">
            <div
              ref={searchBoxRef}
              className="relative z-40 rounded-2xl border border-white/20 bg-white/95 p-2.5 shadow-2xl shadow-emerald-950/25 backdrop-blur"
            >
              <div className="flex flex-col md:flex-row gap-2.5">
                <Input
                  size="large"
                  variant="borderless"
                  placeholder={searchPlaceholder}
                  prefix={<SearchOutlined className="text-[#00b14f]" />}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  onPressEnter={handleSearch}
                  className="flex-1 !h-12 !rounded-xl !bg-gray-50 !px-3 !text-base"
                />
                <div className="hidden md:block w-px bg-gray-200 my-2" />
                <div className="md:w-80 flex items-center [&>button]:!h-12 [&>button]:!rounded-xl [&>button]:!border-gray-200">
                  <LocationFilter value={locationIds} onChange={handleLocationApply} size="large" />
                </div>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleSearch}
                  className="!h-12 !rounded-xl !px-8 !font-bold !bg-[var(--brand-primary)] hover:!bg-[var(--brand-primary-hover)] !shadow-lg"
                >
                  Tìm kiếm
                </Button>
              </div>

              <SearchDropdown
                open={dropdownOpen}
                onClose={() => setDropdownOpen(false)}
                onSelect={handleDropdownSelect}
                keyword={keyword}
                searchBy={searchBy}
                onSearchByChange={setSearchBy}
                wrapperRef={searchBoxRef}
              />
            </div>
          </div>

          <div className="mt-4 max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 text-left md:flex-wrap md:justify-center md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 px-2 text-sm font-semibold text-green-50">Gợi ý:</span>
            {SUGGESTED_JOBS.map((job) => (
              <button
                key={job}
                type="button"
                onClick={() => handleSuggestedJob(job)}
                className="shrink-0 cursor-pointer rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-[#008a3e] shadow-sm transition hover:-translate-y-0.5 hover:border-white hover:bg-green-50 hover:shadow-md"
              >
                {job}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-20">
        <CategoryMenu categories={categories} banner={<BannerCarousel slides={bannerSlides} />} />
      </section>

      <section className="max-w-6xl mx-auto px-4 pt-8">
        <BestJobs categories={categories} />
      </section>

      <section className="max-w-6xl mx-auto px-4 pt-8">
        <MarketStats />
      </section>

      <section className="pt-8">
        <FlashBadge />
      </section>

      <FeaturedIndustriesEmployers />
      <HotlineConsultation />
    </div>
  )
}
