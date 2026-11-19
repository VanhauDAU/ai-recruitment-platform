import { SearchOutlined } from '@ant-design/icons'
import { Alert, Empty, Input, Pagination, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { m } from '@/shared/config/i18n'
import ApplicationStatusFilter from './ApplicationStatusFilter'
import CandidateGroup from './CandidateGroup'

export default function ApplicationCandidateList({
  groups,
  applicationCount,
  selectedPublicId,
  keyword,
  status,
  page,
  pageSize,
  loading,
  error,
  onKeywordChange,
  onKeywordSubmit,
  onStatusChange,
  onPageChange,
  onRetry,
  onSelect,
}) {
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())
  const selectedGroupKey = useMemo(
    () => groups.find((group) => group.applications.some((item) => item.public_id === selectedPublicId))?.key,
    [groups, selectedPublicId],
  )

  useEffect(() => {
    const key = selectedGroupKey || groups[0]?.key
    if (!key) return
    setExpandedKeys((current) => current.has(key) ? current : new Set([...current, key]))
  }, [groups, selectedGroupKey])

  function toggleGroup(key) {
    setExpandedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <section
      aria-labelledby="application-candidate-list-title"
      data-testid="application-candidate-list"
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-1 md:col-start-1 md:row-span-2 md:row-start-1 xl:col-span-3 xl:col-start-1 xl:row-span-1 xl:h-full"
    >
      <header className="aw-panel-head">
        <h2 id="application-candidate-list-title" className="aw-panel-title">{m.employer_workspace_app_candidates()}</h2>
        <span className="aw-count">{m.employer_workspace_app_candidate_count({ count: groups.length })} · {m.employer_workspace_app_cv_count({ count: applicationCount })}</span>
      </header>

      <div className="aw-filters border-b border-slate-100 p-3">
        <Input
          aria-label={m.employer_workspace_app_search()}
          allowClear
          value={keyword}
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder={m.employer_workspace_app_search_placeholder()}
          onChange={(event) => {
            onKeywordChange(event.target.value)
            if (!event.target.value) onKeywordSubmit('')
          }}
          onPressEnter={(event) => onKeywordSubmit(event.currentTarget.value)}
        />
        <ApplicationStatusFilter value={status} onChange={onStatusChange} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {loading && <Skeleton active paragraph={{ rows: 9 }} />}
        {!loading && error && (
          <Alert
            showIcon
            type="error"
            message={m.employer_workspace_app_list_load_error()}
            action={<button type="button" className="font-semibold text-red-600" onClick={onRetry}>{m.employer_workspace_retry()}</button>}
          />
        )}
        {!loading && !error && groups.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={m.employer_workspace_app_list_empty()}
            className="py-8"
          />
        )}
        {!loading && !error && groups.length > 0 && (
          <div className="space-y-2">
            {groups.map((group) => (
              <CandidateGroup
                key={group.key}
                group={group}
                expanded={expandedKeys.has(group.key)}
                selectedPublicId={selectedPublicId}
                onToggle={() => toggleGroup(group.key)}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>

      {applicationCount > pageSize && (
        <footer className="flex justify-center border-t border-slate-100 px-2 py-3">
          <Pagination
            simple
            size="small"
            current={page}
            pageSize={pageSize}
            total={applicationCount}
            showSizeChanger={false}
            onChange={onPageChange}
          />
        </footer>
      )}
    </section>
  )
}
