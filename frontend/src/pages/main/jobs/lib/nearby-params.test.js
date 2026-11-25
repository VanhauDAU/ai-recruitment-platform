import { describe, expect, it } from 'vitest'
import { nearbyApiParams, radiusOptions, readNearbyFilters, shortPlaceName } from './nearby-params'

const LIMITS = { defaultRadius: 10, maxRadius: 50 }

describe('nearby params', () => {
  it('reads shareable filters and falls back to the default radius', () => {
    const filters = readNearbyFilters(new URLSearchParams('r=20&cat=7&salary=10-15&remote=1&page=2&gan=phuong-ba-dinh-00004'), LIMITS)
    expect(filters).toEqual({ radius: 20, category: '7', salary: '10-15', remote: true, page: 2, wardSlug: 'phuong-ba-dinh-00004' })
    expect(readNearbyFilters(new URLSearchParams('r=7'), LIMITS).radius).toBe(10)
    expect(readNearbyFilters(new URLSearchParams('r=50'), { defaultRadius: 10, maxRadius: 20 }).radius).toBe(10)
  })

  it('offers only radius options within the configured maximum', () => {
    expect(radiusOptions(20)).toEqual([3, 5, 10, 20])
    expect(radiusOptions(1)).toEqual([3])
  })

  it('rounds the origin and expands salary ranges for the API', () => {
    const params = nearbyApiParams(
      { latitude: 21.028512, longitude: 105.854234 },
      { radius: 5, category: '7', salary: '10-15', remote: true, page: 3 },
    )
    expect(Object.fromEntries(params)).toEqual({
      lat: '21.029',
      lng: '105.854',
      radius_km: '5',
      category: '7',
      salary_gte: '10000000',
      salary_lte: '15000000',
      include_remote: '1',
      page: '3',
    })
    const negotiable = nearbyApiParams({ latitude: 21, longitude: 105 }, { radius: 10, salary: 'nego', page: 1 })
    expect(negotiable.get('salary_negotiable')).toBe('1')
    expect(negotiable.has('page')).toBe(false)
  })

  it('shortens administrative prefixes for pins and headings', () => {
    expect(shortPlaceName('Phường Điện Bàn')).toBe('P. Điện Bàn')
    expect(shortPlaceName('Xã Tây Hồ')).toBe('X. Tây Hồ')
    expect(shortPlaceName('Thành phố Đà Nẵng')).toBe('Đà Nẵng')
    expect(shortPlaceName('Tỉnh Quảng Ninh')).toBe('Quảng Ninh')
    expect(shortPlaceName('Đặc khu Phú Quốc')).toBe('ĐK. Phú Quốc')
  })
})
