import { useCallback, useEffect, useRef, useState } from 'react'
import { getArchivedCvs, getMyCvs } from '@/entities/cv'

// Data hook cho trang Quản lý CV: tải song song CV đang hoạt động + đã lưu trữ.
// requestId chặn set state từ request cũ (refresh chồng nhau hoặc unmount).
export function useMyCvsData() {
  const [cvs, setCvs] = useState([])
  const [archivedCvs, setArchivedCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const [activeCvs, archived] = await Promise.all([getMyCvs(), getArchivedCvs()])
      if (requestId !== requestIdRef.current) return
      setCvs(activeCvs)
      setArchivedCvs(archived)
    } catch {
      if (requestId !== requestIdRef.current) return
      setCvs([])
      setArchivedCvs([])
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    return () => {
      requestIdRef.current += 1
    }
  }, [refresh])

  return {
    builderCvs: cvs.filter((cv) => cv.cv_type === 'builder'),
    uploadedCvs: cvs.filter((cv) => cv.cv_type === 'uploaded'),
    archivedCvs,
    loading,
    refresh,
  }
}
