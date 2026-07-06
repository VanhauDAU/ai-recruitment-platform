import { Empty, Input, Pagination, Select, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getJobCategories, getJobs } from '../../api/jobService'
import JobCard from '../../components/JobCard'
import JobCardSkeleton from '../../components/JobCardSkeleton'
import LocationFilter from '../../components/LocationFilter'
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS, WORK_TYPE_LABELS } from '../../constants/jobOptions'

const PAGE_SIZE = 20

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [data, setData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState(searchParams.get('search') || '')

  const page = Number(searchParams.get('page') || 1)
  const selectedLocations = searchParams.getAll('location').map(Number)

  useEffect(() => {
    getJobCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    getJobs(searchParams) // pass URLSearchParams directly to preserve multiple ?location values
      .then(setData)
      .catch(() => setData({ results: [], count: 0 }))
      .finally(() => setLoading(false))
  }, [searchParams])

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value === undefined || value === '' || value === null) next.delete(key)
    else next.set(key, value)
    next.delete('page')
    setSearchParams(next)
  }

  function setLocations(ids) {
    const next = new URLSearchParams(searchParams)
    next.delete('location')
    ids.forEach((id) => next.append('location', id))
    next.delete('page')
    setSearchParams(next)
  }

  function handlePageChange(nextPage) {
    const next = new URLSearchParams(searchParams)
    next.set('page', nextPage)
    setSearchParams(next)
  }

  const results = Array.isArray(data) ? data : data.results || []
  const count = Array.isArray(data) ? data.length : data.count || 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <Input.Search
          size="large"
          placeholder="Vị trí, công ty, từ khoá..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(value) => updateParam('search', value)}
          allowClear
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1 bg-white border border-gray-200 rounded-lg p-4 h-fit space-y-4">
          <Typography.Text strong>Bộ lọc</Typography.Text>
          <div>
            <Typography.Text className="block mb-1 text-sm text-gray-500">Ngành nghề</Typography.Text>
            <Select
              className="w-full"
              allowClear
              placeholder="Tất cả ngành nghề"
              value={searchParams.get('category') || undefined}
              onChange={(v) => updateParam('category', v)}
              options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            />
          </div>
          <div>
            <Typography.Text className="block mb-1 text-sm text-gray-500">Địa điểm</Typography.Text>
            <LocationFilter value={selectedLocations} onChange={setLocations} />
          </div>
          <div>
            <Typography.Text className="block mb-1 text-sm text-gray-500">Hình thức làm việc</Typography.Text>
            <Select
              className="w-full"
              allowClear
              placeholder="Tất cả"
              value={searchParams.get('work_type') || undefined}
              onChange={(v) => updateParam('work_type', v)}
              options={Object.entries(WORK_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <Typography.Text className="block mb-1 text-sm text-gray-500">Loại hình</Typography.Text>
            <Select
              className="w-full"
              allowClear
              placeholder="Tất cả"
              value={searchParams.get('employment_type') || undefined}
              onChange={(v) => updateParam('employment_type', v)}
              options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <Typography.Text className="block mb-1 text-sm text-gray-500">Cấp bậc</Typography.Text>
            <Select
              className="w-full"
              allowClear
              placeholder="Tất cả"
              value={searchParams.get('experience_level') || undefined}
              onChange={(v) => updateParam('experience_level', v)}
              options={Object.entries(EXPERIENCE_LEVEL_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </aside>

        <div className="md:col-span-3">
          <Typography.Text className="block mb-3 text-gray-500">
            {loading ? 'Đang tải...' : `${count} việc làm phù hợp`}
          </Typography.Text>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <JobCardSkeleton key={i} />)}
            </div>
          ) : results.length === 0 ? (
            <Empty description="Không tìm thấy việc làm phù hợp" />
          ) : (
            <div className="space-y-4">
              {results.map((job) => <JobCard key={job.public_id} job={job} />)}
            </div>
          )}
          {count > PAGE_SIZE && (
            <div className="flex justify-center mt-6">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={count}
                onChange={handlePageChange}
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
