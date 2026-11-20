import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerUnsavedChanges } from '@/shared/lib/unsaved-changes'
import LanguageSwitcher from './LanguageSwitcher'

const mocks = vi.hoisted(() => ({
  session: { isAuthenticated: false },
  changeLocale: vi.fn(),
  savePreferredLanguage: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/entities/account/session', () => ({ useSession: () => mocks.session }))
vi.mock('@/shared/lib/toast', () => ({ message: { error: mocks.error } }))
vi.mock('../api/preferred-language.api', () => ({ savePreferredLanguage: mocks.savePreferredLanguage }))
vi.mock('@/shared/config/i18n', async (importOriginal) => ({
  ...(await importOriginal()),
  changeLocale: mocks.changeLocale,
}))

async function chooseEnglish() {
  const trigger = screen.getByRole('button', { name: 'Đổi ngôn ngữ' })
  expect(trigger.textContent).toContain('vi')
  fireEvent.click(trigger)
  fireEvent.click(await screen.findByText('English'))
}

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session.isAuthenticated = false
  })

  it('khách chưa đăng nhập: đổi ngôn ngữ ngay trên thiết bị', async () => {
    render(<LanguageSwitcher />)
    await chooseEnglish()

    expect(mocks.savePreferredLanguage).not.toHaveBeenCalled()
    expect(mocks.changeLocale).toHaveBeenCalledWith('en')
  })

  it('đã đăng nhập: lưu vào tài khoản rồi mới đổi', async () => {
    mocks.session.isAuthenticated = true
    mocks.savePreferredLanguage.mockResolvedValue({})
    render(<LanguageSwitcher />)
    await chooseEnglish()

    await waitFor(() => expect(mocks.changeLocale).toHaveBeenCalledWith('en'))
    expect(mocks.savePreferredLanguage).toHaveBeenCalledWith('en')
  })

  it('lưu thất bại: báo lỗi và giữ nguyên ngôn ngữ', async () => {
    mocks.session.isAuthenticated = true
    mocks.savePreferredLanguage.mockRejectedValue(new Error('network'))
    render(<LanguageSwitcher />)
    await chooseEnglish()

    await waitFor(() => expect(mocks.error).toHaveBeenCalled())
    expect(mocks.changeLocale).not.toHaveBeenCalled()
  })

  it('hỏi trước khi tải lại nếu trang còn thay đổi chưa lưu', async () => {
    const unregister = registerUnsavedChanges(() => true)
    mocks.changeLocale.mockReturnValue(true)
    render(<LanguageSwitcher />)

    await chooseEnglish()
    expect(await screen.findByText('Đổi ngôn ngữ khi còn thay đổi chưa lưu?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ở lại để lưu' }))
    expect(mocks.changeLocale).not.toHaveBeenCalled()

    await chooseEnglish()
    fireEvent.click(await screen.findByRole('button', { name: 'Vẫn đổi ngôn ngữ' }))
    await waitFor(() => expect(mocks.changeLocale).toHaveBeenCalledWith('en'))

    // Đã xác nhận trong app: trình duyệt không hỏi lại khi trang tải lại.
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(false)
    unregister()
  })
})
