import { SolutionOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { COMPANY_DIRECTORY_PATH } from '@/entities/company'
import { formatNumber } from '@/entities/job'
import ArrowButton from '@/shared/ui/ArrowButton'
import { logoUrlFor } from '../lib/logo-url'
import { chunkItems, usePagedDrag } from '../model/use-paged-drag'
import EmployerLogoBelt from './EmployerLogoBelt'
import { PagedTrack } from './PagedCarousel'

const EMPLOYERS_PER_PAGE = 6

function industryLabel(company) {
  const names = (company.industries_detail || [])
    .map((industry) => industry?.name?.trim())
    .filter(Boolean)
  return names.join(', ') || 'Đang tuyển dụng'
}

function PlatformStatistics({ stats }) {
  const items = [
    {
      key: 'candidates',
      label: 'Ứng viên',
      value: stats?.candidates,
      icon: <UserOutlined />,
      iconClassName: 'bg-[var(--brand-primary)]',
    },
    {
      key: 'jobs',
      label: 'Việc làm',
      value: stats?.active_jobs,
      icon: <SolutionOutlined />,
      iconClassName: 'bg-emerald-600',
    },
    {
      key: 'employers',
      label: 'Nhà tuyển dụng',
      value: stats?.employers,
      icon: <TeamOutlined />,
      iconClassName: 'bg-teal-600',
    },
  ]

  return (
    <section
      aria-labelledby="platform-statistics-title"
      className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/70 px-5 py-6 shadow-[0_8px_24px_rgba(0,177,79,0.09)] lg:grid lg:grid-cols-[minmax(300px,1fr)_minmax(0,1.7fr)] lg:items-center lg:px-10"
    >
      <span className="pointer-events-none absolute -right-12 -top-20 h-44 w-44 rounded-full bg-[var(--brand-primary)] opacity-[0.06]" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-20 w-40 bg-[radial-gradient(circle_at_1px_1px,rgba(0,177,79,0.15)_1px,transparent_0)] bg-[length:18px_18px] opacity-50" aria-hidden="true" />

      <div className="relative text-center lg:text-left">
        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
          Hệ sinh thái tuyển dụng
        </span>
        <h2
          id="platform-statistics-title"
          className="mt-2 text-xl font-extrabold text-slate-800 sm:text-2xl"
        >
          Website của chúng tôi có
        </h2>
        <p className="mt-1 text-sm text-slate-500">Những kết nối đang hoạt động trên toàn nền tảng</p>
      </div>

      <div className="relative mt-5 grid divide-y divide-emerald-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:mt-0">
        {items.map((item) => (
          <div key={item.key} className="flex min-w-0 items-center justify-center gap-3 py-3 sm:px-4 sm:py-0">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-white shadow-sm ${item.iconClassName}`}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span className="min-w-0 text-left">
              <strong className="block text-xl font-extrabold leading-tight tabular-nums text-slate-800">
                {formatNumber(item.value)}
              </strong>
              <span className="mt-0.5 block text-sm text-slate-600">{item.label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function FeaturedEmployers({ employers, navigate, stats }) {
  const groups = useMemo(() => chunkItems(employers, EMPLOYERS_PER_PAGE), [employers])
  const carousel = usePagedDrag(groups.length)

  if (employers.length === 0) return null

  return (
    <div className="mt-8" data-testid="featured-employers-block">
      <PlatformStatistics stats={stats} />

      <section aria-labelledby="featured-employers-title" className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-5 sm:px-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 id="featured-employers-title" className="text-xl font-extrabold text-[var(--brand-primary-hover)]">
              Công ty nổi bật
            </h2>
            <p className="mt-1 hidden text-sm text-slate-500 sm:block">Khám phá doanh nghiệp đang có nhiều cơ hội tuyển dụng</p>
          </div>
          <div className="flex items-center gap-3">
            <ArrowButton
              dir="left"
              disabled={!carousel.canPrev}
              onClick={carousel.goPrev}
              aria-label="Nhóm công ty trước"
              className="!h-9 !w-9 enabled:!border-emerald-200 enabled:!bg-white enabled:!text-emerald-600 enabled:hover:!border-[var(--brand-primary)] enabled:hover:!bg-[var(--brand-primary)] enabled:hover:!text-white enabled:hover:!shadow-sm"
            />
            <ArrowButton
              dir="right"
              disabled={!carousel.canNext}
              onClick={carousel.goNext}
              aria-label="Nhóm công ty tiếp theo"
              className="!h-9 !w-9 enabled:!border-emerald-200 enabled:!bg-white enabled:!text-emerald-600 enabled:hover:!border-[var(--brand-primary)] enabled:hover:!bg-[var(--brand-primary)] enabled:hover:!text-white enabled:hover:!shadow-sm"
            />
          </div>
        </div>

        <div
          className="cursor-grab select-none active:cursor-grabbing"
          {...carousel.dragHandlers}
        >
          <PagedTrack
            groups={groups}
            page={carousel.page}
            dragOffset={carousel.dragOffset}
            isDragging={carousel.isDragging}
          >
            {(group) => (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {group.map((employer) => (
                  <button
                    key={employer.public_id}
                    type="button"
                    onClick={() => navigate(`/viec-lam?search=${encodeURIComponent(employer.company_name)}&search_by=company`)}
                    className="featured-employer-card group flex min-h-[220px] min-w-0 cursor-pointer flex-col items-center rounded-xl border border-emerald-100 bg-white px-3 py-3 text-center transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:shadow-[0_8px_24px_rgba(0,177,79,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
                  >
                    <span className="flex h-[92px] w-full max-w-[120px] items-center justify-center overflow-hidden">
                      <img
                        src={logoUrlFor(employer)}
                        alt=""
                        className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                        draggable={false}
                      />
                    </span>
                    <span className="mt-3 line-clamp-2 min-h-10 w-full text-sm font-bold leading-5 text-slate-800" title={employer.company_name}>
                      {employer.company_name}
                    </span>
                    <span className="mt-1 line-clamp-1 min-h-4 w-full text-xs text-slate-500">
                      {industryLabel(employer)}
                    </span>
                    <span className="mt-2 inline-flex min-h-8 items-center rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold leading-none text-emerald-700">
                      {formatNumber(employer.active_public_job_count)} Việc làm
                    </span>
                  </button>
                ))}
              </div>
            )}
          </PagedTrack>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span aria-hidden="true" />
          <div className="flex items-center justify-center gap-3" role="status" aria-label={`Trang ${carousel.page + 1} trên ${groups.length}`}>
            {groups.map((_, index) => (
              <span
                key={index}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${index === carousel.page ? 'bg-[var(--brand-primary)]' : 'bg-emerald-200'}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <Link
            to={COMPANY_DIRECTORY_PATH}
            className="justify-self-end cursor-pointer text-sm font-semibold text-[var(--brand-primary)] transition hover:text-[var(--brand-primary-hover)] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
          >
            Xem tất cả
          </Link>
        </div>
      </section>

      <EmployerLogoBelt employers={employers} navigate={navigate} />
    </div>
  )
}
