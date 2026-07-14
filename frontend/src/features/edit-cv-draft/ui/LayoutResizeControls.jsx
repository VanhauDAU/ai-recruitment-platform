export default function LayoutResizeControls({ regions, capabilities, onResize }) {
  if (!capabilities.columnResize || regions.length < 2) return null
  return (
    <section aria-labelledby="layout-resize-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="layout-resize-title" className="text-lg font-bold text-slate-900">Tỷ lệ cột</h2>
      <p className="mt-1 text-sm text-slate-500">Dùng thanh trượt hoặc phím mũi tên; chỉ layout thay đổi.</p>
      <div className="mt-4 space-y-3">
        {regions.slice(0, -1).map((region, index) => {
          const adjacent = regions[index + 1]
          const total = region.width_percent + adjacent.width_percent
          const min = Math.max(capabilities.minColumnPercent, total - capabilities.maxColumnPercent)
          const max = Math.min(capabilities.maxColumnPercent, total - capabilities.minColumnPercent)
          return <label key={region.id} className="block"><span className="mb-1 flex justify-between text-sm font-medium text-slate-700"><span>{region.id} / {adjacent.id}</span><span>{region.width_percent}% / {adjacent.width_percent}%</span></span><input aria-label={`Tỷ lệ ${region.id}`} type="range" min={min} max={max} step="1" value={region.width_percent} onChange={(event) => onResize(region.id, Number(event.target.value))} className="w-full accent-[var(--brand-primary)]" /></label>
        })}
      </div>
    </section>
  )
}
