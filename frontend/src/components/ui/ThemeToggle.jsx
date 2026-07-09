import { MoonOutlined, SunOutlined } from '@ant-design/icons'

export default function ThemeToggle({ scheme, onToggle, className = '' }) {
  const isDark = scheme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors cursor-pointer hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:border-[#3ddc84] dark:hover:text-[#3ddc84] ${className}`}
    >
      {isDark ? <SunOutlined /> : <MoonOutlined />}
    </button>
  )
}
