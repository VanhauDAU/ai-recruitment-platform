import { describe, expect, it } from 'vitest'
import { isVietnameseBasemap } from './use-basemap'

describe('isVietnameseBasemap', () => {
  it('accepts VietMap styles over https', () => {
    expect(isVietnameseBasemap('https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=k')).toBe(true)
  })

  it('rejects OpenStreetMap-based styles, plain http and junk', () => {
    expect(isVietnameseBasemap('https://tiles.openfreemap.org/styles/positron')).toBe(false)
    expect(isVietnameseBasemap('https://tiles.goong.io/assets/goong_map_web.json?api_key=k')).toBe(false)
    expect(isVietnameseBasemap('https://api.maptiler.com/maps/streets/style.json?key=k')).toBe(false)
    expect(isVietnameseBasemap('https://maps.vietmap.vn.evil.example/style.json')).toBe(false)
    expect(isVietnameseBasemap('http://maps.vietmap.vn/maps/styles/tm/style.json')).toBe(false)
    expect(isVietnameseBasemap('')).toBe(false)
    expect(isVietnameseBasemap('not a url')).toBe(false)
  })
})
