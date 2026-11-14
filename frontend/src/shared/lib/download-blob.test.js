import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerBlobDownload } from './download-blob'

describe('triggerBlobDownload', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicks a temporary anchor and releases the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:cv')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    vi.useFakeTimers()
    triggerBlobDownload(new Blob(['%PDF']), 'cv.pdf')
    vi.runAllTimers()

    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cv')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.unstubAllGlobals()
  })
})
