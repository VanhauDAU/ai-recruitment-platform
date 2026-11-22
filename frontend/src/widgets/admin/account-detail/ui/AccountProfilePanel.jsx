import { EditOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Skeleton, Space } from 'antd'
import { useState } from 'react'
import {
  adminAccountKeys,
  getAdminAccountProfile,
  InitialOnboardingStatus,
} from '@/entities/account/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { hasProfileFields } from '../model/profile-value'
import CompanyProfileCard from './CompanyProfileCard'
import DetailPanel from './DetailPanel'
import { ProfileFieldGrid, ProfileFieldSection } from './profile-field-display'

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
  experience_years: 'Số năm kinh nghiệm',
  education_level: 'Trình độ học vấn',
  portfolio_url: 'Portfolio',
  github_url: 'GitHub',
  linkedin_url: 'LinkedIn',
}

const CONSENT_LABELS = {
  registration_completed_at: 'Hoàn tất đăng ký lúc',
  terms_accepted_at: 'Chấp nhận điều khoản lúc',
  terms_policy_version: 'Phiên bản điều khoản',
  dpa_accepted_at: 'Chấp nhận DPA lúc',
  marketing_opt_in: 'Đồng ý nhận thông tin',
  marketing_decided_at: 'Quyết định marketing lúc',
}

// Tab "Nhu cầu tìm việc": mong muốn khai trên hồ sơ, rồi tiêu chí có cấu trúc (job_preference).
const JOB_SEARCH_LABELS = {
  job_search_status: 'Trạng thái tìm việc',
  desired_position: 'Vị trí mong muốn',
  expected_salary_min: 'Lương mong muốn tối thiểu',
  expected_salary_max: 'Lương mong muốn tối đa',
  preferred_location: 'Địa điểm mong muốn',
  preferred_work_type: 'Hình thức làm việc',
}

const PREFERENCE_LABELS = {
  desired_position_other: 'Vị trí khác',
  desired_salary: 'Lương mong muốn',
  experience_level: 'Mức kinh nghiệm',
  willing_to_relocate: 'Sẵn sàng chuyển nơi ở',
  desired_specializations: 'Chuyên môn mong muốn',
  preferred_provinces: 'Tỉnh/thành mong muốn',
}

function RevealButton({ reveal, onToggle }) {
  return (
    <Button size="small" icon={reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={onToggle}>
      {reveal ? m.admin_account_hide_sensitive() : m.admin_account_reveal_sensitive()}
    </Button>
  )
}

/**
 * `section` chọn phần hồ sơ được render, để mỗi khối chỉ hiện ở một tab:
 * "Tổng quan"/"Hồ sơ cá nhân" lấy `profile`, "Nhu cầu tìm việc" lấy `preferences`,
 * "Công ty" lấy `company`.
 */
export default function AccountProfilePanel({
  publicId,
  account,
  onEdit,
  section = 'profile',
}) {
  const [reveal, setReveal] = useState(false)
  const query = useQuery({
    queryKey: adminAccountKeys.profile(publicId, reveal),
    queryFn: ({ signal }) => getAdminAccountProfile(publicId, { reveal, signal }),
  })
  if (query.isLoading) {
    return <DetailPanel><Skeleton active paragraph={{ rows: 8 }} /></DetailPanel>
  }
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
  const isEmployer = account.role === 'employer'
  const revealButton = <RevealButton reveal={reveal} onToggle={() => setReveal((value) => !value)} />

  if (section === 'company') {
    return roleProfile?.company ? (
      <CompanyProfileCard
        company={roleProfile.company}
        description={m.admin_account_sensitive_note()}
        extra={revealButton}
      />
    ) : (
      <DetailPanel title="Thông tin công ty">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tài khoản chưa liên kết công ty nào" />
      </DetailPanel>
    )
  }

  const editButton = onEdit && (
    <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(profile)}>Sửa hồ sơ</Button>
  )

  if (section === 'preferences') {
    const preference = roleProfile?.job_preference
    const salary = preference?.desired_salary_vnd
      ? `${Number(preference.desired_salary_vnd).toLocaleString(getIntlLocale())} ₫`
      : null
    return (
      <DetailPanel title={m.admin_account_tab_preferences()} extra={editButton}>
        <ProfileFieldSection title={m.admin_account_preferences_profile()}>
          <ProfileFieldGrid data={roleProfile} labels={JOB_SEARCH_LABELS} />
        </ProfileFieldSection>
        <ProfileFieldSection title={m.admin_account_preferences_structured()}>
          {preference
            ? <ProfileFieldGrid data={{ ...preference, desired_salary: salary }} labels={PREFERENCE_LABELS} />
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.admin_account_preferences_empty()} />}
        </ProfileFieldSection>
      </DetailPanel>
    )
  }

  const onboarding = isEmployer ? roleProfile?.initial_onboarding : null

  return (
    <DetailPanel
      className="account-profile-panel"
      title={isEmployer ? 'Hồ sơ nhà tuyển dụng' : 'Hồ sơ cá nhân'}
      description={m.admin_account_sensitive_note()}
      extra={<Space wrap size={8}>{revealButton}{editButton}</Space>}
    >
      {onboarding && (
        <div className="account-onboarding">
          <span className="account-onboarding__label">{m.admin_recruiter_onboarding()}</span>
          <InitialOnboardingStatus onboarding={onboarding} />
        </div>
      )}
      <ProfileFieldSection title={m.admin_account_profile_personal()}>
        <ProfileFieldGrid data={roleProfile} labels={PROFILE_LABELS} />
      </ProfileFieldSection>
      {hasProfileFields(roleProfile, CONSENT_LABELS) && (
        <ProfileFieldSection title={m.admin_account_profile_consents()}>
          <ProfileFieldGrid data={roleProfile} labels={CONSENT_LABELS} />
        </ProfileFieldSection>
      )}
    </DetailPanel>
  )
}
