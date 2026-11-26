import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  HeartOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { Modal } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { memo, useMemo, useState } from 'react'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  formatDeadline,
  formatSalary,
} from '@/entities/job/job'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import { normalizeRichTextHtml } from '../model/job-form-values'
import { m } from '@/shared/config/i18n'

const EMPTY_LABEL = m.employer_job_preview_empty()
const GENDER_LABELS = { any: m.employer_job_preview_gender_any(), male: m.employer_job_preview_gender_male(), female: m.employer_job_preview_gender_female() }
const PROFICIENCY_LABELS = {
  basic: m.employer_job_preview_proficiency_basic(),
  conversational: m.employer_job_preview_proficiency_conversational(),
  working: m.employer_job_preview_proficiency_working(),
  professional: m.employer_job_preview_proficiency_professional(),
  native: m.employer_job_preview_proficiency_native(),
}
const WEEKDAY_LABELS = {
  1: m.employer_job_preview_weekday_1(),
  2: m.employer_job_preview_weekday_2(),
  3: m.employer_job_preview_weekday_3(),
  4: m.employer_job_preview_weekday_4(),
  5: m.employer_job_preview_weekday_5(),
  6: m.employer_job_preview_weekday_6(),
  7: m.employer_job_preview_weekday_7(),
}

function formatDate(value) {
  if (!value) return ''
  const date = dayjs(value)
  return date.isValid() ? date.format('DD/MM/YYYY') : ''
}

function formatTime(value) {
  if (!value) return ''
  if (typeof value.format === 'function') return value.format('HH:mm')
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('HH:mm') : String(value).slice(0, 5)
}

function ageLabel(values) {
  if (values.age_min && values.age_max) return m.employer_job_preview_age_range({ min: values.age_min, max: values.age_max })
  if (values.age_min) return m.employer_job_preview_age_min({ min: values.age_min })
  if (values.age_max) return m.employer_job_preview_age_max({ max: values.age_max })
  return ''
}

function scheduleLabel(item) {
  if (!item?.weekday_from || !item?.weekday_to) return ''
  const days = item.weekday_from === item.weekday_to
    ? WEEKDAY_LABELS[item.weekday_from]
    : `${WEEKDAY_LABELS[item.weekday_from]} - ${WEEKDAY_LABELS[item.weekday_to]}`
  const start = formatTime(item.start_time)
  const end = formatTime(item.end_time)
  return start && end ? `${days}, ${start} - ${end}` : days
}

function CompanyMark({ companyName, large = false }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-gradient-to-br from-[var(--brand-primary-soft)] to-[var(--brand-primary-soft)] font-black text-[var(--brand-primary)] ${large ? 'h-16 w-16 text-xl' : 'h-11 w-11 text-sm'}`}>
      {(companyName || 'C').charAt(0).toUpperCase()}
    </span>
  )
}

function Chip({ children, primary = false }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${primary ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-hover)]' : 'bg-slate-100 text-slate-600'}`}>
      {children}
    </span>
  )
}

function Metric({ icon, label, value, compact = false }) {
  return (
    <div className={`flex min-w-0 items-center rounded-lg bg-slate-50 ${compact ? 'gap-2 p-2' : 'gap-3 p-3'}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] ${compact ? 'h-7 w-7 text-xs' : 'h-9 w-9'}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] text-slate-400">{label}</p>
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} truncate font-bold text-slate-700`} title={value}>{value || EMPTY_LABEL}</p>
      </div>
    </div>
  )
}

