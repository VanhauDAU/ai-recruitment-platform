// Every switch here has a backend consumer (see CandidateEmailNotificationSettings).

/** Application events: one switch per channel; mandatory rows have none. */
export const APPLICATION_NOTIFICATION_ROWS = [
  {
    key: 'application_received',
    label: 'Nộp hồ sơ thành công',
    description: 'Xác nhận ngay khi bạn ứng tuyển vào một tin.',
    email: 'application_received_email',
    web: 'application_received_web',
  },
  {
    key: 'cv_activity',
    label: 'Nhà tuyển dụng xem hoặc tải CV',
    description: 'Biết khi hồ sơ của bạn đang được quan tâm.',
    email: 'cv_activity_email',
    web: 'cv_activity_web',
  },
  {
    key: 'decisions',
    label: 'Kết quả xử lý hồ sơ',
    description: 'Phù hợp, mời phỏng vấn, trúng tuyển hoặc chưa phù hợp. Đây là thông tin bắt buộc nên luôn được gửi.',
    mandatory: true,
  },
]

export const SIMILAR_JOBS_SETTING = {
  key: 'similar_jobs_in_application_email',
  label: 'Kèm gợi ý việc làm tương tự trong email xác nhận',
  dependsOn: 'application_received_email',
}

export const JOB_EMAIL_SETTINGS = [
  { key: 'configured_job_alerts', label: 'Việc làm theo thông báo bạn đã tạo' },
  { key: 'suitable_job_recommendations', label: 'Việc làm phù hợp với hồ sơ của bạn' },
  { key: 'followed_company_jobs', label: 'Việc làm mới từ công ty đang theo dõi' },
]

export const SETTING_LABELS = Object.fromEntries([
  ...APPLICATION_NOTIFICATION_ROWS.flatMap((row) => (row.mandatory ? [] : [
    [row.email, `Email: ${row.label}`],
    [row.web, `Trên web: ${row.label}`],
  ])),
  [SIMILAR_JOBS_SETTING.key, SIMILAR_JOBS_SETTING.label],
  ...JOB_EMAIL_SETTINGS.map((item) => [item.key, item.label]),
])
