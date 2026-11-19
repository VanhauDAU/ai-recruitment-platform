import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { arrayMove } from '@dnd-kit/sortable'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Input, Skeleton } from 'antd'
import { useState } from 'react'
import { employerCompanyPageKeys, getEmployerPinnableJobs } from '@/entities/company/employer-company-page'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { getIntlLocale, m } from '@/shared/config/i18n'

function publishedLabel(job) {
  const date = job.published_at ? new Date(job.published_at) : null
  return date && !Number.isNaN(date.getTime()) ? m.employer_company_pinned_published({ date: date.toLocaleDateString(getIntlLocale()) }) : ''
}

/**
 * Tin ghim lên đầu danh sách việc làm của trang công ty. `jobs` là các tin đang
 * ghim theo đúng thứ tự; `onChange` nhận danh sách mã mới (đổi chỗ, bỏ ghim),
 * `onPick` nhận tin vừa chọn từ kết quả tìm kiếm.
 */
export default function PinnedJobsPicker({ jobs, max, disabled = false, onChange, onPick }) {
  const [searching, setSearching] = useState(false)
  const [keyword, setKeyword] = useState('')
  const q = useDebouncedValue(keyword.trim(), 300)
  const ids = jobs.map((job) => job.public_id)
  const full = jobs.length >= max
  const query = useQuery({
    queryKey: employerCompanyPageKeys.pinnableJobs(q),
    queryFn: ({ signal }) => getEmployerPinnableJobs(q, { signal }),
    enabled: searching && !disabled,
    placeholderData: keepPreviousData,
  })
  const results = query.data || []

  return (
    <div className="company-pinned-jobs">
      <p className="company-layout-hint">
        {m.employer_company_pinned_hint({ count: jobs.length, max })}
      </p>
      {jobs.length > 0 && (
        <ol className="company-section-list" aria-label={m.employer_company_pinned_list()}>
          {jobs.map((job, index) => (
            <li key={job.public_id} className="company-section-row">
              <span className="company-section-row__title company-section-row__body">{job.title}</span>
              <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label={m.employer_company_section_move_up({ title: job.title })} disabled={disabled || index === 0} onClick={() => onChange(arrayMove(ids, index, index - 1))} />
              <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label={m.employer_company_section_move_down({ title: job.title })} disabled={disabled || index === jobs.length - 1} onClick={() => onChange(arrayMove(ids, index, index + 1))} />
              <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={m.employer_company_pinned_unpin({ title: job.title })} disabled={disabled} onClick={() => onChange(ids.filter((id) => id !== job.public_id))} />
            </li>
          ))}
        </ol>
      )}
      {full && <p className="company-layout-hint">{m.employer_company_pinned_full({ max })}</p>}

      {searching && !disabled ? (
        <div className="company-pinned-search">
          <Input
            allowClear
            autoFocus
            prefix={<SearchOutlined aria-hidden="true" />}
            placeholder={m.employer_company_pinned_search_placeholder()}
            aria-label={m.employer_company_pinned_search_label()}
            maxLength={120}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          {query.isPending && <Skeleton active title={false} paragraph={{ rows: 2 }} />}
          {query.isError && (
            <p className="company-layout-hint" role="alert">
              {m.employer_company_pinned_load_error()}{' '}
              <Button type="link" size="small" onClick={() => query.refetch()}>{m.employer_company_retry()}</Button>
            </p>
          )}
          {query.isSuccess && results.length === 0 && (
            <p className="company-layout-hint">{m.employer_company_pinned_empty()}</p>
          )}
          {results.length > 0 && (
            <ul className="company-section-list" aria-label={m.employer_company_pinned_results()}>
              {results.map((job) => {
                const pinned = ids.includes(job.public_id)
                return (
                  <li key={job.public_id} className="company-section-row">
                    <div className="company-section-row__body">
                      <span className="company-section-row__title">{job.title}</span>
                      <span className="company-layout-hint">{publishedLabel(job)}</span>
                    </div>
                    <Button size="small" disabled={pinned || full} aria-label={m.employer_company_pinned_pin_label({ title: job.title })} onClick={() => onPick(job)}>
                      {pinned ? m.employer_company_pinned_done() : m.employer_company_pinned_pin()}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          <Button type="link" size="small" onClick={() => setSearching(false)}>{m.employer_company_pinned_close_search()}</Button>
        </div>
      ) : (
        <Button icon={<PlusOutlined aria-hidden="true" />} disabled={disabled || full} onClick={() => setSearching(true)}>{m.employer_company_pinned_add()}</Button>
      )}
    </div>
  )
}
