import { BUILDER_TOOLS } from '../model/builder-tools'

export default function ToolSidebar({ activeTool, onChange, mobile = false }) {
  return <nav aria-label="Công cụ CV" style={mobile ? { gridTemplateColumns: `repeat(${BUILDER_TOOLS.length}, minmax(0, 1fr))` } : undefined} className={mobile ? 'grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]' : 'mt-4 flex w-44 shrink-0 self-start flex-col overflow-hidden rounded-r-xl border-y border-r border-slate-200 bg-white py-2 shadow-sm'}>{BUILDER_TOOLS.map((tool) => {
    const Icon = tool.icon
    const active = activeTool === tool.key
    const layout = mobile
      ? 'min-h-14 flex-col justify-center gap-0.5 px-0.5 text-[10px] leading-tight'
      : 'min-h-[58px] flex-row justify-start gap-3 border-l-[3px] px-4 text-sm'
    const state = active
      ? `bg-emerald-50 text-emerald-700 ${mobile ? '' : 'border-l-emerald-500'}`
      : `text-slate-600 hover:bg-slate-50 ${mobile ? '' : 'border-l-transparent'}`
    return <button key={tool.key} type="button" aria-label={tool.label} aria-pressed={active} onClick={() => onChange(tool.key)} className={`flex cursor-pointer items-center font-semibold transition ${layout} ${state}`}><Icon className="shrink-0 text-lg" /><span className={mobile ? 'line-clamp-2' : 'whitespace-nowrap'}>{tool.label}</span></button>
  })}</nav>
}
