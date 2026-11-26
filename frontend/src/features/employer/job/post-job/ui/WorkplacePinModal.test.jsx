import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkplacePinModal from './WorkplacePinModal'

const mocks = vi.hoisted(() => ({
  searchGeoPlaces: vi.fn(),
  resolveGeoPlace: vi.fn(),
}))

vi.mock('@/entities/system/location', () => ({
  searchGeoPlaces: mocks.searchGeoPlaces,
  resolveGeoPlace: mocks.resolveGeoPlace,
}))

vi.mock('@/entities/system/site-settings', () => ({ useBasemap: () => ({ styleUrl: 'https://maps.vietmap.vn/style.json', attribution: '' }) }))

vi.mock('@/shared/ui/map/MapView', () => ({
  default: ({ origin, onOriginChange }) => (
    <button type="button" onClick={() => onOriginChange({ latitude: 21.5, longitude: 105.85 })}>
      {`map ${origin.latitude},${origin.longitude}`}
    </button>
  ),
}))

const WARD = { id: 7, name: 'Phường Hoàn Kiếm', latitude: 21.032, longitude: 105.85 }

describe('WorkplacePinModal', () => {
  beforeEach(() => {
    mocks.searchGeoPlaces.mockReset()
    mocks.resolveGeoPlace.mockReset()
  })

  it('suggests a pin from the typed address and saves the chosen point', async () => {
    mocks.searchGeoPlaces.mockResolvedValue([{ type: 'ward', ref: 'ward:x' }, { type: 'place', ref: 'vietmap:1' }])
    mocks.resolveGeoPlace.mockResolvedValue({ latitude: 21.0245, longitude: 105.857, label: '1 Tràng Tiền' })
    const onSave = vi.fn()
    render(<WorkplacePinModal open address="1 Tràng Tiền" ward={WARD} onSave={onSave} onClose={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'map 21.0245,105.857' })).toBeInTheDocument()
    expect(mocks.searchGeoPlaces).toHaveBeenCalledWith('1 Tràng Tiền, Phường Hoàn Kiếm', WARD)
    expect(screen.getByText(/gợi ý theo địa chỉ/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Lưu vị trí' }))
    expect(onSave).toHaveBeenCalledWith({ latitude: 21.0245, longitude: 105.857 })
  })

  it('falls back to the ward centre and warns when the pin drifts far away', async () => {
    mocks.searchGeoPlaces.mockRejectedValue(new Error('provider down'))
    render(<WorkplacePinModal open address="Số 9" ward={WARD} onSave={vi.fn()} onClose={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'map 21.032,105.85' }))
    await waitFor(() => expect(screen.getByText(/cách tâm phường\/xã đã chọn khoảng 52 km/)).toBeInTheDocument())
  })

  it('lets the employer remove an existing pin', async () => {
    const onSave = vi.fn()
    render(<WorkplacePinModal open pin={{ latitude: 21.03, longitude: 105.85 }} ward={WARD} onSave={onSave} onClose={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ ghim' }))
    expect(onSave).toHaveBeenCalledWith(null)
    expect(mocks.searchGeoPlaces).not.toHaveBeenCalled()
  })
})
