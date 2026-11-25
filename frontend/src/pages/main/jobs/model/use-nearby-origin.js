import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getGeoWard, readNearbyOrigin, saveNearbyOrigin } from '@/entities/system/location'

// Gốc tìm kiếm: phường/xã trên URL (`gan`, chia sẻ được) thắng vị trí đã chọn
// trong phiên (GPS/địa chỉ/bấm bản đồ — chỉ sessionStorage).
export default function useNearbyOrigin(wardSlug) {
  const [sessionOrigin, setSessionOrigin] = useState(readNearbyOrigin)
  const wardQuery = useQuery({
    queryKey: ['locations', 'geo-ward', wardSlug],
    queryFn: () => getGeoWard(wardSlug),
    enabled: Boolean(wardSlug),
    staleTime: Infinity,
    retry: false,
  })

  const ward = wardQuery.data
  const wardOrigin = useMemo(() => ward && {
    latitude: ward.latitude,
    longitude: ward.longitude,
    label: ward.ward_name,
    source: 'ward',
    wardSlug,
  }, [ward, wardSlug])
  const origin = (wardSlug ? wardOrigin : sessionOrigin) || null

  // Phường/xã từ URL cũng là gốc của phiên: trang chi tiết tin dùng để hiện "Cách bạn".
  useEffect(() => {
    if (wardOrigin) saveNearbyOrigin(wardOrigin)
  }, [wardOrigin])

  const setOrigin = useCallback((next) => {
    saveNearbyOrigin(next)
    setSessionOrigin(next)
  }, [])

  return { origin, setOrigin }
}
