import { CheckOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Select, Slider } from 'antd'
import { CV_FONT_FAMILIES } from '@/entities/cv'
import { adminCvColors } from '@/entities/cv-template'
import { message } from '@/shared/lib/toast'
import { AdminPanel } from '@/shared/ui/admin'

const MAX_COLORS = 8

function Swatch({ color, selected, label, onClick, disabled }) {
  return <button type="button" title={color.name} aria-label={label} aria-pressed={selected} disabled={disabled} onClick={onClick}
    className={`flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-xs text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'ring-2 ring-slate-800 ring-offset-2' : 'hover:scale-110'}`}
    style={{ background: color.hex_code }}>
    {selected && <CheckOutlined className="drop-shadow" />}
  </button>
}

// Màu ứng viên được chọn (bấm để thêm/bỏ), màu mặc định, font, cỡ chữ, giãn dòng.
// Màu lưu ngay vào mẫu; font/cỡ chữ lưu vào bản nháp.
export default function StyleCard({ template, version, canManage, onSaveColors, onSaveStyle }) {
  const library = useQuery({ queryKey: ['admin-cv-library', 'colors'], queryFn: () => adminCvColors.list() })
  const chosenIds = template.colors.map((color) => color.public_id)
  const defaultId = template.colors.find((color) => color.is_default)?.public_id || chosenIds[0]
  const palette = (library.data || []).filter((color) => color.is_active || chosenIds.includes(color.public_id))
  const style = version?.default_style_json
  const editableStyle = canManage && Boolean(style)

  const toggle = (color) => {
    const chosen = chosenIds.includes(color.public_id)
    if (chosen && chosenIds.length === 1) return message.info('Mẫu cần ít nhất một màu.')
    if (!chosen && chosenIds.length >= MAX_COLORS) return message.info(`Tối đa ${MAX_COLORS} màu cho một mẫu.`)
    const colorIds = chosen ? chosenIds.filter((id) => id !== color.public_id) : [...chosenIds, color.public_id]
    return onSaveColors({ colorIds, defaultId: colorIds.includes(defaultId) ? defaultId : colorIds[0] })
  }

  return <AdminPanel title="Màu & chữ" description="Bấm vào màu để thêm hoặc bỏ khỏi bảng màu ứng viên được chọn.">
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">Bảng màu<span className="text-xs font-normal text-slate-500">{chosenIds.length}/{MAX_COLORS} màu</span></p>
        <div className="flex flex-wrap gap-2.5">{palette.map((color) => <Swatch key={color.public_id} color={color} selected={chosenIds.includes(color.public_id)} disabled={!canManage} label={`${chosenIds.includes(color.public_id) ? 'Bỏ' : 'Thêm'} màu ${color.name}`} onClick={() => toggle(color)} />)}</div>
        {library.data && palette.length === 0 && <p className="text-xs text-slate-500">Thư viện chưa có màu nào đang bật.</p>}
      </div>
      {template.colors.length > 1 && <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Màu mặc định</p>
        <div className="flex flex-wrap gap-2">{template.colors.map((color) => <button key={color.public_id} type="button" disabled={!canManage} aria-pressed={color.public_id === defaultId} onClick={() => color.public_id !== defaultId && onSaveColors({ colorIds: chosenIds, defaultId: color.public_id })}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed ${color.public_id === defaultId ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
          <span className="h-3 w-3 rounded-full border border-white/40" style={{ background: color.hex_code }} />{color.name}
        </button>)}</div>
      </div>}
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Font chữ
          <Select key={`font-${version?.id}`} className="mt-1 w-full" aria-label="Font chữ" disabled={!editableStyle} defaultValue={style?.font_family} onChange={(font_family) => onSaveStyle({ font_family })} options={CV_FONT_FAMILIES.map((font) => ({ value: font, label: <span style={{ fontFamily: font }}>{font}</span> }))} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">Cỡ chữ
          <Slider key={`scale-${version?.id}`} min={0.85} max={1.15} step={0.05} disabled={!editableStyle} defaultValue={style?.font_scale ?? 1} tooltip={{ formatter: (value) => `${Math.round(value * 100)}%` }} onChangeComplete={(font_scale) => onSaveStyle({ font_scale })} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">Giãn dòng
          <Slider key={`line-${version?.id}`} min={1.2} max={1.8} step={0.05} disabled={!editableStyle} defaultValue={style?.line_height ?? 1.4} onChangeComplete={(line_height) => onSaveStyle({ line_height })} />
        </label>
      </div>
    </div>
  </AdminPanel>
}
