import { lazy, Suspense, useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { resolveGeoPlace, searchGeoPlaces } from '@/entities/system/location'
import { useBasemap } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'
import { haversineKm } from '@/shared/lib/geo'

const MapView = lazy(() => import('@/shared/ui/map/MapView'))
const FAR_FROM_WARD_KM = 15

// Gợi ý ghim ban đầu: ghim cũ > kết quả tra địa chỉ NTD đã nhập > tâm phường/xã.
async function suggestPin({ pin, address, ward }) {
  if (pin) return { point: pin, source: 'pin' }
  if (address && ward) {
    try {
      const options = await searchGeoPlaces(`${address}, ${ward.name}`, ward)
      const place = options.find((option) => option.type === 'place')
      if (place) return { point: await resolveGeoPlace(place.ref), source: 'address' }
    } catch {
      // Nhà cung cấp lỗi/tắt: dùng tâm phường.
    }
  }
  return ward?.latitude ? { point: { latitude: ward.latitude, longitude: ward.longitude }, source: 'ward' } : null
}

export default function WorkplacePinModal({ open, pin, address, ward, onSave, onClose }) {
  const basemap = useBasemap()
  const [state, setState] = useState({ point: null, source: null })

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    suggestPin({ pin, address, ward }).then((result) => {
      if (!cancelled) setState(result || { point: null, source: null })
    })
    return () => {
      cancelled = true
    }
  }, [open, pin, address, ward])

  const point = state.point && { latitude: state.point.latitude, longitude: state.point.longitude }
  const distanceFromWard = point && ward?.latitude ? haversineKm(point, ward) : 0
  let note = m.employer_job_location_pin_help()
  if (distanceFromWard > FAR_FROM_WARD_KM) note = m.employer_job_location_pin_far({ km: Math.round(distanceFromWard) })
  else if (state.source === 'address') note = m.employer_job_location_pin_suggested()
  else if (state.source === 'ward') note = m.employer_job_location_pin_ward_center()

  return (
    <Modal
      open={open}
      title={m.employer_job_location_pin_title()}
      onCancel={onClose}
      width={720}
      destroyOnHidden
      footer={[
        pin && (
          <Button key="remove" danger onClick={() => onSave(null)}>
            {m.employer_job_location_pin_remove()}
          </Button>
        ),
        <Button key="cancel" onClick={onClose}>{m.employer_job_form_cancel()}</Button>,
        <Button key="save" type="primary" disabled={!point} onClick={() => onSave(point)}>
          {m.employer_job_location_pin_save()}
        </Button>,
      ]}
    >
      <p className={distanceFromWard > FAR_FROM_WARD_KM ? 'text-sm text-red-600' : 'text-sm text-slate-500'}>{note}</p>
      <div className="mt-3 h-[360px]" role="region" aria-label={m.employer_job_location_pin_map_label()}>
        {open && point && basemap && (
          <Suspense fallback={<div className="map-view h-full" />}>
            <MapView
              key={basemap.styleUrl}
              styleUrl={basemap.styleUrl}
              attribution={basemap.attribution}
              origin={point}
              originLabel={address || ward?.name}
              onOriginChange={(next) => setState({ point: next, source: 'pin' })}
            />
          </Suspense>
        )}
      </div>
    </Modal>
  )
}
