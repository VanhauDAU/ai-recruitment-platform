import dayjs from '@/shared/lib/dayjs'
import { getIntlLocale, m } from '@/shared/config/i18n'

// Trạng thái từng bước thiết lập được suy ra từ dữ liệu thật, không từ vị trí bước.

export const SETUP_STEPS = [
  { key: 'goal', title: m.employer_campaign_step_goal() },
  { key: 'jobs', title: m.employer_campaign_step_jobs() },
  { key: 'channels', title: m.employer_campaign_step_channels(), optional: true },
  { key: 'launch', title: m.employer_campaign_step_launch() },
]

// Mục checklist chưa đạt sẽ dẫn về đúng bước cần sửa.
export const CHECK_STEP = {
  goal: 'goal',
  end_date: 'goal',
  start_date: 'goal',
  jobs: 'jobs',
  job_content: 'jobs',
}

const shortDate = (value) => dayjs(value).format('DD/MM')

const vacancies = (jobs) => jobs.reduce((sum, job) => sum + (job.number_of_vacancies || 0), 0)

// Chỉ tiêu của chiến dịch là tổng số người cần tuyển của các tin sẽ chạy.
export function jobSelection(overview) {
  const publish = overview.draft_jobs.filter((job) => job.action === 'publish')
  const attach = overview.attachable_jobs.filter((job) => job.action === 'attach')
  const already = overview.campaign_jobs
  return {
    toPublish: publish.length,
    toAttach: attach.length,
    already: already.length,
    total: publish.length + attach.length + already.length,
    headcount: vacancies([...publish, ...attach, ...already]),
  }
}

export function setupStepStates(campaign, overview, channelCount = 0) {
  const goalDone = Boolean(campaign.is_continuous || campaign.target_date)
  const end = campaign.is_continuous
    ? m.employer_campaign_info_continuous()
    : m.employer_campaign_steps_until({ date: shortDate(campaign.target_date) })
  const budget = campaign.budget_max
    ? m.employer_campaign_steps_budget({
        amount: m.employer_campaign_money({ amount: Number(campaign.budget_max).toLocaleString(getIntlLocale()) }),
      })
    : ''
  const selection = jobSelection(overview)
  const failing = (overview.check?.items || []).filter((item) => !item.ok).length
  const jobParts = [
    selection.toPublish && m.employer_campaign_steps_to_publish({ count: selection.toPublish }),
    selection.toAttach && m.employer_campaign_steps_to_attach({ count: selection.toAttach }),
    selection.already && m.employer_campaign_steps_already({ count: selection.already }),
    selection.headcount && m.employer_campaign_steps_headcount({ count: selection.headcount }),
  ].filter(Boolean)
  return {
    goal: {
      done: goalDone,
      summary: goalDone ? `${end}${budget}` : m.employer_campaign_steps_no_end_date(),
    },
    jobs: {
      done: selection.total > 0,
      summary: jobParts.length ? jobParts.join(', ') : m.employer_campaign_steps_no_jobs(),
    },
    channels: {
      done: channelCount > 0,
      summary: channelCount
        ? m.employer_campaign_steps_channels({ count: channelCount })
        : m.employer_campaign_steps_channels_optional(),
    },
    launch: overview.check
      ? {
          done: false,
          summary: failing ? m.employer_campaign_steps_failing({ count: failing }) : m.employer_campaign_launch_ready(),
          ready: failing === 0,
        }
      : { done: false, summary: m.employer_campaign_steps_check_after_jobs(), ready: false },
  }
}
