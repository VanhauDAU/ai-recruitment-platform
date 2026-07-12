import { HeartFilled } from '@ant-design/icons'
import { Button } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getJobs } from '@/features/jobs'
import { useAuth } from '@/hooks/useAuth'
import { useSavedJobs } from '@/hooks/useSavedJobs'
import JobCard from './components/JobCard'
import JobCardSkeleton from './components/JobCardSkeleton'

// Cột phải: banner quảng bá tạo CV (tĩnh, thay cho quảng cáo TopCV ở trang mẫu).
function PromoAside() {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 overflow-hidden rounded-2xl bg-gradient-to-br from-[#053a2c] to-[var(--brand-primary)] p-6 text-white shadow-lg">
        <p className="text-lg font-extrabold leading-snug">
          CV &ldquo;Xịn&rdquo; trong tay<br />Apply ngay việc hot
        </p>
        <p className="mt-2 text-sm text-emerald-50">
          Tạo CV online chuẩn theo ngành nghề, gây ấn tượng với nhà tuyển dụng.
        </p>
        <Link to="/viec-lam">
          <Button className="!mt-4" shape="round">Khám phá ngay</Button>
        </Link>
      </div>
    </aside>
  )
}

// Chọn danh mục hay gặp nhất trong các tin đã lưu để gợi ý "việc làm tương tự".
function dominantCategory(items) {
  const counts = {}
  for (const { job_detail: job } of items) {
    if (job.category) counts[job.category] = (counts[job.category] || 0) + 1
  }
  const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return best ? Number(best[0]) : null
}

export default function SavedJobs() {
  const { loading: authLoading, isAuthenticated } = useAuth()
  const { items, loading, isCandidate } = useSavedJobs()
  const [similar, setSimilar] = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)

  const savedIds = useMemo(() => new Set(items.map((item) => item.job_detail.public_id)), [items])
  const categoryId = useMemo(() => dominantCategory(items), [items])

  useEffect(() => {
    if (loading || items.length === 0) {
      setSimilar([])
      return
    }
    let ignore = false
    setSimilarLoading(true)
    // Có danh mục -> lấy job cùng danh mục; không thì lấy tin mới nhất làm gợi ý.
    getJobs({ ...(categoryId ? { category: categoryId } : {}), page_size: 12 })
      .then((data) => {
        if (ignore) return
        const results = (Array.isArray(data) ? data : data.results || [])
          .filter((job) => !savedIds.has(job.public_id))
          .slice(0, 6)
        setSimilar(results)
      })
      .catch(() => !ignore && setSimilar([]))
      .finally(() => !ignore && setSimilarLoading(false))
    return () => {
      ignore = true
    }
  }, [loading, items.length, categoryId, savedIds])

  // Chờ xác thực xong mới quyết định; chưa đăng nhập ứng viên -> về trang đăng nhập.
  if (!authLoading && !isCandidate) {
    return <Navigate to="/login" replace state={{ from: '/viec-lam-da-luu', reason: isAuthenticated ? 'candidate_only' : 'login_required' }} />
  }

  const busy = authLoading || loading

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Danh sách <span className="text-[var(--brand-primary)]">{busy ? '…' : items.length}</span> việc làm đã lưu
          </h1>

          <div className="mt-4 space-y-3">
            {busy ? (
              Array.from({ length: 3 }).map((_, index) => <JobCardSkeleton key={index} />)
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
                <HeartFilled className="text-4xl text-gray-200" />
                <p className="mt-3 text-base font-semibold text-gray-700">Bạn chưa lưu việc làm nào</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Bấm biểu tượng trái tim trên tin tuyển dụng để lưu lại và xem sau.
                </p>
                <Link to="/viec-lam">
                  <Button type="primary" shape="round" className="!mt-4">Khám phá việc làm</Button>
                </Link>
              </div>
            ) : (
              items.map(({ job_detail: job }) => <JobCard key={job.public_id} job={job} isAuthenticated />)
            )}
          </div>

          {!busy && items.length > 0 && (similarLoading || similar.length > 0) && (
            <section className="mt-8">
              <h2 className="text-lg font-bold text-gray-900">Việc làm tương tự việc bạn đã lưu</h2>
              <div className="mt-4 space-y-3">
                {similarLoading
                  ? Array.from({ length: 3 }).map((_, index) => <JobCardSkeleton key={index} />)
                  : similar.map((job) => <JobCard key={job.public_id} job={job} isAuthenticated />)}
              </div>
            </section>
          )}
        </div>

        <PromoAside />
      </div>
    </div>
  )
}
