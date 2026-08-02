import {
  DownOutlined,
  FileTextOutlined,
  LockOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Alert, Empty, Input, Pagination, Select, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { RECRUITER_APPLICATION_STATUSES } from '@/entities/application'
import { formatApplicationDate } from '../model/application-workspace'
import ApplicationStatusBadge from './ApplicationStatusBadge'

function initialsOf(name) {
  const words = (name || 'UV').trim().split(/\s+/).filter(Boolean)
  return words.slice(-2).map((word) => word[0]).join('').toLocaleUpperCase('vi-VN') || 'UV'
}

function CandidateGroup({ group, expanded, selectedPublicId, onToggle, onSelect }) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Thu gọn' : 'Mở'} hồ sơ của ${group.candidateName}`}
        onClick={onToggle}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
          {initialsOf(group.candidateName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <strong className="truncate text-sm text-slate-900">{group.candidateName}</strong>
            {group.restricted && <LockOutlined title="Tài khoản bị hạn chế" className="shrink-0 text-amber-500" />}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {group.candidateEmail || 'Chưa có email'}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[11px] font-semibold text-slate-500">
            {group.applications.length} CV
          </span>
          <DownOutlined className={`mt-1.5 text-[10px] text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-slate-100 bg-slate-50/70 p-1.5">
          {group.applications.map((application, index) => {
            const selected = application.public_id === selectedPublicId
            const cvTitle = application.submitted_cv_title || application.cv_title || 'CV ứng viên'
            const submissionNumber = group.applications.length - index
            return (
              <button
                key={application.public_id}
                type="button"
                aria-current={selected ? 'true' : undefined}
                aria-label={`Xem ${cvTitle} của ${group.candidateName}`}
                className={`w-full rounded-xl border p-2.5 text-left transition ${
                  selected
                    ? 'border-slate-300 bg-white shadow-sm'
                    : 'border-transparent hover:border-slate-200 hover:bg-white'
                }`}
                onClick={() => onSelect(application)}
              >
                <span className="flex items-start gap-2">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>
                    <FileTextOutlined aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <strong className="line-clamp-2 text-xs leading-5 text-slate-700">
                        {cvTitle}
                      </strong>
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400">Lần {submissionNumber}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {application.job_title || 'Tin tuyển dụng'}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                      <ApplicationStatusBadge status={application.status} />
                      <span className="text-[10px] text-slate-400">
                        {formatApplicationDate(application.applied_at || application.submitted_at)}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </article>
  )
}

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
      <header className="border-b border-slate-100 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="application-candidate-list-title" className="text-base font-bold text-slate-900">
            Ứng viên
          </h2>
          <span className="text-xs font-medium text-slate-500">{groups.length} người · {applicationCount} CV</span>
        </div>
      </header>

      <div className="space-y-2 border-b border-slate-100 p-3">
        <Input.Search
          aria-label="Tìm ứng viên hoặc CV"
          allowClear
          value={keyword}
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Tên, email hoặc tên CV"
          onChange={(event) => onKeywordChange(event.target.value)}
          onSearch={onKeywordSubmit}
        />
        <Select
          aria-label="Lọc trạng thái hồ sơ"
          allowClear
          className="w-full"
          value={status || undefined}
          placeholder="Tất cả trạng thái"
          options={RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label }))}
          onChange={onStatusChange}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {loading && <Skeleton active paragraph={{ rows: 9 }} />}
        {!loading && error && (
          <Alert
            showIcon
            type="error"
            message="Không thể tải danh sách CV"
            action={<button type="button" className="font-semibold text-red-600" onClick={onRetry}>Thử lại</button>}
          />
        )}
        {!loading && !error && groups.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không tìm thấy CV phù hợp"
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
