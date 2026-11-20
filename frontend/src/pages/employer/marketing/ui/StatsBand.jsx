import { useSiteSettings } from '@/entities/system/site-settings'
import { useCountUp } from '@/shared/hooks/use-count-up'
import { getIntlLocale, getLocale } from '@/shared/config/i18n'

function AnimatedStatValue({ value }) {
  const raw = String(value || '')
  const match = raw.includes('/') ? null : raw.match(/^([\d.,]+)(.*)$/)
  const target = match ? Number(match[1].replace(/\D/g, '')) : null
  const count = useCountUp(target, { duration: 1100 })
  if (target == null || !Number.isFinite(target)) return raw
  const formatted = new Intl.NumberFormat(getIntlLocale()).format(count)
  return `${formatted}${match[2]}`
}

// Khối số liệu cấu hình qua admin (key employer_stats):
// [{ value, label_vi, label_en }]
export default function StatsBand({ title }) {
  // Đọc thẳng: useSiteSetting chỉ trả chuỗi nên mảng sẽ bị thay bằng fallback.
  const stats = useSiteSettings().settings.employer_stats
  if (!Array.isArray(stats) || stats.length === 0) return null

  const lang = getLocale()

  return (
    <section className="bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {title && <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">{title}</h2>}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((item) => (
            <div key={`${item.value}-${item.label_vi}`} className="text-center">
              <div className="text-2xl font-extrabold text-[var(--brand-primary)] md:text-3xl"><AnimatedStatValue value={item.value} /></div>
              <div className="mt-2 text-xs leading-5 text-white/70 md:text-sm">
                {item[`label_${lang}`] || item.label_vi}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
