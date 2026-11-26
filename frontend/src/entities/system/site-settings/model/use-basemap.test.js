import { describe, expect, it } from 'vitest'
import { vietmapRasterStyle } from './use-basemap'

const TM = 'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=k%2B1'

describe('vietmapRasterStyle', () => {
  it('turns a VietMap style link into PNG tiles of the same map kind and key', () => {
    const style = vietmapRasterStyle(TM)
    expect(style.sources.vietmap).toMatchObject({
      type: 'raster',
      tiles: ['https://maps.vietmap.vn/maps/tiles/tm/{z}/{x}/{y}.png?apikey=k%2B1'],
      tileSize: 256,
      maxzoom: 18,
    })
    expect(style.layers).toEqual([{ id: 'vietmap', type: 'raster', source: 'vietmap' }])
    expect(vietmapRasterStyle(TM.replace('/tm/', '/lm/'), 2).sources.vietmap.tiles[0])
      .toBe('https://maps.vietmap.vn/maps/tiles/lm/{z}/{x}/{y}@2x.png?apikey=k%2B1')
  })

  it('rejects anything that is not an https VietMap style with a key', () => {
    for (const url of [
      'https://tiles.openfreemap.org/styles/positron',
      'https://tiles.goong.io/assets/goong_map_web.json?api_key=k',
      'https://maps.vietmap.vn.evil.example/maps/styles/tm/style.json?apikey=k',
      'http://maps.vietmap.vn/maps/styles/tm/style.json?apikey=k',
      'https://maps.vietmap.vn/maps/styles/tm/style.json',
      'https://maps.vietmap.vn/other/path.json?apikey=k',
      '',
      'not a url',
    ]) expect(vietmapRasterStyle(url)).toBeNull()
  })
})
