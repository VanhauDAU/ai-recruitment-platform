export default function CvTemplatePreview({ template, compact = false }) {
  const color = template?.theme_color || '#00A66A'
  const name = template?.display_name || 'Mẫu CV'
  const imageUrl = template?.thumbnail_url || template?.preview_url

  if (imageUrl) {
    return (
      <div className="relative overflow-hidden rounded-lg bg-slate-100" style={{ aspectRatio: compact ? '3 / 4' : '3 / 4' }}>
        <img src={imageUrl} alt={`Xem trước ${name}`} className="h-full w-full object-cover object-top" />
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-100 bg-white p-3.5"
      style={{ aspectRatio: '3 / 4' }}
      aria-label={`Xem trước ${name}`}
    >
      <div className="h-2 w-2/5 rounded-full" style={{ backgroundColor: color }} />
      <div className="mt-4 flex gap-3">
        <div className="h-12 w-12 shrink-0 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-2.5 w-4/5 rounded bg-slate-800" />
          <div className="h-1.5 w-3/5 rounded bg-slate-300" />
          <div className="h-1.5 w-2/5 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-5 h-px" style={{ backgroundColor: `${color}55` }} />
      <div className="mt-3 space-y-2">
        <div className="h-2 w-2/5 rounded" style={{ backgroundColor: color }} />
        <div className="h-1.5 w-full rounded bg-slate-200" />
        <div className="h-1.5 w-11/12 rounded bg-slate-200" />
        <div className="h-1.5 w-4/5 rounded bg-slate-200" />
      </div>
      <div className="mt-4 grid grid-cols-[1.4fr_1fr] gap-3">
        <div className="space-y-2"><div className="h-1.5 w-full rounded bg-slate-100" /><div className="h-1.5 w-4/5 rounded bg-slate-100" /></div>
        <div className="rounded p-2" style={{ backgroundColor: `${color}13` }}><div className="h-1.5 w-full rounded bg-white" /><div className="mt-2 h-1.5 w-3/4 rounded bg-white" /></div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-1/3 rounded" style={{ backgroundColor: color }} />
        <div className="h-1.5 w-full rounded bg-slate-200" />
        <div className="h-1.5 w-10/12 rounded bg-slate-200" />
      </div>
      <div className="mt-auto space-y-2 pt-4">
        <div className="h-2 w-1/4 rounded" style={{ backgroundColor: color }} />
        <div className="flex gap-2">
          <div className="h-1.5 flex-1 rounded bg-slate-100" />
          <div className="h-1.5 flex-1 rounded bg-slate-100" />
          <div className="h-1.5 flex-1 rounded bg-slate-100" />
        </div>
        <div className="h-1.5 w-3/5 rounded bg-slate-100" />
      </div>
    </div>
  )
}
