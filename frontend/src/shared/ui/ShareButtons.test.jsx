import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShareButtons from './ShareButtons'

const toast = vi.hoisted(() => ({ message: { success: vi.fn(), info: vi.fn() } }))

vi.mock('@/shared/lib/toast', () => toast)

describe('ShareButtons', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    toast.message.success.mockReset()
    toast.message.info.mockReset()
  })

  it('opens each network with the encoded current page URL', () => {
    render(<ShareButtons />)
    const pageUrl = encodeURIComponent(window.location.href)

    fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ qua Facebook' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ qua Twitter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ qua LinkedIn' }))

    const openedUrls = window.open.mock.calls.map(([url]) => url)
    expect(openedUrls[0]).toBe(`https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`)
    expect(openedUrls[1]).toContain(`https://twitter.com/intent/tweet?url=${pageUrl}`)
    expect(openedUrls[2]).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`)
    expect(window.open.mock.calls.every(([, target]) => target === '_blank')).toBe(true)
  })

  it('copies the page link and confirms with the caller message', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<ShareButtons copiedMessage="Đã sao chép đường dẫn công ty." />)

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép đường dẫn' }))

    await waitFor(() => expect(toast.message.success).toHaveBeenCalledWith('Đã sao chép đường dẫn công ty.'))
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })

  it('falls back to a hint when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    render(<ShareButtons />)

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép đường dẫn' }))

    await waitFor(() => expect(toast.message.info).toHaveBeenCalledTimes(1))
    expect(toast.message.success).not.toHaveBeenCalled()
  })
})
