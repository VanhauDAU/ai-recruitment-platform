import {
  CalendarOutlined,
  EnvironmentOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { Collapse, Tag } from 'antd'
import dayjs from 'dayjs'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  formatSalary,
} from '@/entities/job'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'

const WEEKDAY_LABELS = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật' }
const GENDER_LABELS = { any: 'Không yêu cầu', male: 'Nam', female: 'Nữ' }

function RichContent({ html, placeholder }) {
  const safeHtml = sanitizeHtml(html || '')
  if (!safeHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()) return <p className="italic text-slate-400">{placeholder}</p>
  return (
    <div
      className="text-sm leading-6 text-slate-700 [&_a]:text-[var(--brand-primary)] [&_li]:mb-1 [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

function DetailItem({ icon, label, value }) {
  return (
    <div className="flex min-w-0 gap-3 rounded-xl bg-slate-50 p-3">
      <span className="mt-0.5 text-[var(--brand-primary)]">{icon}</span>
      <div className="min-w-0"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-700">{value || 'Chưa cập nhật'}</p></div>
    </div>
  )
}

function scheduleLabel(schedule) {
  if (!schedule.weekday_from || !schedule.weekday_to) return schedule.note || ''
  const days = schedule.weekday_from === schedule.weekday_to
    ? WEEKDAY_LABELS[schedule.weekday_from]
    : `${WEEKDAY_LABELS[schedule.weekday_from]} - ${WEEKDAY_LABELS[schedule.weekday_to]}`
  const time = schedule.start_time
    ? `${String(schedule.start_time).slice(0, 5)}${schedule.end_time ? ` - ${String(schedule.end_time).slice(0, 5)}` : ''}`
    : ''
  return [days, time, schedule.note].filter(Boolean).join(' · ')
}

function addressLabel(location) {
  return [location.province_name, location.location_name, location.address_detail].filter(Boolean).join(' · ')
}

function ageLabel(job) {
  if (job.age_min && job.age_max) return `${job.age_min} - ${job.age_max} tuổi`
  if (job.age_min) return `Từ ${job.age_min} tuổi`
  if (job.age_max) return `Đến ${job.age_max} tuổi`
  return ''
}

export default function JobInformationPanel({ job }) {
  const workTypes = (job.work_types?.length ? job.work_types : [job.work_type]).filter(Boolean)
  const categoryNames = (job.category_assignments || []).map((item) => item.category_name).filter(Boolean)
  const requiredSkills = (job.job_skills || []).filter((item) => item.importance === 'required')
  const preferredSkills = (job.job_skills || []).filter((item) => item.importance === 'preferred')
  const contact = job.application_contact || {}
  const contentItems = [
    { key: 'description', label: 'Mô tả công việc', children: <RichContent html={job.description} placeholder="Chưa có mô tả công việc." /> },
    { key: 'requirements', label: 'Yêu cầu ứng viên', children: <RichContent html={job.requirements} placeholder="Chưa có yêu cầu ứng viên." /> },
    { key: 'benefits', label: 'Quyền lợi ứng viên', children: <RichContent html={job.benefits} placeholder="Chưa có quyền lợi ứng viên." /> },
  ]
  return (
    <div className="grid min-w-0 gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="mb-4 font-bold text-slate-800">Thông tin chung</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem icon={<WalletOutlined />} label="Mức lương" value={formatSalary(job)} />
            <DetailItem icon={<SafetyCertificateOutlined />} label="Kinh nghiệm" value={EXPERIENCE_YEARS_LABELS[job.experience_years]} />
            <DetailItem icon={<ReadOutlined />} label="Học vấn" value={EDUCATION_LEVEL_LABELS[job.education_level]} />
            <DetailItem icon={<SolutionOutlined />} label="Cấp bậc" value={POSITION_LEVEL_LABELS[job.position_level]} />
            <DetailItem icon={<TeamOutlined />} label="Số lượng tuyển" value={job.number_of_vacancies ? `${job.number_of_vacancies} người` : ''} />
            <DetailItem icon={<UserOutlined />} label="Giới tính" value={GENDER_LABELS[job.gender_requirement]} />
            <DetailItem icon={<UserOutlined />} label="Độ tuổi" value={ageLabel(job)} />
          </div>
        </section>
        <Collapse
          defaultActiveKey={['description']}
          items={contentItems}
          className="!border-slate-200 !bg-white [&_.ant-collapse-content-box]:!p-4 [&_.ant-collapse-header-text]:font-bold [&_.ant-collapse-header]:!items-center"
        />
      </div>

      <aside className="min-w-0 space-y-3">
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-800">Công việc</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div><p className="text-xs text-slate-400">Loại công việc</p><p className="mt-1 font-semibold text-slate-700">{EMPLOYMENT_TYPE_LABELS[job.employment_type] || 'Chưa cập nhật'}</p></div>
            <div><p className="text-xs text-slate-400">Hình thức làm việc</p><div className="mt-1 flex flex-wrap gap-1.5">{workTypes.map((item) => <Tag key={item}>{WORK_TYPE_LABELS[item] || item}</Tag>)}</div></div>
            <div><p className="text-xs text-slate-400">Vị trí chuyên môn</p><div className="mt-1 flex flex-wrap gap-1.5">{categoryNames.length ? categoryNames.map((item) => <Tag key={item} color="green">{item}</Tag>) : 'Chưa cập nhật'}</div></div>
            <div><p className="text-xs text-slate-400">Hạn nhận hồ sơ</p><p className="mt-1 font-semibold text-slate-700"><CalendarOutlined className="mr-1 text-[var(--brand-primary)]" />{job.deadline ? dayjs(job.deadline).format('DD/MM/YYYY') : 'Không giới hạn'}</p></div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-800">Địa điểm & thời gian</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {(job.job_locations || []).map((location) => <p key={location.id || `${location.location}-${location.address_detail}`} className="flex gap-2"><EnvironmentOutlined className="mt-1 shrink-0 text-[var(--brand-primary)]" /><span>{addressLabel(location)}</span></p>)}
            {(job.work_schedules || []).map((schedule) => <p key={schedule.id || scheduleLabel(schedule)} className="rounded-lg bg-slate-50 px-3 py-2">{scheduleLabel(schedule)}</p>)}
            {job.work_schedule_note && <p className="rounded-lg bg-slate-50 px-3 py-2">{job.work_schedule_note}</p>}
            {!job.job_locations?.length && !job.work_schedules?.length && !job.work_schedule_note && <p className="text-slate-400">Chưa cập nhật.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-800">Kỹ năng & quyền lợi bổ sung</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div><p className="text-xs text-slate-400">Kỹ năng cần có</p><div className="mt-1 flex flex-wrap gap-1.5">{requiredSkills.length ? requiredSkills.map((item) => <Tag key={item.id || item.skill} color="green">{item.skill_name}</Tag>) : 'Chưa cập nhật'}</div></div>
            {preferredSkills.length > 0 && <div><p className="text-xs text-slate-400">Kỹ năng nên có</p><div className="mt-1 flex flex-wrap gap-1.5">{preferredSkills.map((item) => <Tag key={item.id || item.skill}>{item.skill_name}</Tag>)}</div></div>}
            {(job.job_benefits || []).length > 0 && <div><p className="text-xs text-slate-400">Quyền lợi bổ sung</p><div className="mt-1 flex flex-wrap gap-1.5">{job.job_benefits.map((item) => <Tag key={item.id || item.benefit} color="cyan">{item.benefit_name}</Tag>)}</div></div>}
            {(job.language_requirements || []).length > 0 && <div><p className="text-xs text-slate-400">Ngoại ngữ</p><div className="mt-1 flex flex-wrap gap-1.5">{job.language_requirements.map((item) => <Tag key={item.id || item.language}>{item.language_name}{item.proficiency_label ? ` · ${item.proficiency_label}` : ''}</Tag>)}</div></div>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-800">Người nhận hồ sơ</h2>
          <div className="mt-3 space-y-1.5 text-sm text-slate-600">
            <p className="font-semibold text-slate-700">{contact.recipient_name || 'Chưa cập nhật'}</p>
            {contact.phone && <p>{contact.phone}</p>}
            {(contact.emails || []).map((item) => <p key={item.id || item.email}>{item.email}</p>)}
          </div>
        </section>
      </aside>
    </div>
  )
}
