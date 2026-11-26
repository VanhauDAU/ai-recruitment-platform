import { EnvironmentOutlined, FireOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatNumber, getJobCategories, getJobs } from '@/entities/job/job'
import { getBanners, HOME_HERO_PLACEMENT } from '@/entities/content/banner'
import { useSiteSettings } from '@/entities/system/site-settings'
import BannerCarousel from '@/shared/ui/BannerCarousel'
import BestJobs from './ui/BestJobs'
import CategoryMenu from './ui/CategoryMenu'
import CvTemplateShowcase from './ui/CvTemplateShowcase'
import { BEST_JOBS_PAGE_SIZE } from './lib/best-jobs-config'
import FeaturedIndustriesEmployers from './ui/FeaturedIndustriesEmployers'
import FlashBadge from './ui/FlashBadge'
import HotlineConsultation from './ui/HotlineConsultation'
import HomeHeroMascot from './ui/HomeHeroMascot'
import HeroTypingTitle from './ui/HeroTypingTitle'
import { LocationFilter } from '@/entities/system/location'
import MarketStats from './ui/MarketStats'
import { SearchDropdown, saveHistory } from '@/features/main/job/search-jobs'
import { HeroSlide } from '@/widgets/common/hero-banner'
import { CandidateJobRecommendations, useHomeRecommendationSummary } from '@/widgets/main/candidate-job-recommendations'
import { m } from '@/shared/config/i18n'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import './home-mascot.css'

const SUGGESTED_JOBS = [
  'Lập trình viên React',
  'Kế toán tổng hợp',
  'Nhân viên kinh doanh',
  'Marketing Executive',
  'Chăm sóc khách hàng',
  'Data Analyst',
]

