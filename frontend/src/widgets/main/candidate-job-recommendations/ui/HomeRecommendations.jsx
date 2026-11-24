import { ArrowRightOutlined, SettingOutlined } from '@ant-design/icons'
import { Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { m } from '@/shared/config/i18n'
import ArrowButton from '@/shared/ui/ArrowButton'
import { ProcvMascot } from '@/shared/ui/mascot'
import { groupRecommendationJobs } from '../model/recommendation-reasons'
import { MATCHING_PATH } from '../model/use-home-recommendation-summary'
import CandidateRecommendationCard from './CandidateRecommendationCard'
import './home-recommendations.css'

const HOME_ROTATE_MS = 8000
const SETTINGS_PATH = '/tai-khoan/cai-dat-goi-y-viec-lam'
const TITLE_ID = 'candidate-recommendations-title'

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M8 0c.5 3.9 2.1 5.5 6 6-3.9.5-5.5 2.1-6 6-.5-3.9-2.1-5.5-6-6 3.9-.5 5.5-2.1 6-6Zm5.5 10c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" />
    </svg>
  )
}

// Khung chung cho lúc tải và lúc có dữ liệu để khối không nhảy bố cục.
function Shell({ children, intro, ...props }) {
  return (
    <section aria-labelledby={TITLE_ID} className="max-w-6xl mx-auto px-4 pt-8" {...props}>
      <div className="reco-home">
        {intro}
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  )
}

function Intro({ total }) {
  const wide = useMediaQuery('(min-width: 1024px)')
  return (
    <div className="reco-home__intro">
      <div className="reco-home__mascot">
        <ProcvMascot pose="checklist" emotion="happy" blink float shadow="floating" size={wide ? 104 : 60} />
        {total > 0 && (
          <p className="reco-home__bubble">
            <strong>{total}</strong> {m.candidate_reco_home_bubble()}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <p className="reco-home__eyebrow">
          <SparkleIcon />
          {m.candidate_reco_home_eyebrow()}
        </p>
        <h2 id={TITLE_ID} className="reco-home__title">{m.candidate_reco_home_title()}</h2>
        <p className="reco-home__lead">{m.candidate_reco_home_intro()}</p>
        <div className="reco-home__links">
          <Link to={MATCHING_PATH} className="reco-home__see-all">
            {m.candidate_best_jobs_see_all()} <ArrowRightOutlined />
          </Link>
          <Link to={SETTINGS_PATH} className="reco-home__settings">
            <SettingOutlined /> {m.candidate_reco_home_customize()}
          </Link>
        </div>
      </div>
    </div>
  )
}

function HomeLoading() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label={m.candidate_reco_home_loading()}>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl border border-slate-200 bg-white p-3">
          <Skeleton active avatar paragraph={{ rows: 2 }} />
        </div>
      ))}
    </div>
  )
}

export default function HomeRecommendations({ data, hiddenIds, hide, pendingIds, query }) {
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const groups = useMemo(
    () => groupRecommendationJobs((data?.results || []).filter((job) => !hiddenIds.has(job.public_id))),
    [data?.results, hiddenIds],
  )

  useEffect(() => {
    if (page < groups.length) return
    setPage(Math.max(0, groups.length - 1))
  }, [groups.length, page])

  if (query.isPending) return <Shell intro={<Intro total={0} />}><HomeLoading /></Shell>
  // Trang chủ chỉ hiện gợi ý thật: ứng viên tắt gợi ý bằng AI thì ẩn khối này.
  if (query.isError || data?.status !== 'ready' || data.ai_recommendation_enabled === false || groups.length === 0) return null

  const total = data.pagination?.total ?? groups.flat().length
  const last = groups.length - 1

  return (
    <Shell
      intro={<Intro total={total} />}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <div className="overflow-hidden py-1">
        <div className="reco-home__track" style={{ transform: `translateX(-${page * 100}%)` }}>
          {groups.map((group, groupIndex) => (
            <div key={group.map((job) => job.public_id).join(':')} className="min-w-full" inert={groupIndex !== page}>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {group.map((job) => (
                  <CandidateRecommendationCard
                    key={job.public_id}
                    job={job}
                    hidePending={pendingIds.has(job.public_id)}
                    onHide={(selected) => hide(selected, 'homepage')}
                  />
                ))}
              </div>
              <span className="sr-only">{m.candidate_reco_home_page_of({ page: groupIndex + 1, total: groups.length })}</span>
            </div>
          ))}
        </div>
      </div>

      {groups.length > 1 && (
        <div className="reco-home__footer" data-paused={paused} style={{ '--rh-rotate': `${HOME_ROTATE_MS}ms` }}>
          <div className="flex items-center gap-1.5" aria-label={m.candidate_reco_home_pages()}>
            {groups.map((group, index) => (
              <button
                key={group[0].public_id}
                type="button"
                aria-label={m.candidate_reco_home_page({ page: index + 1 })}
                aria-current={page === index ? 'true' : undefined}
                onClick={() => setPage(index)}
                className="reco-home__dot"
              >
                {/* Thanh chạy hết thì sang trang kế; giảm chuyển động thì không có animation nên không tự chuyển. */}
                {page === index && (
                  <span className="reco-home__dot-fill" onAnimationEnd={() => setPage((page + 1) % groups.length)} />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ArrowButton dir="left" aria-label={m.candidate_reco_home_prev()} disabled={page === 0} onClick={() => setPage(page - 1)} />
            <ArrowButton dir="right" aria-label={m.candidate_reco_home_next()} disabled={page === last} onClick={() => setPage(page + 1)} />
          </div>
        </div>
      )}
    </Shell>
  )
}
