import { getRendererContract } from '@/entities/cv'

const TONES = { plain: 'bg-slate-200', tint: 'bg-slate-300', band: 'bg-slate-500' }
const ACTIVE_TONES = { plain: 'bg-emerald-100', tint: 'bg-emerald-200', band: 'bg-emerald-500' }

// Sơ đồ nhỏ của một layout từ registry (hàng, độ rộng, tông màu vùng); chấm tròn
// ở vùng đầu tiên nghĩa là layout có ảnh đại diện.
export default function LayoutSchematic({ rendererKey, active = false, className = '' }) {
  const contract = getRendererContract(rendererKey)
  const rows = [...new Set(contract.regions.map((region) => region.row))].sort()
  const tones = active ? ACTIVE_TONES : TONES
  return <div aria-hidden="true" className={`flex aspect-[210/297] flex-col gap-1 rounded-md border border-slate-200 bg-white p-1.5 ${className}`}>
    {rows.map((row, index) => <div key={row} className={`flex gap-1 ${index === rows.length - 1 ? 'flex-1' : 'h-1/5'}`}>
      {contract.regions.filter((region) => region.row === row).map((region, regionIndex) => <div key={region.id} className={`relative rounded-sm ${tones[region.tone] || tones.plain}`} style={{ width: `${region.width}%` }}>
        {contract.avatar && index === 0 && regionIndex === 0 && <span className="absolute left-1 top-1 h-2.5 w-2.5 rounded-full bg-white/90 ring-1 ring-slate-300" />}
      </div>)}
    </div>)}
  </div>
}
