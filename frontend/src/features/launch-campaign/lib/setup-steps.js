import dayjs from 'dayjs'

// Trạng thái từng bước thiết lập được suy ra từ dữ liệu thật, không từ vị trí bước.

export const SETUP_STEPS = [
  { key: 'goal', title: 'Thông tin' },
  { key: 'jobs', title: 'Tin tuyển dụng' },
  { key: 'channels', title: 'Kênh phân phối', optional: true },
  { key: 'launch', title: 'Kích hoạt' },
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
  const end = campaign.is_continuous ? 'Tuyển liên tục' : `Đến ${shortDate(campaign.target_date)}`
  const budget = campaign.budget_max ? `, ngân sách tối đa ${Number(campaign.budget_max).toLocaleString('vi-VN')} đ` : ''
  const selection = jobSelection(overview)
  const failing = (overview.check?.items || []).filter((item) => !item.ok).length
  const jobParts = [
    selection.toPublish && `${selection.toPublish} tin sẽ đăng`,
    selection.toAttach && `${selection.toAttach} tin sẽ gắn`,
    selection.already && `${selection.already} tin đang chạy`,
    selection.headcount && `tuyển ${selection.headcount} người`,
  ].filter(Boolean)
  return {
    goal: {
      done: goalDone,
      summary: goalDone ? `${end}${budget}` : 'Chưa chọn ngày kết thúc',
    },
    jobs: {
      done: selection.total > 0,
      summary: jobParts.length ? jobParts.join(', ') : 'Chưa chọn tin nào',
    },
    channels: {
      done: channelCount > 0,
      summary: channelCount ? `${channelCount} kênh có link theo dõi` : 'Không bắt buộc, thêm sau cũng được',
    },
    launch: overview.check
      ? {
          done: false,
          summary: failing ? `Còn ${failing} điều kiện chưa đạt` : 'Sẵn sàng kích hoạt',
          ready: failing === 0,
        }
      : { done: false, summary: 'Kiểm tra sau khi chọn tin', ready: false },
  }
}
