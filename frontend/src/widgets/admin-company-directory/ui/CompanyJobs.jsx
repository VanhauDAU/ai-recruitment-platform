import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Select, Table } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminJobKeys,
  getAdminJobs,
  JOB_SCOPE_OPTIONS,
} from '@/entities/admin-job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { CompanyPanel } from './CompanyPanel'
import { createCompanyJobColumns } from './CompanyJobColumns'

const EMPTY_PAGE = { count: 0, results: [] }
const DEFAULT_ORDERING = '-created_at'

function scopeParams(scope) {
  if (!scope || scope === 'all') return {}
  if (scope === 'expired' || scope === 'held') return { scope }
  return { status: scope }
}

export default function CompanyJobs({ company, enabled }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('company_job_page') || 1) || 1
  const scope = searchParams.get('company_job_scope') || 'all'
  const query = searchParams.get('company_job_q') || ''
  const ordering = searchParams.get('company_job_ordering') || DEFAULT_ORDERING
  const [searchInput, setSearchInput] = useState(query)
  const params = {
    company: company.public_id,
    page,
    ordering,
    ...scopeParams(scope),
    ...(query && { q: query }),
  }
  const jobsQuery = useQuery({
    queryKey: adminJobKeys.list(params),
    queryFn: ({ signal }) => getAdminJobs(params, { signal }),
    enabled,
  })
  const jobs = jobsQuery.data || EMPTY_PAGE

  useEffect(() => setSearchInput(query), [query])

  function updateParams(changes, { resetPage = true } = {}) {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('company_job_page')
    setSearchParams(next)
  }

  function openJob(job) {
    navigate(adminPath(`/job-moderation/${job.public_id}`), {
      state: {
        origin: {
          pathname: location.pathname,
          search: location.search,
          label: company.company_name,
        },
      },
    })
  }

  if (!enabled) {
    return (
      <Alert
        showIcon
        type="warning"
        title="Bạn chưa có quyền xem tin tuyển dụng của công ty"
        description="Cần quyền job_moderation.view để mở danh sách và chi tiết tin tuyển dụng."
      />
    )
  }

  return (
    <CompanyPanel
      title={`Tin tuyển dụng (${jobs.count})`}
      description="Toàn bộ tin do các nhà tuyển dụng thuộc công ty đăng, bao gồm cả tin nháp, chờ duyệt, đang tuyển và đã kết thúc."
    >
      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(240px,2fr)_minmax(210px,1fr)]">
        <Input.Search
          allowClear
          aria-label="Tìm tin tuyển dụng của công ty"
          enterButton="Tìm"
          onChange={(event) => setSearchInput(event.target.value)}
          onSearch={(value) => updateParams({ company_job_q: value.trim() })}
          placeholder="Tên tin, NTD, email hoặc mã tin"
          value={searchInput}
        />
        <Select
          aria-label="Lọc trạng thái tin tuyển dụng của công ty"
          value={scope}
          options={JOB_SCOPE_OPTIONS}
          onChange={(value) => updateParams({
            company_job_scope: value === 'all' ? null : value,
          })}
        />
      </div>
      {jobsQuery.isError && (
        <Alert
          action={<Button onClick={() => jobsQuery.refetch()}>Thử lại</Button>}
          className="mb-4"
          description={getApiErrorMessage(jobsQuery.error)}
          showIcon
          title="Không thể tải tin tuyển dụng của công ty"
          type="error"
        />
      )}
      <Table
        columns={createCompanyJobColumns({ ordering, openJob })}
        dataSource={jobs.results}
        loading={jobsQuery.isLoading}
        locale={{ emptyText: <Empty description="Công ty chưa có tin tuyển dụng phù hợp" /> }}
        onChange={(pagination, _, sorter) => {
          const field = sorter.columnKey || sorter.field
          const nextOrdering = sorter.order
            ? `${sorter.order === 'descend' ? '-' : ''}${field}`
            : DEFAULT_ORDERING
          updateParams({
            company_job_page: pagination.current,
            company_job_ordering: nextOrdering === DEFAULT_ORDERING ? null : nextOrdering,
          }, { resetPage: false })
        }}
        pagination={{
          current: page,
          pageSize: 20,
          showSizeChanger: false,
          total: jobs.count,
        }}
        rowKey="public_id"
        scroll={{ x: 1500 }}
      />
    </CompanyPanel>
  )
}
