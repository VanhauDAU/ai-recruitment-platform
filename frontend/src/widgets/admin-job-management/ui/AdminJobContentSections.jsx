import {
  EnvironmentOutlined,
  FileTextOutlined,
  ProfileOutlined,
} from '@ant-design/icons'
import { Empty, Space, Tag } from 'antd'
import { useMemo } from 'react'
import { formatAdminJobDate } from '@/entities/admin-job'
import { normalizeRichTextHtml } from '@/shared/lib/rich-text-html'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import {
  adminJobEnumLabel,
  formatAdminJobSalary,
} from '../model/detail-presentation'
import AdminJobDisclosure from './AdminJobDisclosure'

function RichContent({ html }) {
  const safeHtml = useMemo(
    () => sanitizeHtml(normalizeRichTextHtml(html || '')),
    [html],
  )
  if (!safeHtml) return <p className="text-sm text-slate-500">Chưa cung cấp.</p>
  return (
    <div
      className="admin-job-rich-content"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

function TagList({ items, labelKey }) {
  if (!items?.length) return 'Chưa cung cấp'
  return (
    <Space wrap size={[4, 6]}>
      {items.map((item) => <Tag key={item.id}>{item[labelKey]}</Tag>)}
    </Space>
  )
}

function InfoGrid({ items }) {
  return (
    <dl className="admin-job-info-grid">
      {items.map((item) => (
        <div className="admin-job-info-grid__item" key={item.key}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function AdminJobContentSections({ job, openSections, onToggle }) {
  const conditions = [
    { key: 'salary', label: 'Thu nhập', value: formatAdminJobSalary(job) },
    { key: 'deadline', label: 'Hạn nộp', value: formatAdminJobDate(job.deadline) },
    {
      key: 'work-types',
      label: 'Hình thức làm việc',
      value: (job.work_types || []).map(adminJobEnumLabel).join(', ') || adminJobEnumLabel(job.work_type),
    },
    { key: 'employment', label: 'Loại hợp đồng', value: adminJobEnumLabel(job.employment_type) },
    { key: 'experience', label: 'Kinh nghiệm', value: adminJobEnumLabel(job.experience_years) },
    { key: 'position', label: 'Cấp bậc', value: adminJobEnumLabel(job.position_level) },
    { key: 'education', label: 'Học vấn', value: adminJobEnumLabel(job.education_level) },
    { key: 'gender', label: 'Giới tính', value: adminJobEnumLabel(job.gender_requirement) },
    {
      key: 'age',
      label: 'Độ tuổi',
      value: job.age_min || job.age_max
        ? `${job.age_min || '—'} – ${job.age_max || '—'}`
        : 'Không yêu cầu',
    },
    { key: 'vacancies', label: 'Số lượng', value: job.number_of_vacancies ?? 'Không giới hạn' },
    { key: 'categories', label: 'Chuyên môn', value: <TagList items={job.category_assignments} labelKey="category_name" /> },
    { key: 'skills', label: 'Kỹ năng', value: <TagList items={job.job_skills} labelKey="skill_name" /> },
    { key: 'benefits', label: 'Quyền lợi chuẩn hóa', value: <TagList items={job.job_benefits} labelKey="benefit_name" /> },
    { key: 'languages', label: 'Ngoại ngữ', value: <TagList items={job.language_requirements} labelKey="language_name" /> },
  ]

  return (
    <div className="space-y-4">
      <AdminJobDisclosure
        badge="3 phần"
        description="Mô tả, yêu cầu và quyền lợi do nhà tuyển dụng gửi"
        icon={<FileTextOutlined />}
        onToggle={onToggle}
        open={openSections.has('content')}
        sectionKey="content"
        title="Nội dung tuyển dụng"
      >
        <div className="admin-job-copy-sections">
          <section>
            <h3>Mô tả công việc</h3>
            <RichContent html={job.description} />
          </section>
          <section>
            <h3>Yêu cầu ứng viên</h3>
            <RichContent html={job.requirements} />
          </section>
          <section>
            <h3>Quyền lợi</h3>
            <RichContent html={job.benefits} />
          </section>
        </div>
      </AdminJobDisclosure>

      <AdminJobDisclosure
        badge={`${conditions.length} trường`}
        description="Thu nhập, kinh nghiệm, cấp bậc và phân loại"
        icon={<ProfileOutlined />}
        onToggle={onToggle}
        open={openSections.has('conditions')}
        sectionKey="conditions"
        title="Điều kiện và phân loại"
      >
        <InfoGrid items={conditions} />
      </AdminJobDisclosure>

      <AdminJobDisclosure
        badge={`${job.job_locations?.length || 0} địa điểm`}
        description="Nơi làm việc và ghi chú lịch làm việc"
        icon={<EnvironmentOutlined />}
        onToggle={onToggle}
        open={openSections.has('workplace')}
        sectionKey="workplace"
        title="Địa điểm và lịch làm việc"
      >
        {job.job_locations?.length ? (
          <div className="admin-job-location-list">
            {job.job_locations.map((item) => (
              <div className="admin-job-location-list__item" key={item.id}>
                <EnvironmentOutlined />
                <span>
                  <strong>{item.location_name}, {item.province_name}</strong>
                  <small>{item.address_detail || 'Không có địa chỉ chi tiết'}</small>
                </span>
              </div>
            ))}
          </div>
        ) : <Empty description="Chưa có địa điểm" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        {job.work_schedule_note && (
          <div className="admin-job-work-note">
            <strong>Ghi chú lịch làm việc</strong>
            <p>{job.work_schedule_note}</p>
          </div>
        )}
      </AdminJobDisclosure>
    </div>
  )
}

