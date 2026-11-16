import dayjs from 'dayjs'
import { CANDIDATE_APPLICATION_STATUS_LABELS } from '@/entities/application'

export const APPLICATION_STAGES = [
  { label: 'UV nộp CV' },
  { label: 'Tiếp nhận CV' },
  { label: 'NTD xem CV', hint: 'Bộ phận tuyển dụng xem và đánh giá hồ sơ' },
  { label: 'Xử lý CV', hint: 'Phòng ban chuyên môn đánh giá, cân nhắc hồ sơ' },
  { label: 'NTD phản hồi' },
]

// How many stages each status completes; a decision or an interview invite is the answer.
const STAGES_REACHED = { submitted: 2, viewed: 3, shortlisted: 4, interviewed: 5, accepted: 5, rejected: 5 }
const MUTED_STATUSES = new Set(['rejected', 'withdrawn'])

export function formatAppliedJobTime(value, pattern = 'DD-MM-YYYY HH:mm') {
  const date = dayjs(value)
  return value && date.isValid() ? date.format(pattern) : ''
}

const DECIDED_STATUSES = ['accepted', 'rejected']

/**
 * The employer stopping is the latest news: it closed the job without deciding,
 * and after anything the candidate did (a withdrawal before the stop included).
 */
export function isJobStoppedNews(application) {
  if (!application.job_stopped_at || DECIDED_STATUSES.includes(application.status)) return false
  const [latest] = application.timeline || []
  return application.status !== 'withdrawn' || !latest
    || new Date(application.job_stopped_at) >= new Date(latest.occurred_at)
}

/** Status history and reminders, plus the moment the employer stopped recruiting. */
export function buildApplicationTimeline(application) {
  const items = [...(application.timeline || [])]
  if (application.job_stopped_at) {
    items.push({ status: 'stopped', label: 'NTD ngừng tuyển vị trí này', occurred_at: application.job_stopped_at })
  }
  return items.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
}

/** The one line that tells the candidate where the application stands. */
export function getApplicationHeadline(application) {
  if (isJobStoppedNews(application)) {
    return { tone: 'muted', text: 'NTD ngừng tuyển vị trí này', time: formatAppliedJobTime(application.job_stopped_at) }
  }
  const [latest] = application.timeline || []
  if (latest?.status === 'reminder') {
    return {
      tone: 'info',
      text: application.status === 'viewed'
        ? 'NTD đã xem CV. ProCV đã nhắc NTD phản hồi CV của bạn'
        : 'ProCV đã nhắc NTD xem CV của bạn',
      time: formatAppliedJobTime(latest.occurred_at, 'DD-MM-YYYY'),
    }
  }
  return {
    tone: MUTED_STATUSES.has(application.status) ? 'muted' : application.status === 'accepted' ? 'success' : 'info',
    text: latest?.label || CANDIDATE_APPLICATION_STATUS_LABELS[application.status] || '',
    time: formatAppliedJobTime(latest?.occurred_at),
  }
}

/**
 * Number of completed stages; a withdrawn application keeps the furthest stage
 * it reached. A stopped job never counts as an answer from the employer.
 */
export function getCompletedStageCount(application) {
  const statuses = [application.status, ...(application.timeline || []).map((item) => item.status)]
  return Math.max(1, ...statuses.map((status) => STAGES_REACHED[status] || 0))
}

/** Index of the stage where recruiting stopped without an answer, or -1. */
export function getStoppedStageIndex(application) {
  if (!isJobStoppedNews(application) || application.status === 'withdrawn') return -1
  const completed = getCompletedStageCount(application)
  return completed < APPLICATION_STAGES.length ? completed : -1
}
