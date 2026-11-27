import {
  ArrowRightOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { COMPANY_DIRECTORY_PATH, companyDetailPath } from '@/entities/company/company'
import { formatNumber } from '@/entities/job/job'
import { m } from '@/shared/config/i18n'
import ArrowButton from '@/shared/ui/ArrowButton'
import { logoUrlFor } from '../lib/logo-url'
import { chunkItems, usePagedDrag } from '../model/use-paged-drag'
import EmployerLogoBelt from './EmployerLogoBelt'
import { PagedTrack } from './PagedCarousel'
import './home-showcase.css'

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
      iconClassName: 'bg-[var(--brand-primary)]',
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
      className="relative overflow-hidden rounded-2xl border border-[var(--brand-primary)]/20 bg-gradient-to-r from-[var(--brand-primary-soft)] via-white to-[var(--brand-primary-soft)] px-5 py-6 shadow-[0_8px_24px_color-mix(in_srgb,var(--brand-primary)_9%,transparent)] lg:grid lg:grid-cols-[minmax(300px,1fr)_minmax(0,1.7fr)] lg:items-center lg:px-10"
    >
      <span className="pointer-events-none absolute -right-12 -top-20 h-44 w-44 rounded-full bg-[var(--brand-primary)] opacity-[0.06]" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-20 w-40 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--brand-primary)_15%,transparent)_1px,transparent_0)] bg-[length:18px_18px] opacity-50" aria-hidden="true" />

      <div className="relative text-center lg:text-left">
        <span className="inline-flex rounded-full bg-[var(--brand-primary-soft)] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary-hover)]">
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

      {/* Điện thoại: ba cột icon / số / nhãn; từ sm: icon cạnh số (home-showcase.css). */}
      <div data-reveal-stagger className="platform-stats relative">
        {items.map((item) => (
          <div key={item.key} className="platform-stats__item">
            <span className={`platform-stats__icon ${item.iconClassName}`} aria-hidden="true">
              {item.icon}
            </span>
            <span className="platform-stats__text">
              <strong className="platform-stats__value">{formatNumber(item.value)}</strong>
              <span className="platform-stats__label">{item.label}</span>
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

      <section
        aria-labelledby="featured-employers-title"
        className="home-showcase mt-8"
      >
        <div className="home-showcase__header">
          <div className="min-w-0">
            <h2 id="featured-employers-title" className="home-showcase__title">Công ty nổi bật</h2>
            <p className="home-showcase__subtitle">Khám phá doanh nghiệp đang có nhiều cơ hội tuyển dụng</p>
          </div>
          <div className="home-showcase__actions">
            <Link to={COMPANY_DIRECTORY_PATH} className="home-showcase__more" aria-label={m.candidate_home_employers_view_all()}>
              Xem tất cả <ArrowRightOutlined aria-hidden="true" />
            </Link>
            <ArrowButton
              dir="left"
              disabled={!carousel.canPrev}
              onClick={carousel.goPrev}
              aria-label="Nhóm công ty trước"
              className="home-showcase__nav"
            />
            <ArrowButton
              dir="right"
              disabled={!carousel.canNext}
              onClick={carousel.goNext}
              aria-label="Nhóm công ty tiếp theo"
              className="home-showcase__nav"
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
              <div data-reveal-stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {group.map((employer) => (
                  <button
                    key={employer.public_id}
                    type="button"
                    onClick={() => navigate(companyDetailPath(employer))}
                    className="featured-employer-card home-showcase__card featured-employers__card"
                  >
                    <span className="featured-employers__logo">
                      <img src={logoUrlFor(employer)} alt="" loading="lazy" draggable={false} />
                    </span>
                    <span className="home-showcase__name" title={employer.company_name}>
                      {employer.company_name}
                    </span>
                    <span className="featured-employers__industry">{industryLabel(employer)}</span>
                    <span className="home-showcase__count">
                      {formatNumber(employer.active_public_job_count)} việc làm
                    </span>
                  </button>
                ))}
              </div>
            )}
          </PagedTrack>
        </div>

        {groups.length > 1 && (
          <div className="home-showcase__dots" role="status" aria-label={`Trang ${carousel.page + 1} trên ${groups.length}`}>
            {groups.map((_, index) => (
              <span
                key={index}
                className={`home-showcase__dot${index === carousel.page ? ' is-active' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </section>

      <EmployerLogoBelt employers={employers} navigate={navigate} />
    </div>
  )
}
