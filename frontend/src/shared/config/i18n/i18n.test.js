import { describe, expect, it } from 'vitest'
import i18n, { changeAppLanguage, LANGUAGE_STORAGE_KEY } from './index'

describe('i18n employer marketing', () => {
  it('khởi tạo với tiếng Việt mặc định và namespace employer', () => {
    expect(i18n.isInitialized).toBe(true)
    expect(i18n.options.fallbackLng).toContain('vi')
    expect(i18n.t('employer:nav.pricing', { lng: 'vi' })).toBe('Báo giá')
    expect(i18n.t('employer:nav.pricing', { lng: 'en' })).toBe('Pricing')
  })

  it('changeAppLanguage đổi ngôn ngữ, lưu localStorage và cập nhật <html lang>', () => {
    changeAppLanguage('en')
    expect(i18n.language).toBe('en')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')

    changeAppLanguage('vi')
    expect(i18n.language).toBe('vi')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi')
  })

  it('bỏ qua ngôn ngữ không hỗ trợ', () => {
    changeAppLanguage('vi')
    changeAppLanguage('fr')
    expect(i18n.language).toBe('vi')
  })
})
