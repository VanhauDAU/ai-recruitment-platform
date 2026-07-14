import { CheckOutlined, DownOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'

export default function LocaleDropdown({ value, options = [], onChange }) {
  const current = options.find((item) => item.locale === value) || options[0]

  const items = options.map((item) => ({
    key: item.locale,
    label: (
      <span className="flex items-center gap-2 py-0.5">
        <span className="text-base leading-none">{item.flag}</span>
        <span className={item.locale === value ? 'font-semibold text-slate-900' : 'text-slate-600'}>
          {item.label}
        </span>
        {item.locale === value && <CheckOutlined className="ml-auto text-xs text-[var(--brand-primary)]" />}
      </span>
    ),
  }))

  return (
    <Dropdown
      trigger={['click']}
      menu={{ items, onClick: ({ key }) => onChange?.(key), selectable: true, selectedKeys: [value] }}
    >
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--brand-primary)] bg-white px-4 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary-soft)] cursor-pointer"
      >
        {current?.flag && <span className="text-base leading-none">{current.flag}</span>}
        <span>{current?.label}</span>
        <DownOutlined className="text-[10px]" />
      </button>
    </Dropdown>
  )
}