function StatsSlide({ jobCount, categoryCount }) {
  return (
    <div className="h-full flex flex-col justify-center rounded-md bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] text-white px-5 py-4 sm:px-12 sm:py-6">
      <h3 className="text-lg sm:text-2xl font-bold">Tiếp lợi thế, nối thành công</h3>
      <p className="mt-2 text-sm sm:text-base home-hero-muted max-w-md line-clamp-2">
        Hệ sinh thái nhân sự ứng dụng AI: tạo CV chuyên nghiệp, phân tích CV, so khớp việc làm và luyện phỏng vấn thông minh.
      </p>
      <div className="mt-3 sm:mt-5 flex gap-8">
        <div>
          <p className="text-xl sm:text-2xl font-bold">{formatNumber(jobCount)}</p>
          <p className="text-sm home-hero-muted">Việc làm đang tuyển</p>
        </div>
        <div>
          <p className="text-xl sm:text-2xl font-bold">{categoryCount}</p>
          <p className="text-sm home-hero-muted">Danh mục ngành nghề</p>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const { settings, siteName } = useSiteSettings()
  // Công tắc khối trang chủ (SiteSetting home_*); thiếu khoá thì hiện như mặc định.
  const show = (key) => settings[key] !== false
  const featuredJobsCount = Number.isInteger(settings.home_featured_jobs_count)
    ? settings.home_featured_jobs_count
    : BEST_JOBS_PAGE_SIZE
  const navigate = useNavigate()
  // Linh vật chỉ hiện từ desktop (home-mascot.css); không dựng ở màn nhỏ để khỏi tải ảnh.
  const showMascot = useMediaQuery('(min-width: 1024px)')
  const compactSearch = useMediaQuery('(max-width: 767px)')
  const [keyword, setKeyword] = useState('')
  const [searchBy, setSearchBy] = useState('title')
  const [locationIds, setLocationIds] = useState([])
  const [categories, setCategories] = useState([])
  const [jobCount, setJobCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [banners, setBanners] = useState([])
  const searchBoxRef = useRef(null)
  const recommendationSummary = useHomeRecommendationSummary()

  useEffect(() => {
    getJobCategories().then(setCategories).catch(() => {})
    getJobs()
      .then((data) => setJobCount(data.count ?? (data.results || data).length))
      .catch(() => {})
    getBanners(HOME_HERO_PLACEMENT).then(setBanners).catch(() => {})
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

  const searchLabel = 'Tìm kiếm'
  const searchPlaceholder =
    searchBy === 'company' ? 'Tên công ty' : searchBy === 'both' ? 'Vị trí tuyển dụng, tên công ty' : 'Vị trí tuyển dụng'

  // Banner admin cấu hình chạy xoay vòng; chỉ khi không có banner nào đang chạy
  // mới hiện slide số liệu dự phòng.
  const bannerSlides = banners.length
    ? banners.map((banner, index) => (
        <HeroSlide key={banner.id} banner={banner} personal={recommendationSummary} eager={index === 0} />
      ))
    : [<StatsSlide key="stats" jobCount={jobCount} categoryCount={categories.length} />]

  return (
    <div className="pb-10">
      <section id="section-header" className="text-white">
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          <div className="absolute left-1/2 top-0 h-64 w-[760px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.32)_1px,transparent_0)] bg-[length:30px_30px]" />
          <div className="absolute bottom-[-120px] right-[18%] h-72 w-72 rounded-full home-hero-glow blur-3xl" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-12 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-1.5 text-sm font-semibold home-hero-muted shadow-sm backdrop-blur">
            <FireOutlined className="text-amber-200" />
            {formatNumber(jobCount)} việc làm đang tuyển hôm nay
          </div>

          <HeroTypingTitle siteName={siteName} />
          <Typography.Paragraph className="home-hero-muted !text-base md:!text-lg !mb-0">
            Tiếp lợi thế, nối thành công cùng nền tảng nhân sự ứng dụng AI.
          </Typography.Paragraph>

          <div className="home-search-stage max-w-6xl mx-auto">
            {showMascot && <HomeHeroMascot />}
            <div
              ref={searchBoxRef}
              className="relative z-40 rounded-2xl border border-white/20 bg-white/95 p-2.5 shadow-2xl shadow-slate-900/15 backdrop-blur"
            >
              {/* Điện thoại: từ khoá một hàng, địa điểm + nút kính lúp chung hàng dưới (home-mascot.css). */}
              <div className="home-search-row">
                <Input
                  size="large"
                  variant="borderless"
                  placeholder={searchPlaceholder}
                  prefix={<SearchOutlined className="text-[var(--brand-primary)]" />}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  onPressEnter={handleSearch}
                  className="home-search-keyword !rounded-xl !bg-gray-50 !px-3 !text-base"
                />
                <div className="hidden md:block w-px bg-gray-200 my-2" />
                <div className="home-search-location [&>button]:!rounded-xl [&>button]:!border-gray-200 max-md:[&>button]:!border-gray-300">
                  <LocationFilter value={locationIds} onChange={handleLocationApply} size="large" />
                </div>
                <Button
                  type="primary"
                  size="large"
                  aria-label={searchLabel}
                  icon={compactSearch ? <SearchOutlined /> : null}
                  onClick={handleSearch}
                  className="home-search-submit !rounded-xl !font-bold !bg-[var(--brand-primary)] hover:!bg-[var(--brand-primary-hover)] !shadow-lg"
                >
                  {compactSearch ? null : searchLabel}
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

          {/* Một hàng: vừa thì canh giữa, chật thì vuốt ngang (không xuống dòng). */}
          <div className="mt-4 max-w-6xl mx-auto overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mx-auto flex w-max items-center gap-1.5 text-left">
              <span className="shrink-0 px-1 text-sm font-semibold home-hero-muted">Gợi ý:</span>
              {show('nearby_jobs_enabled') && (
                <Link
                  to="/viec-lam-gan-ban"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 !bg-amber-300 px-3 py-1.5 text-[13px] font-bold !text-emerald-950 shadow-sm transition hover:-translate-y-0.5 hover:!bg-amber-200 hover:shadow-md"
                >
                  <EnvironmentOutlined aria-hidden />
                  {m.candidate_nearby_hero_link()}
                </Link>
              )}
              {SUGGESTED_JOBS.map((job) => (
                <button
                  key={job}
                  type="button"
                  onClick={() => handleSuggestedJob(job)}
                  className="shrink-0 cursor-pointer rounded-full border border-white/70 bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--brand-primary-hover)] shadow-sm transition hover:-translate-y-0.5 hover:border-white hover:bg-green-50 hover:shadow-md"
                >
                  {job}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {(show('home_show_categories') || show('home_show_banner')) && (
        <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-20">
          <CategoryMenu
            categories={show('home_show_categories') ? categories : []}
            banner={show('home_show_banner') ? <BannerCarousel slides={bannerSlides} /> : null}
          />
        </section>
      )}

      {show('home_show_featured_jobs') && (
        <section className="max-w-6xl mx-auto px-4 pt-8">
          <BestJobs categories={categories} pageSize={featuredJobsCount} />
        </section>
      )}

      <CandidateJobRecommendations variant="home" />

      {show('home_show_stats') && (
        <section className="pt-8">
          <div className="bg-white py-8">
            <div className="max-w-6xl mx-auto px-4">
              <MarketStats />
            </div>
          </div>
        </section>
      )}

      {show('flash_badge_enabled') && (
        <section className="pt-8">
          <FlashBadge
            responseRate={settings.flash_badge_min_response_rate}
            responseHours={settings.flash_badge_response_hours}
          />
        </section>
      )}

      {show('home_show_cv_templates') && <CvTemplateShowcase />}
      <FeaturedIndustriesEmployers />
      <HotlineConsultation />
    </div>
  )
}
