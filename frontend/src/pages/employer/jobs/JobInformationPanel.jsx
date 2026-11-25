import {
  EnvironmentOutlined,
  FieldTimeOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Tag } from 'antd'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  formatSalary,
} from '@/entities/job/job'
import RichContent from '@/shared/ui/rich-text/RichContent'
import { m } from '@/shared/config/i18n'

const WEEKDAY_LABELS = {
  1: m.employer_job_preview_weekday_1(),
  2: m.employer_job_preview_weekday_2(),
  3: m.employer_job_preview_weekday_3(),
  4: m.employer_job_preview_weekday_4(),
  5: m.employer_job_preview_weekday_5(),
  6: m.employer_job_preview_weekday_6(),
  7: m.employer_job_preview_weekday_7(),
}
const GENDER_LABELS = { any: m.employer_job_preview_gender_any(), male: m.employer_job_preview_gender_male(), female: m.employer_job_preview_gender_female() }

const hasText = (html) => Boolean((html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim())

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

function ageLabel(job) {
  if (job.age_min && job.age_max) return m.employer_job_preview_age_range({ min: job.age_min, max: job.age_max })
  if (job.age_min) return m.employer_job_preview_age_min({ min: job.age_min })
  if (job.age_max) return m.employer_job_preview_age_max({ max: job.age_max })
  return m.employer_job_detail_age_any()
}

function SideCard({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <div className="mt-3 space-y-3 text-sm text-slate-600">{children}</div>
    </section>
  )
}

function TagGroup({ label, items, color }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-1.5 text-xs text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">{items.map((item) => <Tag key={item} color={color} className="!m-0">{item}</Tag>)}</div>
    </div>
  )
}

export default function JobInformationPanel({ job }) {
  const workTypes = (job.work_types?.length ? job.work_types : [job.work_type]).filter(Boolean)
  const skills = job.job_skills || []
  const contact = job.application_contact || {}
  const facts = [
    [m.employer_job_detail_salary(), formatSalary(job)],
    [m.employer_job_detail_experience(), EXPERIENCE_YEARS_LABELS[job.experience_years]],
    [m.employer_job_detail_level(), POSITION_LEVEL_LABELS[job.position_level]],
    [m.employer_job_detail_education(), EDUCATION_LEVEL_LABELS[job.education_level]],
    [m.employer_job_detail_vacancies(), job.number_of_vacancies ? m.employer_job_preview_vacancy_count({ count: Number(job.number_of_vacancies) }) : ''],
    [m.employer_job_detail_employment_type(), EMPLOYMENT_TYPE_LABELS[job.employment_type]],
    [m.employer_job_detail_work_type(), workTypes.map((item) => WORK_TYPE_LABELS[item] || item).join(', ')],
    [m.employer_job_detail_gender_age(), `${GENDER_LABELS[job.gender_requirement] || m.employer_job_preview_gender_any()} · ${ageLabel(job)}`],
  ]
  const sections = [
    [m.employer_job_detail_description(), job.description],
    [m.employer_job_detail_requirements(), job.requirements],
    [m.employer_job_detail_benefits(), job.benefits],
  ]

  return (
    <div className="grid min-w-0 gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <dl className="job-hairline-grid grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0 bg-white px-3.5 py-3">
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value || m.employer_job_detail_not_updated()}</dd>
            </div>
          ))}
        </dl>

        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {sections.map(([title, html]) => (
            <section key={title} className="p-4 sm:p-5">
              <h3 className="mb-2 text-base font-bold text-slate-900">{title}</h3>
              {hasText(html)
                ? <RichContent html={html} className="job-rich" />
                : <p className="text-sm italic text-slate-400">{m.employer_job_detail_not_updated_period()}</p>}
            </section>
          ))}
          {job.application_reasons?.length > 0 && (
            <section className="p-4 sm:p-5">
              <h3 className="mb-2 text-base font-bold text-slate-900">{m.employer_job_detail_reasons()}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {job.application_reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </section>
          )}
        </div>
      </div>

      <aside className="min-w-0 space-y-3">
        <SideCard title={m.employer_job_detail_skills_card()}>
          <TagGroup label={m.employer_job_detail_specialization()} color="green" items={(job.category_assignments || []).map((item) => item.category_name).filter(Boolean)} />
          <TagGroup label={m.employer_job_detail_required_skills()} color="green" items={skills.filter((item) => item.importance === 'required').map((item) => item.skill_name)} />
          <TagGroup label={m.employer_job_detail_preferred_skills()} items={skills.filter((item) => item.importance === 'preferred').map((item) => item.skill_name)} />
          <TagGroup
            label={m.employer_job_detail_languages()}
            items={(job.language_requirements || []).map((item) => `${item.language_name}${item.proficiency_label ? ` · ${item.proficiency_label}` : ''}`)}
          />
          {!skills.length && !job.category_assignments?.length && <p className="text-slate-400">{m.employer_job_detail_not_updated_period()}</p>}
        </SideCard>

        <SideCard title={m.employer_job_detail_location_time()}>
          {(job.job_locations || []).map((location) => (
            <p key={location.id || `${location.location}-${location.address_detail}`} className="flex gap-2">
              <EnvironmentOutlined aria-hidden className="mt-1 shrink-0 text-[var(--brand-primary)]" />
              <span>{[location.address_detail, location.location_name, location.province_name].filter(Boolean).join(', ')}</span>
            </p>
          ))}
          {[...(job.work_schedules || []).map(scheduleLabel), job.work_schedule_note].filter(Boolean).map((label) => (
            <p key={label} className="flex gap-2">
              <FieldTimeOutlined aria-hidden className="mt-1 shrink-0 text-[var(--brand-primary)]" />
              <span>{label}</span>
            </p>
          ))}
          {!job.job_locations?.length && !job.work_schedules?.length && !job.work_schedule_note && (
            <p className="text-slate-400">{m.employer_job_detail_not_updated_period()}</p>
          )}
        </SideCard>

        {(job.job_benefits || []).length > 0 && (
          <SideCard title={m.employer_job_detail_perks()}>
            <TagGroup label={m.employer_job_detail_extra_benefits()} color="cyan" items={job.job_benefits.map((item) => item.benefit_name)} />
          </SideCard>
        )}

        <SideCard title={m.employer_job_detail_recipient()}>
          <p className="flex items-center gap-2 font-semibold text-slate-800">
            <UserOutlined aria-hidden className="text-slate-400" /> {contact.recipient_name || m.employer_job_detail_not_updated()}
          </p>
          {contact.phone && <p className="flex items-center gap-2"><PhoneOutlined aria-hidden className="text-slate-400" /> {contact.phone}</p>}
          {(contact.emails || []).map((item) => (
            <p key={item.id || item.email} className="flex min-w-0 items-center gap-2">
              <MailOutlined aria-hidden className="text-slate-400" /> <span className="truncate">{item.email}</span>
            </p>
          ))}
        </SideCard>
      </aside>
    </div>
  )
}
