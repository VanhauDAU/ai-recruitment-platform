import { useEffect, useMemo, useState } from 'react'
import { getLocationsByIds, getWards } from '../../../../api/locationService'
import { shortLocationName } from '../utils/jobListParams'

function groupSelectedLocations(selectedLocations, details, provinces) {
  const locationMap = new Map(details.map((location) => [location.id, location]))
  const groups = new Map()
  const provincesById = new Map(provinces.map((province) => [province.id, province]))

  for (const locationId of selectedLocations) {
    const location = locationMap.get(locationId)
    if (!location) continue
    if (location.level === 'province') {
      const group = groups.get(location.id) || { province: location, wards: [], allProvince: false }
      groups.set(location.id, { ...group, province: location, allProvince: true })
      continue
    }
    if (location.level === 'ward') {
      const province = provincesById.get(location.parent)
      const groupKey = province?.id || `ward-${location.id}`
      const group = groups.get(groupKey) || { province, wards: [], allProvince: false }
      if (!group.allProvince && !group.wards.some((ward) => ward.id === location.id)) {
        group.wards.push(location)
      }
      groups.set(groupKey, group)
    }
  }
  return [...groups.values()]
}

export default function useJobLocationData(selectedLocations, selectedLocationKey, provinces) {
  const [details, setDetails] = useState([])
  const [suggestedWards, setSuggestedWards] = useState([])

  useEffect(() => {
    if (!selectedLocations.length) {
      setDetails([])
      return undefined
    }
    let cancelled = false
    getLocationsByIds(selectedLocations)
      .then((items) => { if (!cancelled) setDetails(items) })
      .catch(() => { if (!cancelled) setDetails([]) })
    return () => { cancelled = true }
    // selectedLocationKey represents the normalized ID list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationKey])

  const groups = useMemo(
    () => groupSelectedLocations(selectedLocations, details, provinces),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [details, provinces, selectedLocationKey],
  )
  const suggestedProvinces = useMemo(
    () => groups
      .map((group) => group.province)
      .filter(Boolean)
      .filter((province, index, items) => (
        items.findIndex((item) => item.id === province.id) === index
      )),
    [groups],
  )

  useEffect(() => {
    if (!suggestedProvinces.length) {
      setSuggestedWards([])
      return undefined
    }
    let cancelled = false
    Promise.all(
      suggestedProvinces.map((province) => (
        getWards(province.id).then((wards) => ({ province, wards }))
      )),
    )
      .then((wardGroups) => {
        if (cancelled) return
        const selected = new Set(selectedLocations)
        const candidates = wardGroups.flatMap(({ province, wards }) => (
          wards
            .filter((ward) => !selected.has(ward.id))
            .map((ward) => ({
              ...ward,
              provinceId: province.id,
              provinceName: shortLocationName(province.name),
            }))
        ))
        setSuggestedWards(candidates.sort(() => Math.random() - 0.5).slice(0, 12))
      })
      .catch(() => { if (!cancelled) setSuggestedWards([]) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationKey, suggestedProvinces])

  return { selectedLocationGroups: groups, suggestedWards }
}
