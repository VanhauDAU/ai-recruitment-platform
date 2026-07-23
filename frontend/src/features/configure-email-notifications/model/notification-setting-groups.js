import {
  GiftOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
} from '@ant-design/icons'

export const NOTIFICATION_SETTING_GROUPS = [
  {
    key: 'account',
    title: 'Tài khoản và hoạt động quan trọng',
    description: 'Theo dõi thay đổi quan trọng liên quan đến tài khoản và hồ sơ tìm việc.',
    icon: SafetyCertificateOutlined,
    tone: 'emerald',
    items: [
      {
        key: 'important_system_updates',
        label: 'Cập nhật hệ thống quan trọng',
        description: 'Các thay đổi có thể ảnh hưởng đến tài khoản hoặc quá trình tìm việc của bạn.',
      },
      {
        key: 'employer_viewed_cv',
        label: 'Nhà tuyển dụng đã xem CV',
        description: 'Biết khi hồ sơ của bạn nhận được sự quan tâm từ nhà tuyển dụng.',
      },
      {
        key: 'new_features_and_cv_templates',
        label: 'Tính năng và mẫu CV mới',
        description: 'Khám phá công cụ mới và các mẫu CV vừa được phát hành.',
      },
      {
        key: 'other_system_notifications',
        label: 'Thông báo hệ thống khác',
        description: 'Nhận các thông tin vận hành hữu ích khác từ nền tảng.',
      },
    ],
  },
  {
    key: 'jobs',
    title: 'Cơ hội việc làm dành cho bạn',
    description: 'Không bỏ lỡ công việc và lời mời phù hợp với mục tiêu nghề nghiệp.',
    icon: SolutionOutlined,
    tone: 'blue',
    items: [
      {
        key: 'configured_job_alerts',
        label: 'Việc làm theo thiết lập',
        description: 'Nhận email theo các bộ tiêu chí việc làm bạn đã chủ động thiết lập.',
      },
      {
        key: 'suitable_job_recommendations',
        label: 'Gợi ý việc làm phù hợp',
        description: 'Các cơ hội được đề xuất từ nhu cầu công việc và CV của bạn.',
      },
      {
        key: 'top_candidate_alerts',
        label: 'Cơ hội dành cho ứng viên nổi bật',
        description: 'Thông tin khi hồ sơ của bạn phù hợp với chương trình tuyển dụng ưu tiên.',
      },
      {
        key: 'employer_invitations',
        label: 'Lời mời từ nhà tuyển dụng',
        description: 'Nhận email khi nhà tuyển dụng muốn kết nối hoặc mời bạn ứng tuyển.',
      },
      {
        key: 'job_and_career_events',
        label: 'Thông tin việc làm và sự kiện nghề nghiệp',
        description: 'Ngày hội tuyển dụng, workshop và hoạt động phát triển sự nghiệp.',
      },
    ],
  },
  {
    key: 'updates',
    title: 'Nội dung, sự kiện và ưu đãi',
    description: 'Tùy chọn các nội dung phát triển nghề nghiệp và chương trình bạn quan tâm.',
    icon: GiftOutlined,
    tone: 'amber',
    items: [
      {
        key: 'service_introductions',
        label: 'Giới thiệu dịch vụ',
        description: 'Thông tin về các dịch vụ hỗ trợ CV và tìm việc trên nền tảng.',
      },
      {
        key: 'program_and_event_introductions',
        label: 'Chương trình và sự kiện mới',
        description: 'Các chương trình cộng đồng và sự kiện nổi bật sắp diễn ra.',
      },
      {
        key: 'partner_gifts_and_discounts',
        label: 'Quà tặng và ưu đãi đối tác',
        description: 'Nhận mã ưu đãi, quà tặng và quyền lợi từ các đối tác phù hợp.',
      },
    ],
  },
]

export const NOTIFICATION_SETTING_KEYS = NOTIFICATION_SETTING_GROUPS.flatMap(
  (group) => group.items.map((item) => item.key),
)
