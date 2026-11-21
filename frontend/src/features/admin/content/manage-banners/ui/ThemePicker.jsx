import { CheckOutlined } from '@ant-design/icons'
import { BANNER_THEME_KEYS, bannerBackgroundStyle, bannerTheme } from '@/entities/content/banner'

/** Chọn tông màu bằng ô gradient thật; dùng làm control của Form.Item. */
export default function ThemePicker({ id, value, onChange }) {
  return (
    <div id={id} role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {BANNER_THEME_KEYS.map((key) => {
        const selected = (value || 'green') === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange?.(key)}
            className={`flex items-center gap-2 rounded-lg border p-1.5 text-left text-sm transition ${
              selected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md text-white" style={bannerBackgroundStyle(key)}>
              {selected && <CheckOutlined />}
            </span>
            <span className="truncate">{bannerTheme(key).label()}</span>
          </button>
        )
      })}
    </div>
  )
}
