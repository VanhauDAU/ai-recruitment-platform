import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Pagination, Select, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  closeEmployerJob,
  deleteEmployerJob,
  duplicateEmployerJob,
  getEmployerJobPage,
  jobKeys,
} from '@/entities/job'
import { useEmployerReadiness } from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import JobListCard from './JobListCard'
import { JOB_STATUS_FILTERS } from './job-list-presentation'

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] }

function JobListSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-label="Đang tải danh sách tin tuyển dụng">
      {[1, 2, 3].map((item) => (
        <div key={item} className="px-4 py-3">
          <Skeleton active avatar={false} paragraph={{ rows: 1 }} />
        </div>
      ))}
    </div>
  )
}

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')
  const queryClient = useQueryClient()
  const status = searchParams.get('status') || ''
  const query = searchParams.get('q') || ''
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const queryParams = useMemo(() => ({
    page,
    ...(status ? { status } : {}),
    ...(query ? { q: query } : {}),
  }), [page, query, status])
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(queryParams),
    queryFn: () => getEmployerJobPage(queryParams),
  })
  const { canAccessCandidateData } = useEmployerReadiness()
  const pageData = jobsQuery.data || EMPTY_PAGE
  const jobs = pageData.results || []

  useEffect(() => setSearchValue(query), [query])

  const invalidate = () => queryClient.invalidateQueries({
    queryKey: ['jobs', 'employer-list'],
  })
  const closeMutation = useMutation({
    mutationFn: closeEmployerJob,
    onSuccess: () => {
      invalidate()
      message.success('Đã đóng tin tuyển dụng.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể đóng tin.')),
  })
  const duplicateMutation = useMutation({
    mutationFn: duplicateEmployerJob,
    onSuccess: () => {
      invalidate()
      message.success('Đã tạo bản nháp sao chép.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể sao chép tin.')),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteEmployerJob,
    onSuccess: () => {
      invalidate()
      message.success('Đã xóa bản nháp.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xóa bản nháp.')),
  })

  function replaceFilters(next) {
    const values = Object.fromEntries(searchParams)
    Object.entries(next).forEach(([key, value]) => {
      if (value) values[key] = String(value)
      else delete values[key]
    })
    if (!Object.hasOwn(next, 'page')) delete values.page
    setSearchParams(values)
  }

  return (
    <section className="pb-5 pt-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
          <div className="mb-2 flex items-center justify-between sm:hidden">
            <span className="text-xs font-medium text-slate-500">
              {pageData.count || 0} tin tuyển dụng
            </span>
            <Link
              className="inline-flex h-8 items-center gap-1.5 rounded-lg !bg-emerald-600 px-3 text-xs font-semibold !text-white hover:!bg-emerald-500"
              to={employerAppPath('/jobs/new')}
            >
              <PlusOutlined aria-hidden /> Đăng tin tuyển dụng
            </Link>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              allowClear
              aria-label="Tìm tin tuyển dụng"
              className="w-full sm:!w-80"
              prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
              placeholder="Tìm theo tên tin, nhấn Enter"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onClear={() => replaceFilters({ q: '' })}
              onPressEnter={() => replaceFilters({ q: searchValue.trim() })}
            />
            <Select
              aria-label="Lọc trạng thái tin tuyển dụng"
              className="!w-full sm:!w-44"
              value={status}
              options={JOB_STATUS_FILTERS}
              onChange={(value) => replaceFilters({ status: value })}
            />
            <span className="ml-auto hidden whitespace-nowrap text-xs font-medium text-slate-500 sm:block">
              {pageData.count || 0} tin tuyển dụng
            </span>
            <Link
              className="hidden h-8 shrink-0 items-center gap-1.5 rounded-lg !bg-emerald-600 px-3 text-xs font-semibold !text-white transition hover:!bg-emerald-500 sm:inline-flex"
              to={employerAppPath('/jobs/new')}
            >
              <PlusOutlined aria-hidden /> Đăng tin tuyển dụng
            </Link>
          </div>
        </div>

        <div className="hidden grid-cols-[minmax(0,1fr)_180px_105px_112px] gap-4 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 lg:grid">
          <span>Tin tuyển dụng</span>
          <span>Ứng viên / CV</span>
          <span>Hiệu quả</span>
          <span className="sr-only">Thao tác</span>
        </div>

        {jobsQuery.isError && (
          <div className="p-3">
            <Alert
              type="error"
              showIcon
              title="Không thể tải danh sách tin tuyển dụng"
              description={getApiErrorMessage(jobsQuery.error, 'Vui lòng thử lại sau.')}
              action={<Button size="small" danger onClick={() => jobsQuery.refetch()}>Thử lại</Button>}
            />
          </div>
        )}

        {jobsQuery.isLoading ? (
          <JobListSkeleton />
        ) : jobs.length === 0 && !jobsQuery.isError ? (
          <div className="py-14">
            <Empty
              description={query || status
                ? 'Không có tin phù hợp với bộ lọc'
                : 'Bạn chưa có tin tuyển dụng nào'}
            >
              {(query || status) ? (
                <Button onClick={() => {
                  setSearchValue('')
                  setSearchParams({})
                }}>
                  Xóa bộ lọc
                </Button>
              ) : (
                <Link
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg !bg-emerald-600 px-4 text-sm font-semibold !text-white transition hover:!bg-emerald-500"
                  to={employerAppPath('/jobs/new')}
                >
                  <PlusOutlined /> Đăng tin đầu tiên
                </Link>
              )}
            </Empty>
          </div>
        ) : (
          <div className="divide-y divide-slate-100" aria-live="polite">
            {jobs.map((job) => (
              <JobListCard
                key={job.public_id}
                job={job}
                candidateDataAccess={canAccessCandidateData}
                closing={closeMutation.isPending && closeMutation.variables === job.public_id}
                deleting={deleteMutation.isPending && deleteMutation.variables === job.public_id}
                duplicating={duplicateMutation.isPending && duplicateMutation.variables === job.public_id}
                onClose={(publicId) => closeMutation.mutate(publicId)}
                onDelete={(publicId) => deleteMutation.mutate(publicId)}
                onDuplicate={(publicId) => duplicateMutation.mutate(publicId)}
              />
            ))}
          </div>
        )}

        {pageData.count > 20 && (
          <div className="flex justify-center border-t border-slate-100 py-3">
            <Pagination
              current={page}
              pageSize={20}
              total={pageData.count}
              showSizeChanger={false}
              onChange={(nextPage) => replaceFilters({ page: nextPage })}
            />
          </div>
        )}
      </div>
    </section>
  )
}
