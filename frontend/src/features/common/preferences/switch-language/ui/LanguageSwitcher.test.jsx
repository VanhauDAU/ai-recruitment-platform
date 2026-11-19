import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
