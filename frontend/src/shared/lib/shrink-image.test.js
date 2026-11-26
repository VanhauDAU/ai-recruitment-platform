import { afterEach, describe, expect, it, vi } from 'vitest'
import { shrinkImage } from './shrink-image'

const LIMIT = { maxWidth: 800, maxHeight: 800 }
const bigFile = (type = 'image/png') => new File([new Uint8Array(2_000_000)], 'logo.png', { type })

function stubBrowser({ width, height, encodes = ['image/webp'] }) {
  const close = vi.fn()
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })))
  const drawImage = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(done, type) {
    // Trình duyệt không mã hóa được định dạng xin thì trả PNG.
    done(new Blob([new Uint8Array(1000)], { type: encodes.includes(type) ? type : 'image/png' }))
  })
  return { close, drawImage }
}

describe('shrinkImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the file when the browser cannot decode images', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const file = bigFile()
    expect(await shrinkImage(file, LIMIT)).toBe(file)
  })

  it('downscales into the limit as WebP and releases the bitmap', async () => {
    const { close, drawImage } = stubBrowser({ width: 2000, height: 1000 })

    const result = await shrinkImage(bigFile(), LIMIT)

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 400)
    expect(result).toMatchObject({ name: 'logo.webp', type: 'image/webp', size: 1000 })
    expect(close).toHaveBeenCalled()
  })

  it('keeps a small image that already fits', async () => {
    stubBrowser({ width: 400, height: 400 })
    const file = new File([new Uint8Array(1000)], 'logo.png', { type: 'image/png' })
    expect(await shrinkImage(file, LIMIT)).toBe(file)
  })

  it('falls back to JPEG for photos, and keeps PNG when WebP is unavailable', async () => {
    stubBrowser({ width: 2000, height: 1000, encodes: ['image/jpeg'] })

    expect(await shrinkImage(bigFile('image/jpeg'), LIMIT)).toMatchObject({ name: 'logo.jpg', type: 'image/jpeg' })
    const png = bigFile()
    expect(await shrinkImage(png, LIMIT)).toBe(png)
  })
})
