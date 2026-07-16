import { BUILDER_TOOLS } from '../model/builder-tools'

export default function ToolSidebar({ activeTool, onChange, mobile = false }) {
  return <nav aria-label="Công cụ CV" className={mobile ? 'grid grid-cols-6 border-t border-slate-200 bg-white' : 'flex w-20 shrink-0 flex-col border-r border-slate-200 bg-white'}>{BUILDER_TOOLS.map((tool) => {
    const Icon = tool.icon
    const active = activeTool === tool.key
    return <button key={tool.key} type="button" aria-label={tool.label} aria-pressed={active} onClick={() => onChange(tool.key)} className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><Icon className="text-lg" /><span className="line-clamp-2">{tool.label}</span></button>
  })}</nav>
}
