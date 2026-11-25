// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { circleBounds, circlePolygon, formatDistance, haversineKm, isInVietnam, roundCoordinate } from './geo'

const HANOI = { latitude: 21.0285, longitude: 105.8542 }
const HCMC = { latitude: 10.7769, longitude: 106.7009 }

describe('geo helpers', () => {
  it('measures city distances like the backend haversine', () => {
    expect(haversineKm(HANOI, HCMC)).toBeGreaterThan(1130)
    expect(haversineKm(HANOI, HCMC)).toBeLessThan(1145)
    expect(haversineKm(HANOI, HANOI)).toBe(0)
  })

  it('formats metres below one kilometre and Vietnamese decimals above', () => {
    expect(formatDistance(0.43)).toBe('430 m')
    expect(formatDistance(3.44)).toBe('3,4 km')
    expect(formatDistance(16.32)).toBe('16 km')
    expect(formatDistance(3.44, 'en-US')).toBe('3.4 km')
    expect(formatDistance(null)).toBe('')
  })

  it('keeps Vietnamese islands and rejects neighbouring countries', () => {
    expect(isInVietnam(HANOI.latitude, HANOI.longitude)).toBe(true)
    expect(isInVietnam(8.65, 111.92)).toBe(true)
    expect(isInVietnam(13.75, 100.5)).toBe(false)
  })

  it('rounds the origin to about 110 m before it leaves the browser', () => {
    expect(roundCoordinate(21.028512)).toBe(21.029)
  })

  it('draws a closed radius ring that its bounds contain', () => {
    const ring = circlePolygon(HANOI, 10, 36)
    const [[west, south], [east, north]] = circleBounds(HANOI, 10)
    expect(ring[0]).toEqual(ring.at(-1))
    for (const [lng, lat] of ring) {
      expect(haversineKm(HANOI, { latitude: lat, longitude: lng })).toBeCloseTo(10, 1)
      expect(lng).toBeGreaterThanOrEqual(west - 1e-9)
      expect(lng).toBeLessThanOrEqual(east + 1e-9)
      expect(lat).toBeGreaterThanOrEqual(south - 1e-9)
      expect(lat).toBeLessThanOrEqual(north + 1e-9)
    }
  })
})
