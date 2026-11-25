import { SearchOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Pagination, Select, Skeleton } from 'antd'
import { lazy, Suspense, useState } from 'react'
import { durationText, educationLevelLabel, FitScoreChip } from '@/entities/application/job-fit'
import { getEmployerJobPage, jobKeys } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { MascotEmpty } from '@/shared/ui/mascot'
import { candidateSearchKeys, searchCandidates } from '../api/candidate-search.api'
import { candidateStateLabel } from '../model/invitation-state'
import './candidate-search.css'

const CandidateQuickView = lazy(() => import('./CandidateQuickView'))

const EXPERIENCE_OPTIONS = [12, 24, 36, 60].map((months) => ({
  value: months,
  label: m.employer_workspace_search_min_experience({ years: months / 12 }),
}))
const EDUCATION_OPTIONS = ['high_school', 'intermediate', 'college', 'university', 'postgraduate'].map((level) => ({
  value: level,
  label: m.employer_workspace_search_min_education({ level: educationLevelLabel(level) }),
}))

function CandidateRow({ candidate, onOpen }) {
  const facts = [
    candidate.experience_months != null && durationText(candidate.experience_months),
    educationLevelLabel(candidate.education_level),
  ].filter(Boolean)
  const stateLabel = candidateStateLabel(candidate)
  return (
    <li className="cs-row">
      <div className="cs-row__main">
        <p className="cs-row__title">
          {candidate.title || m.employer_workspace_search_title_unknown()}
          <span className="cs-row__code">{candidate.code}</span>
        </p>
        <p className="cs-row__facts">{facts.join(' · ') || m.employer_workspace_search_no_facts()}</p>
        {candidate.matched_skills.length > 0 && (
          <p className="cs-row__skills">
            {m.employer_workspace_search_matched_skills({
              matched: candidate.matched_skill_count,
              total: candidate.job_skill_count,
            })}{' '}
            {candidate.matched_skills.join(', ')}
          </p>
        )}
      </div>
      <div className="cs-row__side">
        <FitScoreChip status="ready" score={candidate.score} level={candidate.level} />
        {stateLabel && (
          <span className="cs-state" data-state={candidate.applied ? 'applied' : candidate.invitation_status}>
            {stateLabel}
          </span>
        )}
        <Button size="small" onClick={() => onOpen(candidate)}>{m.employer_workspace_search_quick_view()}</Button>
      </div>
    </li>
  )
}

/**
 * Tìm CV: chọn một tin đang tuyển, hệ thống xếp các ứng viên đang bật "cho phép NTD tìm
 * kiếm" theo mức phù hợp với tin. Kết quả ẩn danh; bước tiếp theo là gửi lời mời kết nối,
 * ứng viên đồng ý thì NTD nhắn tin được (nhắn tin chưa làm).
 */
export default function CandidateSearchWorkspace({ jobPublicId, onJobChange }) {
  const [keywordInput, setKeywordInput] = useState('')
  const keyword = useDebouncedValue(keywordInput.trim(), 400)
  const [minMonths, setMinMonths] = useState()
  const [education, setEducation] = useState()
  const signature = `${jobPublicId}|${keyword}|${minMonths}|${education}`
  const [pageState, setPageState] = useState({ signature, page: 1 })
  const page = pageState.signature === signature ? pageState.page : 1
  const [opened, setOpened] = useState(null)

  const jobParams = { status: 'active', page_size: 100 }
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(jobParams),
    queryFn: () => getEmployerJobPage(jobParams),
  })
  const jobs = jobsQuery.data?.results || []
  const params = {
    job: jobPublicId,
    page,
    ...(keyword ? { q: keyword } : {}),
    ...(minMonths ? { min_months: minMonths } : {}),
    ...(education ? { education } : {}),
  }
  const searchQuery = useQuery({
    queryKey: candidateSearchKeys.list(params),
    queryFn: () => searchCandidates(params),
    enabled: Boolean(jobPublicId),
    placeholderData: keepPreviousData,
  })
  const data = searchQuery.data || { count: 0, page_size: 20, results: [] }
  const filtered = Boolean(keyword || minMonths || education)

  function clearFilters() {
    setKeywordInput('')
    setMinMonths(undefined)
    setEducation(undefined)
  }

  return (
    <div className="cs-workspace">
      <div className="cs-toolbar">
        <Select
          className="cs-toolbar__job"
          aria-label={m.employer_workspace_search_job_aria()}
          placeholder={m.employer_workspace_search_job_placeholder()}
          loading={jobsQuery.isPending}
          value={jobPublicId || undefined}
          options={jobs.map((job) => ({ value: job.public_id, label: job.title }))}
          onChange={onJobChange}
          showSearch
          optionFilterProp="label"
        />
        <Input
          allowClear
          aria-label={m.employer_workspace_search_keyword_aria()}
          prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
          placeholder={m.employer_workspace_search_keyword_placeholder()}
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <Select
          allowClear
          aria-label={m.employer_workspace_search_experience_aria()}
          placeholder={m.employer_workspace_search_experience_placeholder()}
          value={minMonths}
          options={EXPERIENCE_OPTIONS}
          onChange={setMinMonths}
        />
        <Select
          allowClear
          aria-label={m.employer_workspace_search_education_aria()}
          placeholder={m.employer_workspace_search_education_placeholder()}
          value={education}
          options={EDUCATION_OPTIONS}
          onChange={setEducation}
        />
      </div>

      {!jobPublicId ? (
        <MascotEmpty className="py-12" size={120} description={m.employer_workspace_search_pick_job()} />
      ) : searchQuery.isError ? (
        <Alert
          showIcon
          type={searchQuery.error?.response?.status === 409 ? 'info' : 'error'}
          title={getApiErrorMessage(searchQuery.error, m.employer_workspace_search_load_failed())}
          action={<Button size="small" onClick={() => searchQuery.refetch()}>{m.employer_workspace_search_retry()}</Button>}
        />
      ) : searchQuery.isLoading ? (
        <div aria-label={m.employer_workspace_search_loading_aria()}><Skeleton active paragraph={{ rows: 6 }} /></div>
      ) : data.results.length === 0 ? (
        <div className="py-10">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={filtered ? m.employer_workspace_search_no_match() : m.employer_workspace_search_empty()}
          >
            {filtered && <Button onClick={clearFilters}>{m.employer_workspace_search_clear_filters()}</Button>}
          </Empty>
        </div>
      ) : (
        <div className={searchQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <p className="cs-count">{m.employer_workspace_search_count({ count: data.count })}</p>
          <ul className="cs-list">
            {data.results.map((candidate) => (
              <CandidateRow key={candidate.ref} candidate={candidate} onOpen={setOpened} />
            ))}
          </ul>
          {data.count > data.page_size && (
            <div className="flex justify-center pt-3 sm:justify-end">
              <Pagination
                size="small"
                current={page}
                pageSize={data.page_size}
                total={data.count}
                showSizeChanger={false}
                onChange={(next) => setPageState({ signature, page: next })}
              />
            </div>
          )}
        </div>
      )}

      {opened && (
        <Suspense fallback={null}>
          <CandidateQuickView candidate={opened} jobPublicId={jobPublicId} onClose={() => setOpened(null)} />
        </Suspense>
      )}
    </div>
  )
}
