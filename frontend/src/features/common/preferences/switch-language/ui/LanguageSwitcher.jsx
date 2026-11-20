import { GlobalOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'
import { useState } from 'react'
import { useSession } from '@/entities/account/session'
import { changeLocale, getLocale, m, SUPPORTED_LOCALES } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { allowNextUnload, hasUnsavedChanges } from '@/shared/lib/unsaved-changes'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import { savePreferredLanguage } from '../api/preferred-language.api'

// Tên ngôn ngữ luôn hiển thị bằng chính ngôn ngữ đó (chuẩn chung của bộ chọn ngôn ngữ).
const LANGUAGE_LABELS = { vi: m.common_language_vi, en: m.common_language_en }

export default function LanguageSwitcher({ className = '' }) {
  const { isAuthenticated } = useSession()
  const [saving, setSaving] = useState(false)
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const current = getLocale()

  // Đã đăng nhập thì lưu vào tài khoản trước: SessionProvider áp ngôn ngữ của
  // tài khoản khi tải trang, nên chỉ đổi trên thiết bị sẽ bị trả lại ngay.
  const switchTo = async (locale) => {
    if (isAuthenticated) {
      setSaving(true)
      try {
        await savePreferredLanguage(locale)
      } catch {
        setSaving(false)
        message.error(m.common_language_save_failed())
        return
      }
    }
    // Đổi ngôn ngữ tải lại trang. Người dùng đã xác nhận bỏ thay đổi chưa lưu
    // (nếu có) ở hộp thoại dưới, nên không để trình duyệt hỏi thêm lần nữa.
    const restoreUnloadWarning = allowNextUnload()
    if (!changeLocale(locale)) {
      restoreUnloadWarning()
      setSaving(false)
    }
  }

  const handleChange = (locale) => {
    if (locale === current || saving) return
    if (!hasUnsavedChanges()) {
      switchTo(locale)
      return
    }
    requestConfirmation({
      title: m.common_language_unsaved_title(),
      description: m.common_language_unsaved_description(),
      confirmText: m.common_language_unsaved_confirm(),
      cancelText: m.common_language_unsaved_cancel(),
      danger: true,
      onConfirm: () => switchTo(locale),
    })
  }

  return (
    <>
      <Dropdown
        menu={{
          selectedKeys: [current],
          items: SUPPORTED_LOCALES.map((locale) => ({ key: locale, label: LANGUAGE_LABELS[locale]() })),
          onClick: ({ key }) => handleChange(key),
        }}
        trigger={['click']}
        disabled={saving}
      >
        <button
          type="button"
          aria-label={m.common_language_switcher_label()}
          className={`flex h-9 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] ${className}`}
        >
          <GlobalOutlined />
          <span className="uppercase">{current}</span>
        </button>
      </Dropdown>
      {confirmationModal}
    </>
  )
}
