// Why the server refused to turn a job email on, and how the candidate fixes
// it. Shared by every surface that toggles these preferences.
export const PREFERENCE_ISSUES = {
  email_unverified: {
    type: 'warning',
    title: 'Xác thực email để nhận thông báo',
    description: 'Chúng tôi chỉ gửi email tới địa chỉ đăng nhập đã được xác thực.',
    actionLabel: 'Xác thực email',
    actionPath: '/tai-khoan/xac-thuc-email',
  },
  preferences_required: {
    type: 'info',
    title: 'Hoàn thiện cài đặt gợi ý việc làm',
    description: 'Hãy chọn nhu cầu công việc trước khi bật email việc làm phù hợp.',
    actionLabel: 'Đi tới cài đặt',
    actionPath: '/tai-khoan/cai-dat-goi-y-viec-lam',
  },
  consent_required: {
    type: 'info',
    title: 'Cần sự đồng ý dùng dữ liệu hồ sơ',
    description: 'Việc làm phù hợp được chọn từ hồ sơ của bạn nên cần bạn đồng ý trước.',
    actionLabel: 'Đi tới cài đặt',
    actionPath: '/tai-khoan/cai-dat-goi-y-viec-lam',
  },
}

export function preferenceErrorCode(error) {
  const data = error?.response?.data
  return data?.code || data?.detail?.code || ''
}
