import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import i18n, { changeAppLanguage, LANGUAGE_STORAGE_KEY } from '@/shared/config/i18n'
import LanguageSwitcher from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  afterEach(() => changeAppLanguage('vi'))

  it('hiển thị ngôn ngữ hiện tại và đổi sang English khi chọn', async () => {
    render(<LanguageSwitcher />)
    const trigger = screen.getByRole('button')
    expect(trigger.textContent).toContain('vi')

    fireEvent.click(trigger)
    fireEvent.click(await screen.findByText('English'))

    await waitFor(() => expect(i18n.language).toBe('en'))
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    expect(trigger.textContent).toContain('en')
  })
})
