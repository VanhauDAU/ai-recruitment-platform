import {
  EnvironmentOutlined,
  FileImageOutlined,
  FileTextOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Fragment } from 'react'
import { Link } from 'react-router'
import { jobDetailPath } from '@/entities/job/job'
import { interviewModeLabel, interviewStatusTag } from '@/entities/messaging/conversation'
import { m } from '@/shared/config/i18n'
import { employerAppPath } from '@/shared/config/portals'
import { linkifyParts } from '@/shared/lib/linkify'
import { Button, StatusText } from '@/shared/ui/connect-kit'
import { interviewDateParts, interviewTimeRange } from '../lib/interview-date'
import { downloadMessageFile, useMessageImageUrl } from '../model/use-message-file'

const MODE_ICONS = { onsite: EnvironmentOutlined, online: VideoCameraOutlined, phone: PhoneOutlined }

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ExternalLink({ href, children }) {
  return <a href={href} target="_blank" rel="noopener nofollow" className="pc-link">{children}</a>
}

// Các đoạn của một chuỗi bất biến: chỉ số là key ổn định.
export function MessageText({ text }) {
  return linkifyParts(text).map((part, index) => (
    part.type === 'link'
      ? <ExternalLink key={index} href={part.href}>{part.value}</ExternalLink>
      : <Fragment key={index}>{part.value}</Fragment>
  ))
}

function JobCard({ portal, job }) {
  const to = portal === 'employer' ? employerAppPath(`/jobs/${job.public_id}`) : jobDetailPath(job)
  return (
    <Link to={to} className="pc-card pc-card--link">
      <span className="pc-card__title">{job.title}</span>
      {job.company_name && <span className="pc-card__text">{job.company_name}</span>}
      {job.salary_text && <span className="pc-card__text">{job.salary_text}</span>}
      {job.location_text && <span className="pc-card__text">{job.location_text}</span>}
      {job.stopped && <span className="pc-card__meta">{m.connect_card_job_stopped()}</span>}
    </Link>
  )
}

function DocumentCard({ icon, title, meta, action }) {
  return (
    <div className="pc-card pc-card--doc">
      <span className="pc-card__glyph" aria-hidden>{icon}</span>
      <span className="pc-card__main">
        <span className="pc-card__title">{title}</span>
        {meta && <span className="pc-card__meta">{meta}</span>}
        {action}
      </span>
    </div>
  )
}

function CvCard({ portal, conversationId, message, renderCvActions }) {
  const { cv } = message
  const delivered = Boolean(message.public_id)
  const action = delivered && cv.has_file
    ? <Button variant="accent" className="pc-card__action" onClick={() => downloadMessageFile(portal, conversationId, message, `${cv.title}.pdf`)}>{m.connect_card_cv_open()}</Button>
    : delivered ? renderCvActions?.(message) : null
  return (
    <DocumentCard
      icon={<FileTextOutlined />}
      title={cv.title}
      meta={cv.cv_type === 'builder' ? m.connect_card_cv_builder() : m.connect_card_cv_uploaded()}
      action={action}
    />
  )
}

function FileCard({ portal, conversationId, message }) {
  const { file } = message
  return (
    <DocumentCard
      icon={<PaperClipOutlined />}
      title={file.name}
      meta={formatSize(file.size)}
      action={message.public_id && (
        <Button
          variant="accent"
          className="pc-card__action"
          aria-label={m.connect_card_file_download({ name: file.name })}
          onClick={() => downloadMessageFile(portal, conversationId, message, file.name)}
        >
          {m.connect_card_download()}
        </Button>
      )}
    />
  )
}

function ImageMessage({ portal, conversationId, message, onLoad }) {
  const { url, failed } = useMessageImageUrl(portal, conversationId, message)
  if (failed) return <DocumentCard icon={<FileImageOutlined />} title={m.connect_card_image_failed()} />
  if (!url) return <span className="pc-image pc-image--loading" aria-hidden />
  return (
    <a href={url} target="_blank" rel="noopener" className="pc-image">
      <img src={url} alt={message.file?.name || m.connect_preview_image()} onLoad={onLoad} />
    </a>
  )
}

/** Interview as a calendar stub: date on the left, time/place/status on the right. */
function InterviewCard({ message, renderInterviewActions }) {
  const { interview } = message
  const date = interviewDateParts(interview.starts_at)
  const status = interviewStatusTag(interview.status)
  const ModeIcon = MODE_ICONS[interview.mode] || EnvironmentOutlined
  return (
    <div className="pc-stub">
      <div className="pc-stub__zones">
        <div className="pc-stub__date" aria-hidden>
          <span className="pc-stub__weekday">{date.weekday}</span>
          <span className="pc-stub__day">{date.day}</span>
          <span className="pc-stub__month">{date.month}</span>
        </div>
        <div className="pc-stub__info">
          <span className="pc-stub__time">{interviewTimeRange(interview.starts_at, interview.duration_minutes)}</span>
          <span className="pc-stub__line"><ModeIcon aria-hidden /> {interviewModeLabel(interview.mode)}</span>
          {interview.location && <span className="pc-stub__line"><EnvironmentOutlined aria-hidden /> {interview.location}</span>}
          {interview.meeting_url && (
            <span className="pc-stub__line"><LinkOutlined aria-hidden /> <ExternalLink href={interview.meeting_url}>{interview.meeting_url}</ExternalLink></span>
          )}
          {interview.note && <span className="pc-stub__note">{interview.note}</span>}
          {interview.candidate_note && (
            <span className="pc-stub__note">{m.connect_interview_candidate_note({ note: interview.candidate_note })}</span>
          )}
          <StatusText tone={status.tone}>{status.label}</StatusText>
        </div>
      </div>
      {renderInterviewActions?.(message)}
    </div>
  )
}

export const CARD_KINDS = new Set(['job', 'cv', 'file', 'image', 'interview'])

/** Body of one message by `kind`; text is plain (links become anchors, never HTML). */
export default function MessageContent({ portal, conversationId, message, renderCvActions, renderInterviewActions, onMediaLoad }) {
  if (message.kind === 'job' && message.job) return <JobCard portal={portal} job={message.job} />
  if (message.kind === 'cv' && message.cv) {
    return <CvCard portal={portal} conversationId={conversationId} message={message} renderCvActions={renderCvActions} />
  }
  if (message.kind === 'file' && message.file) return <FileCard portal={portal} conversationId={conversationId} message={message} />
  if (message.kind === 'image') {
    return <ImageMessage portal={portal} conversationId={conversationId} message={message} onLoad={onMediaLoad} />
  }
  if (message.kind === 'interview' && message.interview) {
    return <InterviewCard message={message} renderInterviewActions={renderInterviewActions} />
  }
  return <MessageText text={message.body || ''} />
}
