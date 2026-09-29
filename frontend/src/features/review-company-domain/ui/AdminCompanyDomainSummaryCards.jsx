const CARDS = [
  {
    key: 'manual_pending',
    label: 'Chờ duyệt thủ công',
    tone: 'amber',
    filter: { status: 'pending', method: 'admin_manual' },
  },
  {
    key: 'dns_pending',
    label: 'Chờ kiểm tra DNS',
    tone: 'blue',
    filter: { status: 'pending', method: 'dns_txt' },
  },
  {
    key: 'verified',
    label: 'Đã xác minh',
    tone: 'emerald',
    filter: { status: 'verified', method: '' },
  },
  { key: 'needs_attention', label: 'Cần chú ý', tone: 'rose' },
]

const TONE_CLASSES = {
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  blue: 'border-sky-200 bg-sky-50 text-sky-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
}

export default function AdminCompanyDomainSummaryCards({ summary, onFilter }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const content = (
          <>
            <span className="block text-2xl font-black">
              {Number(summary?.[card.key] || 0).toLocaleString('vi-VN')}
            </span>
            <span className="mt-1 block text-xs font-bold uppercase tracking-wide">{card.label}</span>
          </>
        )
        const className = `rounded-xl border p-4 text-left ${TONE_CLASSES[card.tone]}`

        return card.filter ? (
          <button
            key={card.key}
            type="button"
            onClick={() => onFilter(card.filter)}
            className={`${className} transition hover:-translate-y-0.5 hover:shadow-sm`}
          >
            {content}
          </button>
        ) : <div key={card.key} className={className}>{content}</div>
      })}
    </div>
  )
}
