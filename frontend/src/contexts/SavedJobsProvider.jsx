import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSavedJobs, saveJob, unsaveJob } from '../api/jobService'
import SavedJobsContext from './savedJobsContext'
import { useAuth } from '../hooks/useAuth'

/**
 * Kho "việc làm đã lưu" dùng chung: trái tim trên job card, badge trên nút nổi
 * và panel danh sách đều đọc từ đây nên luôn khớp nhau.
 *
 * Chỉ ứng viên đã đăng nhập mới lưu được (API trả 401 với khách), nên khi chưa
 * đăng nhập kho rỗng và `toggle` không làm gì — job card đã chặn sẵn bằng
 * `onRequireLogin` trước đó.
 */
export default function SavedJobsProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const isCandidate = isAuthenticated && user?.role === 'candidate'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  // Tin đang chờ API save trả về: bật tim ngay để không có độ trễ khi bấm.
  const [pending, setPending] = useState(() => new Set())

  useEffect(() => {
    if (!isCandidate) {
      setItems([])
      return
    }
    let ignore = false
    setLoading(true)
    getSavedJobs()
      .then((data) => {
        if (!ignore) setItems(data)
      })
      .catch(() => {
        if (!ignore) setItems([])
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [isCandidate])

  const savedIds = useMemo(
    () => new Set([...items.map((item) => item.job_detail.public_id), ...pending]),
    [items, pending],
  )

  const toggle = useCallback(async (publicId) => {
    if (!isCandidate) return

    if (savedIds.has(publicId)) {
      const snapshot = items
      setItems((prev) => prev.filter((item) => item.job_detail.public_id !== publicId))
      try {
        await unsaveJob(publicId)
      } catch {
        setItems(snapshot) // bỏ lưu thất bại -> trả tim về trạng thái cũ
      }
      return
    }

    setPending((prev) => new Set(prev).add(publicId))
    try {
      const created = await saveJob(publicId)
      setItems((prev) => [created, ...prev.filter((item) => item.job_detail.public_id !== publicId)])
    } catch {
      // giữ nguyên: pending được gỡ ở finally nên tim tự tắt lại
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(publicId)
        return next
      })
    }
  }, [isCandidate, savedIds, items])

  const value = useMemo(
    () => ({ items, savedIds, loading, toggle, isCandidate }),
    [items, savedIds, loading, toggle, isCandidate],
  )

  return <SavedJobsContext.Provider value={value}>{children}</SavedJobsContext.Provider>
}
