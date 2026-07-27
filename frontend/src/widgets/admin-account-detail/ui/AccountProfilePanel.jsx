import { EditOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Empty, Skeleton, Space, Typography } from 'antd'
import { useState } from 'react'
import {
  adminAccountKeys,
  getAdminAccountProfile,
} from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { displayProfileValue } from '../model/profile-value'
import CompanyProfileCard from './CompanyProfileCard'
import { ProfileFieldGrid } from './profile-field-display'

const PROFILE_LABELS = {
  position_title: 'Chức danh',
  company_role: 'Vai trò tại công ty',
  contact_phone: 'Số liên hệ',
  verified_phone: 'Số điện thoại đã xác minh',
  phone_verified_at: 'Xác minh điện thoại lúc',
  date_of_birth: 'Ngày sinh',
  gender: 'Giới tính',
  address: 'Địa chỉ',
  headline: 'Tiêu đề nghề nghiệp',
  bio: 'Giới thiệu',
  career_objective: 'Mục tiêu nghề nghiệp',
  current_position: 'Vị trí hiện tại',
  desired_position: 'Vị trí mong muốn',
  experience_years: 'Số năm kinh nghiệm',
  education_level: 'Trình độ học vấn',
  expected_salary_min: 'Lương mong muốn tối thiểu',
  expected_salary_max: 'Lương mong muốn tối đa',
  preferred_location: 'Địa điểm mong muốn',
  preferred_work_type: 'Hình thức làm việc',
  job_search_status: 'Trạng thái tìm việc',
  portfolio_url: 'Portfolio',
  github_url: 'GitHub',
  linkedin_url: 'LinkedIn',
  registration_completed_at: 'Hoàn tất đăng ký lúc',
  onboarding_completed_at: 'Hoàn tất onboarding lúc',
  terms_accepted_at: 'Chấp nhận điều khoản lúc',
  terms_policy_version: 'Phiên bản điều khoản',
  dpa_accepted_at: 'Chấp nhận DPA lúc',
  marketing_opt_in: 'Đồng ý nhận thông tin',
  marketing_decided_at: 'Quyết định marketing lúc',
}

/**
 * `section` chọn phần hồ sơ được render: tab "Hồ sơ NTD" lấy `profile`, tab
 * "Công ty" lấy `company`. Hai tab từng dùng chung một panel nên khối công ty
 * bị lặp ở cả hai nơi.
 */
export default function AccountProfilePanel({
  publicId,
  account,
  canReveal,
  onEdit,
  section = 'profile',
}) {
  const [reveal, setReveal] = useState(false)
  const query = useQuery({
    queryKey: adminAccountKeys.profile(publicId, reveal),
    queryFn: ({ signal }) => getAdminAccountProfile(publicId, { reveal, signal }),
  })
  if (query.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (query.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title="Không thể tải hồ sơ"
        description={getApiErrorMessage(query.error)}
      />
    )
  }
  const profile = query.data
  const roleProfile = profile?.[account.role]
  const preference = roleProfile?.job_preference
  const isCompanySection = section === 'company'

  const toolbar = (
    <div className="account-detail-toolbar">
      <Typography.Text type="secondary">
        Dữ liệu nhạy cảm được che mặc định và mọi lần xem đều được ghi audit.
      </Typography.Text>
      <Space wrap>
        {canReveal && (
          <Button
            icon={reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setReveal((value) => !value)}
          >
            {reveal ? 'Che dữ liệu' : 'Hiện dữ liệu nhạy cảm'}
          </Button>
        )}
        {!isCompanySection && onEdit && (
          <Button icon={<EditOutlined />} onClick={() => onEdit(profile)}>Sửa hồ sơ</Button>
        )}
      </Space>
    </div>
  )

  if (isCompanySection) {
    return (
      <div className="space-y-5">
        {toolbar}
        {roleProfile?.company ? (
          <CompanyProfileCard company={roleProfile.company} />
        ) : (
          <Card className="account-profile__card" title="Thông tin công ty">
            <Empty description="Tài khoản chưa liên kết công ty nào" />
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {toolbar}

      <Card
        className="account-profile__card"
        title={account.role === 'employer' ? 'Hồ sơ nhà tuyển dụng' : 'Hồ sơ cá nhân'}
      >
        <ProfileFieldGrid data={roleProfile} labels={PROFILE_LABELS} />
      </Card>

      {account.role === 'candidate' && preference && (
        <Card className="account-profile__card" title="Nhu cầu tìm việc có cấu trúc">
          <Descriptions bordered size="small" className="account-profile__grid" column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Vị trí khác">
              {displayProfileValue('desired_position_other', preference.desired_position_other)}
            </Descriptions.Item>
            <Descriptions.Item label="Lương mong muốn">
              {preference.desired_salary_vnd
                ? `${Number(preference.desired_salary_vnd).toLocaleString('vi-VN')} ₫`
                : 'Chưa cập nhật'}
            </Descriptions.Item>
            <Descriptions.Item label="Mức kinh nghiệm">
              {displayProfileValue('experience_level', preference.experience_level)}
            </Descriptions.Item>
            <Descriptions.Item label="Sẵn sàng chuyển nơi ở">
              {displayProfileValue('willing_to_relocate', preference.willing_to_relocate)}
            </Descriptions.Item>
            <Descriptions.Item label="Chuyên môn mong muốn">
              {displayProfileValue('desired_specializations', preference.desired_specializations)}
            </Descriptions.Item>
            <Descriptions.Item label="Tỉnh/thành mong muốn">
              {displayProfileValue('preferred_provinces', preference.preferred_provinces)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  )
}
