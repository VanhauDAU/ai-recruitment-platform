import { SearchOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobCategories } from '@/api/jobService'
import LocationFilter from '@/components/job/LocationFilter'
import CategoryPicker from '../CategoryPicker'

// Thanh tìm kiếm độc lập cho trang chi tiết: giữ người dùng trong ngữ cảnh
// tìm việc, nhưng không mang theo state/phụ thuộc phức tạp của trang danh sách.
export default function JobDetailSearchBar() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [keyword, setKeyword] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedLocations, setSelectedLocations] = useState([])

  useEffect(() => {
    let cancelled = false
    getJobCategories()
      .then((items) => { if (!cancelled) setCategories(items) })
      .catch(() => { if (!cancelled) setCategories([]) })
    return () => { cancelled = true }
  }, [])

  function runSearch() {
    const params = new URLSearchParams()
    if (keyword.trim()) params.set('search', keyword.trim())
    if (selectedCategories.length) params.set('cat', selectedCategories.join(','))
    if (selectedLocations.length) params.set('locations', selectedLocations.join(','))
    const query = params.toString()
    navigate(query ? `/viec-lam?${query}` : '/viec-lam')
  }

  return (
    <section className="bg-gradient-to-r from-[#087a51] to-[var(--brand-primary)] shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 lg:flex-row">
        <div className="lg:w-64 [&_button]:!h-11 [&_button]:!rounded-lg">
          <CategoryPicker
            categories={categories}
            value={selectedCategories}
            onChange={setSelectedCategories}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <Input
            size="large"
            placeholder="Vị trí tuyển dụng, tên công ty"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={runSearch}
            allowClear
            className="!h-11 flex-1 !rounded-lg"
          />
          <div className="sm:w-64 [&>button]:!h-11 [&>button]:!rounded-lg">
            <LocationFilter value={selectedLocations} onChange={setSelectedLocations} size="large" />
          </div>
          <Button
            type="primary"
            size="large"
            onClick={runSearch}
            className="!h-11 !rounded-lg !border-white/20 !bg-white !px-7 !font-semibold !text-[var(--brand-primary)] hover:!bg-emerald-50"
          >
            Tìm kiếm
          </Button>
        </div>
      </div>
    </section>
  )
}
