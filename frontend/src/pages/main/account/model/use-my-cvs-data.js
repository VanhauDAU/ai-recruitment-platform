import { useCallback, useEffect, useRef, useState } from 'react'
import { getMyCvs } from '@/entities/cv'

// Data hook cho trang Quản lý CV. requestId chặn set state từ request cũ
// (refresh chồng nhau hoặc unmount).
export function useMyCvsData() {
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const activeCvs = await getMyCvs()
      if (requestId !== requestIdRef.current) return
      setCvs(activeCvs)
    } catch {
      if (requestId !== requestIdRef.current) return
      setCvs([])
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
    loading,
    refresh,
  }
}
