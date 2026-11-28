import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import JobShareButton from './JobShareButton'

const media = vi.hoisted(() => ({ compact: true }))
vi.mock('@/shared/hooks/use-media-query', () => ({ useMediaQuery: () => media.compact }))

const JOB = { title: 'Kế toán tổng hợp', company_name: 'Công ty Ánh Dương' }

beforeEach(() => {
  media.compact = true
  vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('phone: the share button opens a sheet with networks, the system share sheet and copy link', async () => {
  const share = vi.fn().mockResolvedValue()
  const writeText = vi.fn().mockResolvedValue()
  vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText } })
  render(<JobShareButton job={JOB} />)

  fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ việc làm' }))
  const pageUrl = `${window.location.origin}${window.location.pathname}`

  fireEvent.click(await screen.findByRole('button', { name: 'Telegram' }))
  expect(window.open.mock.calls[0][0]).toBe(
    `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent('Kế toán tổng hợp – Công ty Ánh Dương')}`,
  )

  fireEvent.click(screen.getByRole('button', { name: /Gửi qua ứng dụng/ }))
  expect(share).toHaveBeenCalledWith({ url: pageUrl, title: 'Kế toán tổng hợp – Công ty Ánh Dương' })

  fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Đã sao chép/ })).toBeInTheDocument())
  expect(writeText).toHaveBeenCalledWith(pageUrl)
})

test('phone without the Web Share API hides the system share option', async () => {
  vi.stubGlobal('navigator', { ...navigator, share: undefined })
  render(<JobShareButton job={JOB} />)

  fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ việc làm' }))
  expect(await screen.findByRole('button', { name: 'Facebook' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Gửi qua ứng dụng/ })).toBeNull()
})
