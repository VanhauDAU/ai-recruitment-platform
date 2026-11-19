import { afterEach, describe, expect, it } from 'vitest'
import {
  changeLocale,
  DEFAULT_LOCALE,
  getIntlLocale,
  getLocale,
  getOgLocale,
  LOCALE_STORAGE_KEY,
  m,
} from './index'

describe('i18n', () => {
  afterEach(() => changeLocale('vi', { reload: false }))

  it('mặc định tiếng Việt, chuỗi dịch theo ngôn ngữ đang chọn', () => {
    expect(DEFAULT_LOCALE).toBe('vi')
    expect(getLocale()).toBe('vi')
    expect(m.marketing_nav_services()).toBe('Dịch vụ')
    expect(m.marketing_nav_services({}, { locale: 'en' })).toBe('Services')
  })

  it('changeLocale lưu lựa chọn, đổi <html lang> và locale Intl', () => {
    expect(changeLocale('en', { reload: false })).toBe(true)
    expect(getLocale()).toBe('en')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(getIntlLocale()).toBe('en-US')
    expect(getOgLocale()).toBe('en_US')
    expect(m.marketing_nav_services()).toBe('Services')
  })

  it('bỏ qua ngôn ngữ không hỗ trợ hoặc trùng ngôn ngữ hiện tại', () => {
    expect(changeLocale('fr', { reload: false })).toBe(false)
    expect(changeLocale('vi', { reload: false })).toBe(false)
    expect(getLocale()).toBe('vi')
  })
})
