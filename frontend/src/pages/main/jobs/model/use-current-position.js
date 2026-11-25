import { useCallback, useState } from 'react'
import { isInVietnam } from '@/shared/lib/geo'

const GEO_ERRORS = { 1: 'denied', 2: 'unavailable', 3: 'timeout' }
const OPTIONS = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5 * 60_000 }

// Lấy vị trí thiết bị một lần khi người dùng bấm nút (không tự hỏi quyền khi mở trang).
// `error` là mã: unsupported | insecure | denied | unavailable | timeout | outside.
export default function useCurrentPosition() {
  const [state, setState] = useState({ locating: false, error: null })

  const locate = useCallback(() => new Promise((resolve) => {
    const fail = (error) => {
      setState({ locating: false, error })
      resolve(null)
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) return fail('insecure')
    if (!navigator.geolocation) return fail('unsupported')
    setState({ locating: true, error: null })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isInVietnam(coords.latitude, coords.longitude)) return fail('outside')
        setState({ locating: false, error: null })
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyKm: Number.isFinite(coords.accuracy) ? coords.accuracy / 1000 : null,
        })
      },
      (error) => fail(GEO_ERRORS[error.code] || 'unavailable'),
      OPTIONS,
    )
  }), [])

  return { ...state, locate }
}