function RichPreviewText({ html, compact = false, placeholder }) {
  const safeHtml = useMemo(() => sanitizeHtml(normalizeRichTextHtml(html)), [html])
  const hasText = safeHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
  if (!hasText) return <p className="text-[10px] italic text-slate-400">{placeholder}</p>
  return (
    <div
      className={`job-preview-rich text-slate-600 [&_a]:text-[var(--brand-primary)] [&_h2]:font-bold [&_h2]:text-slate-800 [&_h3]:font-bold [&_h3]:text-slate-800 [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5 [&_table]:w-full [&_td]:border [&_td]:p-1 [&_th]:border [&_th]:p-1 [&_ul]:list-disc [&_ul]:pl-5 ${compact ? 'max-h-24 overflow-hidden text-[10px] leading-4' : 'text-sm leading-6'}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

function SectionTitle({ children, compact = false }) {
  return <h3 className={`border-l-[3px] border-[var(--brand-primary)] pl-2 font-extrabold text-slate-800 ${compact ? 'text-[11px]' : 'text-sm'}`}>{children}</h3>
}

function JobListCard({ data, full = false }) {
  const requirementSummary = [
    data.experienceLabel,
    data.age,
    data.educationLabel,
    data.positionLabel,
    ...data.requiredSkillNames.slice(0, 2),
  ].filter(Boolean)

  return (
    <article className={`rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-[var(--brand-primary)] ${full ? 'p-5' : 'p-3'}`}>
      <div className={`flex items-start ${full ? 'gap-4' : 'gap-2.5'}`}>
        <CompanyMark companyName={data.companyName} large={full} />
        <div className="min-w-0 flex-1">
          <div className={`flex items-start justify-between ${full ? 'gap-4' : 'gap-2'}`}>
            <h3 className={`line-clamp-2 min-w-0 font-extrabold leading-snug text-slate-900 ${full ? 'text-base' : 'text-xs'}`}>{data.title}</h3>
            <span className={`shrink-0 text-right font-extrabold text-[var(--brand-primary)] ${full ? 'text-sm' : 'max-w-[86px] text-[10px]'}`}>{data.salary}</span>
          </div>
          <p className={`mt-1 truncate font-semibold uppercase text-slate-400 ${full ? 'text-xs' : 'text-[9px]'}`}>{data.companyName}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip primary><EnvironmentOutlined /> {data.locationLabel}</Chip>
            <Chip><UserOutlined /> {data.experienceLabel}</Chip>
          </div>

          <div className={`mt-3 border-t border-slate-100 pt-2.5 ${full ? 'flex items-center justify-between gap-4' : ''}`}>
            <p className={`min-w-0 truncate text-slate-500 ${full ? 'text-xs' : 'text-[9px]'}`}>
              {requirementSummary.length ? requirementSummary.join('  |  ') : m.employer_job_preview_see_requirements()}
            </p>
            <span className={`shrink-0 items-center gap-3 ${full ? 'flex' : 'mt-2 flex justify-between'}`}>
              <span className="text-[10px] text-slate-400">{m.employer_job_preview_posted_today()}</span>
              <button type="button" aria-label={m.employer_job_preview_save_job()} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-400"><HeartOutlined /></button>
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

function JobListPreview({ data, full = false }) {
  if (!full) return <JobListCard data={data} />
  return (
    <div className="rounded-xl bg-slate-100 p-5 sm:p-7">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">{m.employer_job_preview_career_opportunities()}</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">{m.employer_job_preview_latest_jobs()}</h2>
        </div>
        <span className="text-xs text-slate-500">{m.employer_job_preview_one_matching_job()}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden rounded-xl border border-slate-200 bg-white p-4 lg:block">
          <p className="text-sm font-bold text-slate-800">{m.employer_job_preview_filter_jobs()}</p>
          {[m.employer_job_preview_filter_keyword(), m.employer_job_preview_filter_location(), m.employer_job_preview_filter_experience(), m.employer_job_preview_filter_salary()].map((label) => (
            <div key={label} className="mt-4">
              <p className="mb-1.5 text-xs text-slate-500">{label}</p>
              <div className="h-9 rounded-md border border-slate-200 bg-slate-50" />
            </div>
          ))}
        </aside>
        <div>
          <JobListCard data={data} full />
        </div>
      </div>
    </div>
  )
}

function RequirementTags({ data, compact = false }) {
  const tags = [
    data.educationLabel,
    data.positionLabel,
    data.genderLabel,
    data.age,
    ...data.requiredSkillNames,
    ...data.preferredSkillNames,
  ].filter(Boolean)
  if (!tags.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.slice(0, compact ? 5 : tags.length).map((tag, index) => (
        <Chip key={`${tag}-${index}`} primary={index < 2}>{tag}</Chip>
      ))}
      {compact && tags.length > 5 && <Chip>+{tags.length - 5}</Chip>}
    </div>
  )
}

function LanguageList({ items, compact = false }) {
  if (!items.length) return null
  return (
    <ul className={compact ? 'space-y-1' : 'space-y-2'}>
      {items.map((item, index) => (
        <li key={`${item.name}-${index}`} className={`rounded-lg bg-slate-50 text-slate-600 ${compact ? 'px-2 py-1.5 text-[10px]' : 'p-3 text-sm'}`}>
          <strong className="text-slate-700">{item.name}</strong>{item.proficiency ? ` — ${item.proficiency}` : ''}
        </li>
      ))}
    </ul>
  )
}

function WorkplaceList({ groups, compact = false }) {
  if (!groups.length) return <p className="text-[10px] italic text-slate-400">{m.employer_job_preview_workplace_placeholder()}</p>
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {groups.map((group) => (
        <div key={group.name} className={`rounded-lg bg-slate-50 ${compact ? 'p-2' : 'p-3'}`}>
          <p className={`font-bold text-slate-700 ${compact ? 'text-[10px]' : 'text-sm'}`}><EnvironmentOutlined className="mr-1 text-[var(--brand-primary)]" />{group.name}</p>
          {group.addresses.length > 0 && (
            <ul className={`mt-1 list-disc pl-5 text-slate-500 ${compact ? 'text-[9px] leading-4' : 'text-sm leading-6'}`}>
              {group.addresses.map((address, index) => <li key={`${address}-${index}`}>{address}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function ScheduleList({ schedules, note, compact = false }) {
  const rows = schedules.map(scheduleLabel).filter(Boolean)
  if (!rows.length && !note) return <p className="text-[10px] italic text-slate-400">{m.employer_job_preview_schedule_placeholder()}</p>
  return (
    <div className={`text-slate-600 ${compact ? 'text-[10px] leading-4' : 'text-sm leading-6'}`}>
      {rows.length > 0 && <ul className="list-disc pl-5">{rows.map((row) => <li key={row}>{row}</li>)}</ul>}
      {note && <p className={rows.length ? 'mt-1' : ''}>{note}</p>}
    </div>
  )
}

function DetailContent({ data, compact = false }) {
  const sections = [
    { title: m.employer_job_preview_description(), html: data.values.description, placeholder: m.employer_job_preview_description_placeholder() },
    { title: m.employer_job_preview_requirements(), html: data.values.requirements, placeholder: m.employer_job_preview_requirements_placeholder() },
    { title: m.employer_job_preview_benefits(), html: data.values.benefits, placeholder: m.employer_job_preview_benefits_placeholder() },
  ]
  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <RequirementTags data={data} compact={compact} />
      {(data.values.application_reasons || []).length > 0 && (
        <section>
          <SectionTitle compact={compact}>{m.employer_job_preview_why_apply()}</SectionTitle>
          <ul className="mt-2 space-y-1 text-slate-600">
            {data.values.application_reasons.map((reason, index) => (
              <li key={`${reason}-${index}`} className={compact ? 'text-[10px]' : 'text-sm'}>✓ {reason}</li>
            ))}
          </ul>
        </section>
      )}
      {data.benefitNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">{data.benefitNames.map((name) => <Chip key={name}>{name}</Chip>)}</div>
      )}
      {sections.map((section) => (
        <section key={section.title}>
          <SectionTitle compact={compact}>{section.title}</SectionTitle>
          <div className={compact ? 'relative mt-2' : 'mt-3'}>
            <RichPreviewText html={section.html} compact={compact} placeholder={section.placeholder} />
            {compact && section.html && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />}
          </div>
        </section>
      ))}
      {data.languageItems.length > 0 && (
        <section>
          <SectionTitle compact={compact}>{m.employer_job_preview_language_requirements()}</SectionTitle>
          <div className="mt-2"><LanguageList items={data.languageItems} compact={compact} /></div>
        </section>
      )}
      <section>
        <SectionTitle compact={compact}>{m.employer_job_preview_workplaces()}</SectionTitle>
        <div className="mt-2"><WorkplaceList groups={data.workplaceGroups} compact={compact} /></div>
      </section>
      <section>
        <SectionTitle compact={compact}>{m.employer_job_preview_working_hours()}</SectionTitle>
        <div className="mt-2"><ScheduleList schedules={data.values.work_schedules || []} note={data.values.work_schedule_note} compact={compact} /></div>
      </section>
      {!compact && (
        <section>
          <SectionTitle>{m.employer_job_preview_how_to_apply()}</SectionTitle>
          <p className="mt-3 text-sm leading-6 text-slate-600">{m.employer_job_preview_how_to_apply_body()}</p>
        </section>
      )}
    </div>
  )
}

function JobHero({ data, compact = false }) {
  const deadline = data.values.deadline ? `${formatDate(data.values.deadline)} · ${formatDeadline(data.values.deadline)}` : EMPTY_LABEL
  return (
    <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${compact ? '' : 'rounded-2xl'}`}>
      <div className="h-1 bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-primary)] to-[var(--brand-primary-soft)]" />
      <div className={compact ? 'p-3' : 'p-5'}>
        <div className="flex items-start gap-3">
          {compact && <CompanyMark companyName={data.companyName} />}
          <div className="min-w-0 flex-1">
            <h2 className={`font-extrabold leading-snug text-slate-900 ${compact ? 'text-sm' : 'text-xl'}`}>{data.title}</h2>
            <p className={`mt-1 truncate font-semibold uppercase text-slate-400 ${compact ? 'text-[9px]' : 'text-xs'}`}>{data.companyName}</p>
          </div>
        </div>
        <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
          <Metric compact={compact} icon={<WalletOutlined />} label={m.employer_job_preview_filter_salary()} value={data.salary} />
          <Metric compact={compact} icon={<EnvironmentOutlined />} label={m.employer_job_preview_filter_location()} value={data.locationLabel} />
          <Metric compact={compact} icon={<UserOutlined />} label={m.employer_job_preview_filter_experience()} value={data.experienceLabel} />
        </div>
        <p className={`mt-3 flex items-start gap-1.5 text-slate-500 ${compact ? 'text-[9px]' : 'text-xs'}`}><CalendarOutlined className="mt-0.5 text-[var(--brand-primary)]" />{m.employer_job_preview_deadline()} <strong className="text-slate-700">{deadline}</strong></p>
        <button type="button" className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] font-bold text-white ${compact ? 'h-8 text-[10px]' : 'h-11 text-sm'}`}><SafetyCertificateOutlined /> {m.employer_job_preview_apply_now()}</button>
      </div>
    </section>
  )
}

function GeneralInfo({ data }) {
  const rows = [
    { icon: <SolutionOutlined />, label: m.employer_job_preview_level(), value: data.positionLabel },
    { icon: <ReadOutlined />, label: m.employer_job_preview_education(), value: data.educationLabel },
    { icon: <TeamOutlined />, label: m.employer_job_preview_vacancies(), value: m.employer_job_preview_vacancy_count({ count: Number(data.values.number_of_vacancies) || 1 }) },
    { icon: <EnvironmentOutlined />, label: m.employer_job_preview_work_type(), value: data.workTypeLabel },
    { icon: <ClockCircleOutlined />, label: m.employer_job_preview_employment_type(), value: data.employmentLabel },
    { icon: <UserOutlined />, label: m.employer_job_preview_gender(), value: data.genderLabel },
  ].filter((item) => item.value)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-extrabold text-slate-800">{m.employer_job_preview_general_info()}</h2>
      <dl className="mt-4 space-y-4">
        {rows.map((item) => (
          <div key={item.label} className="flex gap-3">
            <dt className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500">{item.icon}</dt>
            <dd><p className="text-xs text-slate-400">{item.label}</p><p className="mt-0.5 text-sm font-semibold text-slate-700">{item.value}</p></dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function RelatedCategories({ data }) {
  const names = [data.categoryName, ...data.domainNames].filter(Boolean)
  if (!names.length) return null
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-extrabold text-slate-800">{m.employer_job_preview_related_categories()}</h2>
      <div className="mt-3 flex flex-wrap gap-2">{names.map((name) => <Chip key={name} primary>{name}</Chip>)}</div>
    </section>
  )
}

function JobDetailPreview({ data, full = false }) {
  if (!full) {
    return (
      <div className="space-y-3">
        <JobHero data={data} compact />
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <SectionTitle compact>{m.employer_job_preview_job_details()}</SectionTitle>
          <div className="mt-3"><DetailContent data={data} compact /></div>
        </section>
      </div>
    )
  }
  return (
    <div className="bg-slate-100 p-4 sm:p-6">
      <JobHero data={data} />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="border-l-4 border-[var(--brand-primary)] pl-3 text-lg font-extrabold text-slate-800">{m.employer_job_preview_job_details()}</h2>
          <div className="mt-5"><DetailContent data={data} /></div>
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><CompanyMark companyName={data.companyName} large /><p className="min-w-0 text-sm font-extrabold leading-5 text-slate-800">{data.companyName}</p></div>
          </section>
          <GeneralInfo data={data} />
          <RelatedCategories data={data} />
          {data.campaignName && <p className="rounded-xl bg-slate-200/70 px-3 py-2 text-center text-xs text-slate-500">{m.employer_job_preview_campaign({ name: data.campaignName })}</p>}
        </aside>
      </div>
    </div>
  )
}

function JobFormPreview({
  values,
  companyName,
  categoryName,
  domainNames = [],
  campaignName,
  provinces = [],
  skills = [],
  languages = [],
  benefitNames = [],
}) {
  const [previewPage, setPreviewPage] = useState('job-list')
  const [modalOpen, setModalOpen] = useState(false)
  const provinceById = new Map(provinces.map((item) => [item.id, item.name]))
  const skillById = new Map(skills.map((item) => [item.id, item.name]))
  const languageById = new Map(languages.map((item) => [item.id, item.name]))
  const workplaceGroups = (values.work_areas || [])
    .filter((area) => area.province_id)
    .map((area) => ({
      name: provinceById.get(area.province_id) || m.employer_job_preview_work_area_fallback(),
      addresses: (area.workplaces || []).map((item) => item.address_detail?.trim()).filter(Boolean),
    }))
  const provinceNames = workplaceGroups.map((item) => item.name)
  const data = {
    values,
    title: values.title?.trim() || m.employer_job_preview_title_fallback(),
    companyName: companyName || m.employer_job_preview_company_fallback(),
    salary: formatSalary(values),
    locationLabel: provinceNames.join(', ') || m.employer_job_preview_workplaces(),
    experienceLabel: EXPERIENCE_YEARS_LABELS[values.experience_years] || m.employer_job_preview_experience_fallback(),
    educationLabel: EDUCATION_LEVEL_LABELS[values.education_level],
    positionLabel: POSITION_LEVEL_LABELS[values.position_level],
    employmentLabel: EMPLOYMENT_TYPE_LABELS[values.employment_type],
    workTypeLabel: (values.work_types || (values.work_type ? [values.work_type] : []))
      .map((value) => WORK_TYPE_LABELS[value] || value)
      .join(', '),
    genderLabel: GENDER_LABELS[values.gender_requirement],
    age: ageLabel(values),
    categoryName,
    domainNames,
    campaignName,
    benefitNames,
    requiredSkillNames: (values.required_skill_ids || []).map((id) => skillById.get(id)).filter(Boolean),
    preferredSkillNames: (values.preferred_skill_ids || []).map((id) => skillById.get(id)).filter(Boolean),
    languageItems: (values.language_requirements || []).filter((item) => item.language).map((item) => ({
      name: languageById.get(item.language) || m.employer_job_preview_language_fallback(),
      proficiency: PROFICIENCY_LABELS[item.proficiency_level] || '',
    })),
    workplaceGroups,
  }

  return (
    <aside aria-label={m.employer_job_preview_aria()} className="post-job-preview-col hidden 2xl:block">
      <div className="flex max-h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="shrink-0 border-b border-slate-200 bg-white p-3">
          <h2 className="text-sm font-extrabold text-slate-800">{m.employer_job_preview_heading()}</h2>
          <div className="mt-2">
            <span className="text-[11px] font-medium text-slate-500">{m.employer_job_preview_on_page()}</span>
            <div role="radiogroup" aria-label={m.employer_job_preview_placement_aria()} className="post-job-preview-switch mt-1.5">
              {[
                ['job-list', m.employer_job_preview_job_list_page()],
                ['job-detail', m.employer_job_preview_job_details()],
              ].map(([value, label]) => (
                <label key={value} className={`post-job-preview-switch__option${previewPage === value ? ' is-active' : ''}`}>
                  <input
                    type="radio"
                    name="post-job-preview-page"
                    value={value}
                    checked={previewPage === value}
                    onChange={() => setPreviewPage(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="post-job-preview-scroll min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
          {previewPage === 'job-list' ? <JobListPreview data={data} /> : <JobDetailPreview data={data} />}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white p-3">
          <button type="button" onClick={() => setModalOpen(true)} className="w-full rounded-md border border-[var(--brand-primary)] px-3 py-2 text-xs font-bold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary-soft)]">
            {m.employer_job_preview_open_full()}
          </button>
        </div>
      </div>

      <Modal
        open={modalOpen}
        width={1080}
        footer={null}
        title={previewPage === 'job-list' ? m.employer_job_preview_modal_list() : m.employer_job_preview_modal_detail()}
        styles={{ body: { maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', padding: 0 } }}
        onCancel={() => setModalOpen(false)}
      >
        {previewPage === 'job-list' ? <JobListPreview data={data} full /> : <JobDetailPreview data={data} full />}
      </Modal>
    </aside>
  )
}

// Bản xem trước nhận giá trị đã hoãn (useDeferredValue): memo để lần vẽ khẩn cấp khi gõ bỏ qua nó.
export default memo(JobFormPreview)
