import { SearchOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Pagination, Select, Skeleton } from 'antd'
import { m } from '@/shared/config/i18n'
import ApplicationStatusFilter from './ApplicationStatusFilter'
import CandidateGroup from './CandidateGroup'

const ORDERING_OPTIONS = [
  { value: 'newest', label: m.employer_workspace_app_sort_newest() },
  { value: 'oldest', label: m.employer_workspace_app_sort_oldest() },
  { value: 'name', label: m.employer_workspace_app_sort_name() },
]
const AI_ORDERING_OPTION = { value: 'ai_match', label: m.employer_workspace_app_sort_ai_match() }

/** Cột trái: tìm, lọc theo tin và trạng thái, sắp xếp, rồi danh sách ứng viên. */
export default function ApplicationCandidateList({ workspace, onKeywordSubmit }) {
  const {
    groups, applicationCount, selectedPublicId, keyword, statusFilter, scopeFilter, jobFilter,
    ordering, rankingEnabled, jobOptions, jobOptionsLoading, hasFilters, page, listQuery,
  } = workspace
  const loading = listQuery.isLoading
  const error = listQuery.error

  return (
    <section
      aria-labelledby="application-candidate-list-title"
      data-testid="application-candidate-list"
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-1 md:col-start-1 md:row-span-2 md:row-start-1 xl:col-span-3 xl:col-start-1 xl:row-span-1 xl:h-full"
    >
      <header className="aw-panel-head">
        <h2 id="application-candidate-list-title" className="aw-panel-title">{m.employer_workspace_app_candidates()}</h2>
        {!loading && (
          <span className="aw-panel-meta">
            {m.employer_workspace_app_candidate_count({ count: groups.length })} · {m.employer_workspace_app_cv_count({ count: applicationCount })}
          </span>
        )}
      </header>

      <div className="aw-filters">
        <Input
          className="aw-filters__wide"
          aria-label={m.employer_workspace_app_search()}
          allowClear
          value={keyword}
          prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
          placeholder={m.employer_workspace_app_search_placeholder()}
          onChange={(event) => {
            workspace.setKeyword(event.target.value)
            if (!event.target.value) onKeywordSubmit('')
          }}
          onPressEnter={(event) => onKeywordSubmit(event.currentTarget.value)}
        />
        <Select
          className="aw-filters__wide"
          aria-label={m.employer_workspace_app_filter_job()}
          placeholder={m.employer_workspace_app_all_jobs()}
          allowClear
          value={jobFilter || undefined}
          loading={jobOptionsLoading}
          showSearch
          optionFilterProp="label"
          popupMatchSelectWidth={false}
          options={jobOptions}
          onChange={(value) => workspace.setListFilters({ job: value || '', campaign: '' })}
        />
        <ApplicationStatusFilter status={statusFilter} scope={scopeFilter} onChange={workspace.setListFilters} />
        <Select
          aria-label={m.employer_workspace_app_sort()}
          value={ordering}
          popupMatchSelectWidth={false}
          options={rankingEnabled ? [AI_ORDERING_OPTION, ...ORDERING_OPTIONS] : ORDERING_OPTIONS}
          onChange={(value) => workspace.setListFilters({ ordering: value === 'newest' ? '' : value })}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && <div className="p-3"><Skeleton active avatar paragraph={{ rows: 8 }} /></div>}
        {!loading && error && (
          <div className="p-3">
            <Alert
              showIcon
              type="error"
              message={m.employer_workspace_app_list_load_error()}
              action={<Button size="small" type="text" danger onClick={() => listQuery.refetch()}>{m.employer_workspace_retry()}</Button>}
            />
          </div>
        )}
        {!loading && !error && groups.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_workspace_app_list_empty()} className="py-8">
            {hasFilters && <Button size="small" onClick={workspace.clearFilters}>{m.employer_workspace_app_clear_filters()}</Button>}
          </Empty>
        )}
        {!loading && !error && groups.length > 0 && (
          <ul className="aw-list">
            {groups.map((group) => (
              <CandidateGroup
                key={group.key}
                group={group}
                selectedPublicId={selectedPublicId}
                jobFiltered={Boolean(jobFilter)}
                onSelect={workspace.selectApplication}
              />
            ))}
          </ul>
        )}
      </div>

      {applicationCount > workspace.pageSize && (
        <footer className="flex justify-center border-t border-slate-100 px-2 py-2.5">
          <Pagination
            simple
            size="small"
            current={page}
            pageSize={workspace.pageSize}
            total={applicationCount}
            showSizeChanger={false}
            onChange={workspace.changePage}
          />
        </footer>
      )}
    </section>
  )
}
