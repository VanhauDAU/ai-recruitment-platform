import { CalendarOutlined, CheckOutlined, DownOutlined, FileTextOutlined, InfoCircleOutlined, LeftOutlined, MessageOutlined, RightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Empty, Skeleton, Tooltip } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CANDIDATE_APPLICATION_FILTERS, applicationKeys, getCandidateApplications } from '@/entities/application'
import { CandidateApplicationActions } from '@/features/manage-candidate-application'
import { MASCOT_SCENES, MascotEmpty } from '@/shared/ui/mascot'
import {
  APPLICATION_STAGES,
  buildApplicationTimeline,
  formatAppliedJobTime,
  getApplicationHeadline,
  getCompletedStageCount,
} from './model/applied-job-presentation'
import './applied-jobs.css'

const FILTERS = [['all', 'Tất cả'], ...CANDIDATE_APPLICATION_FILTERS]

function RemindBanner() {
  return (
    <div className="applied-jobs__banner">
      <p className="applied-jobs__banner-text">
        Bạn có thể nhấn nút <strong>&quot;Nhắc NTD&quot;</strong> nếu đã quá <strong>3 ngày</strong> từ lúc ứng tuyển mà vẫn
        chưa được NTD phản hồi. ProCV sẽ thay bạn gửi một lời nhắn chuyên nghiệp tới NTD.
      </p>
      <img src={MASCOT_SCENES.cvHelper} alt="" loading="lazy" />
    </div>
  )
}

function StatusFilters({ value, onChange }) {
  const trackRef = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setEdges({
      start: track.scrollLeft <= 1,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const scroll = (direction) => trackRef.current?.scrollBy({ left: direction * 200, behavior: 'smooth' })

  return (
    <div className="applied-jobs__filters">
      {!edges.start && (
        <button type="button" aria-label="Bộ lọc trước" onClick={() => scroll(-1)} className="applied-jobs__filter-arrow">
          <LeftOutlined />
        </button>
      )}
      <div
        ref={trackRef}
        onScroll={measure}
        className="applied-jobs__filter-track"
        role="tablist"
        aria-label="Lọc theo trạng thái hồ sơ"
      >
        {FILTERS.map(([status, label]) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={value === status}
            onClick={(event) => {
              onChange(status)
              event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
            }}
            className="applied-jobs__filter"
          >
            {label}
          </button>
        ))}
      </div>
      {!edges.end && (
        <button type="button" aria-label="Bộ lọc tiếp theo" onClick={() => scroll(1)} className="applied-jobs__filter-arrow">
          <RightOutlined />
        </button>
      )}
    </div>
  )
}

function ApplicationProgress({ application }) {
  const completed = getCompletedStageCount(application)
  return (
    <ol className="applied-job__steps" aria-label="Các bước xử lý hồ sơ">
      {APPLICATION_STAGES.map((stage, index) => {
        const done = index < completed
        return (
          <li key={stage.label} className={`applied-job__step${done ? ' applied-job__step--done' : ''}`} style={{ '--step': index }}>
            <span className="applied-job__dot">{done && <CheckOutlined />}</span>
            <span className="applied-job__step-label">
              {stage.label}
              {stage.hint && (
                <Tooltip title={stage.hint}>
                  <InfoCircleOutlined aria-label={stage.hint} />
                </Tooltip>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ApplicationCard({ application, expanded, onToggle }) {
  const headline = getApplicationHeadline(application)
  const timeline = buildApplicationTimeline(application)

  return (
    <article className="applied-job">
      <div className="applied-job__head">
        {application.company_logo_url
          ? <img src={application.company_logo_url} alt="" className="applied-job__logo" loading="lazy" />
          : <span className="applied-job__logo">{(application.company_name || '?').charAt(0).toUpperCase()}</span>}
        <div className="applied-job__info">
          {application.job_slug
            ? <Link to={`/viec-lam/${application.job_slug}`} className="applied-job__title">{application.job_title}</Link>
            : <span className="applied-job__title">{application.job_title}</span>}
          <p className="applied-job__company">{application.company_name}</p>
          <p className="applied-job__meta">
            <span><CalendarOutlined /> Ứng tuyển: {formatAppliedJobTime(application.applied_at)}</span>
            <span>
              <FileTextOutlined />{' '}
              {application.cv_public_id
                ? <Link to={`/cvs/${application.cv_public_id}/view`}>{application.submitted_cv_title}</Link>
                : application.submitted_cv_title}
            </span>
          </p>
        </div>
      </div>

      <div className="applied-job__status">
        <p className={`applied-job__headline applied-job__headline--${headline.tone}`}>
          {headline.text}
          {headline.time && <time> ({headline.time})</time>}
        </p>
        <div className="applied-job__actions">
          <CandidateApplicationActions application={application} />
          <Tooltip title="Nhắn tin với nhà tuyển dụng sẽ được mở trong giai đoạn tiếp theo">
            <span aria-disabled="true" className="applied-job__message"><MessageOutlined /> Nhắn tin</span>
          </Tooltip>
        </div>
      </div>

      <ApplicationProgress application={application} />

      {timeline.length > 0 && (
        <div className="applied-job__details">
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="applied-job__details-toggle">
            Chi tiết tiến trình ứng tuyển
            <DownOutlined />
          </button>
          {expanded && (
            <ol className="applied-job__timeline">
              {timeline.map((item, index) => (
                <li key={`${item.status}-${item.occurred_at}`} className="applied-job__event">
                  {index === 0 && <span className="applied-job__latest">Mới nhất</span>}
                  <span className="applied-job__event-label">{item.label}</span>
                  <time>{formatAppliedJobTime(item.occurred_at, 'DD-MM-YYYY HH:mm:ss')}</time>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  )
}

export default function AppliedJobs() {
  const applicationsQuery = useQuery({ queryKey: applicationKeys.candidateList, queryFn: getCandidateApplications })
  const [statusFilter, setStatusFilter] = useState('all')
  // Chỉ tin đầu tiên mở sẵn; các tin sau đóng cho tới khi người dùng bấm mở.
  const [toggledIds, setToggledIds] = useState(() => new Set())

  if (applicationsQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />

  // Earlier submissions replaced by a resubmission are history, not listed.
  const applications = (applicationsQuery.data || []).filter((item) => item.is_current !== false)
  const visible = statusFilter === 'all'
    ? applications
    : applications.filter((item) => item.status === statusFilter)

  function toggle(publicId) {
    const next = new Set(toggledIds)
    if (next.has(publicId)) next.delete(publicId)
    else next.add(publicId)
    setToggledIds(next)
  }

  return (
    <section className="applied-jobs">
      <h1 className="applied-jobs__title">Việc làm đã ứng tuyển</h1>

      {!applications.length ? (
        <MascotEmpty className="py-6" scene="cvHelper" description="Bạn chưa ứng tuyển việc làm nào" />
      ) : (
        <>
          <RemindBanner />
          <StatusFilters value={statusFilter} onChange={setStatusFilter} />
          <div className="applied-jobs__list">
            {visible.map((application, index) => (
              <ApplicationCard
                key={application.public_id}
                application={application}
                expanded={(index === 0) !== toggledIds.has(application.public_id)}
                onToggle={() => toggle(application.public_id)}
              />
            ))}
            {!visible.length && <Empty description="Không có hồ sơ nào ở trạng thái này" />}
          </div>
        </>
      )}
    </section>
  )
}
