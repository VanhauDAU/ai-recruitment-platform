import { FireOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobCategories, getJobs } from '../api/jobService'
import { formatNumber } from '../constants/jobOptions'
import BannerCarousel from '../components/ui/BannerCarousel'
import BestJobs from '../components/home/BestJobs'
import CategoryMenu from '../components/home/CategoryMenu'
import FlashBadge from '../components/home/FlashBadge'
import LocationFilter from '../components/job/LocationFilter'
import MarketStats from '../components/home/MarketStats'
import SearchDropdown, { saveHistory } from '../components/ui/SearchDropdown'

const SUGGESTED_JOBS = [
  'Lập trình viên React',
  'Kế toán tổng hợp',
  'Nhân viên kinh doanh',
  'Marketing Executive',
  'Chăm sóc khách hàng',
  'Data Analyst',
]

export default function Home() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [searchBy, setSearchBy] = useState('title')
  const [locationIds, setLocationIds] = useState([])
  const [categories, setCategories] = useState([])
  const [jobCount, setJobCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchBoxRef = useRef(null)

  useEffect(() => {
    getJobCategories().then(setCategories).catch(() => {})
    getJobs()
      .then((data) => setJobCount(data.count ?? (data.results || data).length))
      .catch(() => {})
  }, [])

  function searchWith(extraLocationIds, nextKeyword = keyword, by = searchBy) {
    const params = new URLSearchParams()
    const kw = nextKeyword.trim()
    if (kw) {
      params.set('search', kw)
      if (by !== 'title') params.set('search_by', by)
    }
    ;(extraLocationIds ?? locationIds).forEach((id) => params.append('location', id))
    navigate(`/jobs?${params.toString()}`)
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
    <div key="it" className="h-full flex flex-col justify-center rounded-md bg-gradient-to-br from-blue-600 to-blue-800 text-white px-12 py-6">
      <p className="text-sm font-semibold text-blue-100 mb-1">TUYỂN DỤNG GẤP</p>
      <h3 className="text-2xl font-bold">Lập trình viên &amp; Kỹ sư AI</h3>
      <p className="mt-2 text-blue-50 max-w-md">Mức lương hấp dẫn, môi trường năng động, cơ hội thăng tiến nhanh.</p>
      <button
        onClick={() => navigate('/jobs?search=IT')}
        className="mt-4 self-start bg-white text-blue-700 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-blue-50 transition"
      >
        Xem việc làm IT
      </button>
    </div>,
    <div key="cv" className="h-full flex flex-col justify-center rounded-md bg-gradient-to-br from-orange-500 to-pink-600 text-white px-12 py-6">
      <p className="text-sm font-semibold text-orange-100 mb-1">MIỄN PHÍ</p>
      <h3 className="text-2xl font-bold">Tạo CV chuyên nghiệp cùng AI</h3>
      <p className="mt-2 text-orange-50 max-w-md">Chỉ mất 5 phút để có CV ấn tượng, sẵn sàng ứng tuyển.</p>
    </div>,
  ]

  return (
    <div className="pb-10">
      <section className="relative bg-[#00a94d] text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(0,122,55,0.96)_0%,rgba(0,177,79,0.94)_50%,rgba(20,145,111,0.92)_100%)]" />
          <div className="absolute inset-0 opacity-35 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.28)_1px,transparent_0)] bg-[length:28px_28px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-1.5 text-sm font-semibold text-green-50 shadow-sm backdrop-blur">
            <FireOutlined className="text-amber-200" />
            {formatNumber(jobCount)} việc làm đang tuyển hôm nay
          </div>

          <Typography.Title level={1} className="!text-white !mb-3 !mt-5 !text-3xl md:!text-4xl !font-extrabold">
            AI Career Coach — Tạo CV, Tìm việc làm, Tuyển dụng hiệu quả
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
                  className="!h-12 !rounded-xl !px-8 !font-bold !bg-[#00b14f] hover:!bg-[#009944] !shadow-lg !shadow-emerald-600/25"
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
    </div>
  )
}
