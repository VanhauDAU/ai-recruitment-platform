import { CheckCircleFilled, DownOutlined } from '@ant-design/icons'

export default function JobFormSection({ id, number, title, progress, invalid, open, active, onToggle, children }) {
  const complete = progress?.total > 0 && progress.completed === progress.total
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition sm:px-4 ${invalid && active ? 'bg-red-600 text-white' : invalid ? 'border-b border-red-100 bg-white text-red-600 hover:bg-red-50/40' : active ? 'bg-[var(--brand-primary)] text-white' : 'border-b border-slate-100 bg-white text-slate-900 hover:bg-slate-50'}`}
      >
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${invalid && active ? 'bg-white text-red-600' : active ? 'bg-white text-[var(--brand-primary)]' : complete ? 'bg-[var(--brand-primary)] text-white' : 'bg-slate-200 text-slate-600'}`}>
          {complete ? <CheckCircleFilled /> : number}
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold">{title}</h2>
        </span>
        {progress?.total > 0 && <span className={`shrink-0 text-xs font-bold ${invalid && active ? 'text-white' : invalid ? 'text-red-600' : active ? 'text-white' : complete ? 'text-[var(--brand-primary)]' : 'text-slate-400'}`}>{progress.completed}/{progress.total}</span>}
        <DownOutlined className={`text-xs transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-7">{children}</div>
        </div>
      </div>
    </section>
  )
}
