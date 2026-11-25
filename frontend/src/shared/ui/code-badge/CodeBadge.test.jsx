import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CodeBadge from './CodeBadge'

const toast = vi.hoisted(() => ({ message: { success: vi.fn(), info: vi.fn() } }))

vi.mock('@/shared/lib/toast', () => toast)

describe('CodeBadge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    toast.message.success.mockReset()
    toast.message.info.mockReset()
  })

  it('renders nothing without a code', () => {
    const { container } = render(<CodeBadge code="" label="Mã tin" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('copies the code without triggering the row it sits in', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const openRow = vi.fn()
    render(<div onClick={openRow}><CodeBadge code="J4829173" label="Mã tin" /></div>)

    expect(screen.getByText('Mã tin')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép mã J4829173' }))

    await waitFor(() => expect(toast.message.success).toHaveBeenCalledWith('Đã sao chép mã J4829173.'))
    expect(writeText).toHaveBeenCalledWith('J4829173')
    expect(openRow).not.toHaveBeenCalled()
  })

  it('asks to copy manually when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<CodeBadge code="C305812" />)

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép mã C305812' }))

    await waitFor(() => expect(toast.message.info).toHaveBeenCalled())
  })
})
