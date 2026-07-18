import { GlobalOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'
import { useTranslation } from 'react-i18next'
import { changeAppLanguage, SUPPORTED_LANGUAGES } from '@/shared/config/i18n'

const LANGUAGE_LABELS = { vi: 'Tiếng Việt', en: 'English' }

export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation()
  const current = SUPPORTED_LANGUAGES.includes(i18n.language) ? i18n.language : 'vi'

  return (
    <Dropdown
      menu={{
        selectedKeys: [current],
        items: SUPPORTED_LANGUAGES.map((lang) => ({ key: lang, label: LANGUAGE_LABELS[lang] })),
        onClick: ({ key }) => changeAppLanguage(key),
      }}
      trigger={['click']}
    >
      <button
        type="button"
        aria-label="Đổi ngôn ngữ / Change language"
        className={`flex h-9 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] ${className}`}
      >
        <GlobalOutlined />
        <span className="uppercase">{current}</span>
      </button>
    </Dropdown>
  )
}
