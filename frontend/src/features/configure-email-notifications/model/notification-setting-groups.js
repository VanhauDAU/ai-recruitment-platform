export const NOTIFICATION_SETTING_GROUPS = [
  {
    key: 'account',
    title: 'Thông báo từ hệ thống',
    items: [
      {
        key: 'important_system_updates',
        label: 'Cập nhật quan trọng từ hệ thống',
      },
      {
        key: 'employer_viewed_cv',
        label: 'Thông báo nhà tuyển dụng đã xem CV',
      },
      {
        key: 'new_features_and_cv_templates',
        label: 'Thông báo tính năng và mẫu CV mới',
      },
      {
        key: 'other_system_notifications',
        label: 'Thông báo khác từ hệ thống',
      },
    ],
  },
  {
    key: 'jobs',
    title: 'Thông báo cơ hội việc làm',
    items: [
      {
        key: 'configured_job_alerts',
        label: 'Việc làm theo thiết lập',
      },
      {
        key: 'suitable_job_recommendations',
        label: 'Thông báo việc làm phù hợp',
      },
      {
        key: 'top_candidate_alerts',
        label: 'Thông báo việc làm bạn là ứng viên hàng đầu',
      },
      {
        key: 'employer_invitations',
        label: 'Thông báo nhà tuyển dụng gửi mời lời phỏng vấn / ứng tuyển',
      },
      {
        key: 'job_and_career_events',
        label: 'Thông tin liên quan đến việc làm, sự kiện nghề nghiệp',
      },
    ],
  },
  {
    key: 'updates',
    title: 'Thông báo giới thiệu dịch vụ',
    items: [
      {
        key: 'service_introductions',
        label: 'Giới thiệu các dịch vụ',
      },
      {
        key: 'program_and_event_introductions',
        label: 'Giới thiệu chương trình, sự kiện',
      },
      {
        key: 'partner_gifts_and_discounts',
        label: 'Quà tặng / Mã giảm giá từ đối tác',
      },
    ],
  },
]

export const NOTIFICATION_SETTING_KEYS = NOTIFICATION_SETTING_GROUPS.flatMap(
  (group) => group.items.map((item) => item.key),
)
