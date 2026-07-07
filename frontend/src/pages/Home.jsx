import { SearchOutlined } from '@ant-design/icons'
import { Button, Input, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobCategories, getJobs } from '../api/jobService'
import BannerCarousel from '../components/BannerCarousel'
import CategoryMenu from '../components/CategoryMenu'
import JobCard from '../components/JobCard'
import JobCardSkeleton from '../components/JobCardSkeleton'
import LocationFilter from '../components/LocationFilter'
import MarketStats from '../components/MarketStats'

export default function Home() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [locationIds, setLocationIds] = useState([])
  const [categories, setCategories] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobCount, setJobCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJobCategories().then(setCategories).catch(() => {})
    getJobs()
      .then((data) => {
        setJobs((data.results || data).slice(0, 8))
        setJobCount(data.count ?? (data.results || data).length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function searchWith(extraLocationIds) {
    const params = new URLSearchParams()
    if (keyword) params.set('search', keyword)
    ;(extraLocationIds ?? locationIds).forEach((id) => params.append('location', id))
    navigate(`/jobs?${params.toString()}`)
  }

  function handleSearch() {
    searchWith()
  }

  function handleLocationApply(ids) {
    setLocationIds(ids)
    searchWith(ids)
  }

  const bannerSlides = [
    <div key="stats" className="h-full flex flex-col justify-center rounded-md bg-gradient-to-br from-[#00b14f] to-[#008a3e] text-white px-12 py-6">
      <h3 className="text-2xl font-bold">Tiếp lợi thế, nối thành công</h3>
      <p className="mt-2 text-green-50 max-w-md">
        Hệ sinh thái nhân sự ứng dụng AI: tạo CV chuyên nghiệp, phân tích CV, so khớp việc làm và luyện phỏng vấn thông minh.
      </p>
      <div className="mt-5 flex gap-8">
        <div>
          <p className="text-2xl font-bold">{jobCount.toLocaleString('vi-VN')}</p>
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
      <section className="bg-gradient-to-b from-[#00b14f] to-[#03a049] text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <Typography.Title level={2} className="!text-white !mb-2">
            AI Career Coach — Tạo CV, Tìm việc làm, Tuyển dụng hiệu quả
          </Typography.Title>
          <Typography.Paragraph className="!text-green-50">
            Tiếp lợi thế, nối thành công cùng nền tảng nhân sự ứng dụng AI.
          </Typography.Paragraph>
          <div className="mt-4 bg-white rounded-xl p-2 flex flex-col sm:flex-row gap-2 max-w-4xl mx-auto shadow-lg">
            <Input
              size="large"
              variant="borderless"
              placeholder="Vị trí tuyển dụng, tên công ty"
              prefix={<SearchOutlined className="text-gray-400" />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              className="flex-1"
            />
            <div className="hidden sm:block w-px bg-gray-200 my-1" />
            <div className="sm:w-72 flex items-center">
              <LocationFilter value={locationIds} onChange={handleLocationApply} size="large" />
            </div>
            <Button type="primary" size="large" onClick={handleSearch}>
              Tìm kiếm
            </Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 -mt-6 relative z-20">
        <CategoryMenu categories={categories} banner={<BannerCarousel slides={bannerSlides} />} />
      </section>

      <section className="max-w-6xl mx-auto px-4 pt-8">
        <MarketStats />
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <Typography.Title level={4} className="!mb-0">Việc làm mới nhất</Typography.Title>
          <Button type="link" onClick={() => navigate('/jobs')}>Xem tất cả</Button>
        </div>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-gray-500">Chưa có tin tuyển dụng nào.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => <JobCard key={job.public_id} job={job} />)}
          </div>
        )}
      </section>
    </div>
  )
}
