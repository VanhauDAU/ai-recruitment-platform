import { RENDERER_CONTRACTS } from '@/entities/cv'
import LayoutSchematic from './LayoutSchematic'

// Chọn một trong các layout của registry; dùng trong Form.Item (value/onChange).
export default function LayoutPicker({ value, onChange, disabled = false }) {
  // Số cột theo bề rộng khối chứa (container query), không theo màn hình: cùng
  // một bảng nằm gọn trong cột thiết lập hẹp lẫn hộp thoại rộng.
  return <div className="@container"><div role="radiogroup" aria-label="Bố cục" className="grid grid-cols-4 gap-2 @xl:grid-cols-8">
    {Object.values(RENDERER_CONTRACTS).map((contract) => {
      const active = value === contract.key
      return <button key={contract.key} type="button" role="radio" aria-checked={active} title={contract.label} disabled={disabled} onClick={() => onChange?.(contract.key)}
        className={`min-w-0 rounded-xl border p-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/25' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
        <LayoutSchematic rendererKey={contract.key} active={active} />
        <span className={`mt-1.5 line-clamp-2 block text-[11px] font-semibold leading-tight ${active ? 'text-emerald-800' : 'text-slate-600'}`}>{contract.label}</span>
      </button>
    })}
  </div></div>
}
