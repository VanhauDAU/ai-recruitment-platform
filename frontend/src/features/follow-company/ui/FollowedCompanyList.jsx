import { CompassOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  COMPANY_DIRECTORY_PATH,
  companyDetailPath,
  companyDisplayName,
  CompanyLogo,
} from '@/entities/company'
import { MascotEmpty } from '@/shared/ui/mascot'
import { getFollowedCompanies } from '../api/follow-company.api'
import { followCompanyKeys } from '../api/follow-company.keys'
import { useCompanyFollow } from '../model/use-company-follow'
import '../follow-company.css'

const PAGE_SIZE = 10
const SKELETON_COUNT = 3

function FollowedCompanyRow({ company }) {
  const name = companyDisplayName(company)
  const jobCount = Number(company.active_public_job_count) || 0
  // Dòng đã mang sẵn trạng thái theo dõi nên không đọc lại từng công ty.
  const follow = useCompanyFollow(company.public_id, {
    following: true,
    notify_new_jobs: company.notify_new_jobs,
  })

  return (
    <li className="followed-company">
      <CompanyLogo
        company={company}
        width={56}
        height={56}
        className="h-14 w-14 rounded-lg text-base"
        imageClassName="p-1.5"
      />
      <div className="min-w-0 flex-1">
        <Link
          to={companyDetailPath(company)}
          className="line-clamp-2 text-sm font-bold leading-5 !text-slate-900 hover:!text-[var(--brand-primary)] sm:text-base"
        >
          {name}
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">
          {jobCount > 0
            ? `${jobCount.toLocaleString('vi-VN')} việc làm đang tuyển`
            : 'Chưa có việc làm đang tuyển'}
          {company.followed_at && ` · Theo dõi từ ${new Date(company.followed_at).toLocaleDateString('vi-VN')}`}
        </p>
      </div>
      <div className="followed-company__actions">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            role="switch"
            aria-label={`Nhận email việc làm mới từ ${name}`}
            checked={follow.notifyNewJobs}
            disabled={follow.isPending}
            onChange={(event) => follow.setNotifyNewJobs(event.target.checked)}
          />
          Nhận email việc làm mới
        </label>
        <button
          type="button"
          className="followed-company__unfollow"
          aria-label={`Bỏ theo dõi ${name}`}
          disabled={follow.isPending}
          onClick={() => follow.setFollowing(false)}
        >
          Bỏ theo dõi
        </button>
      </div>
    </li>
  )
}

/** Danh sách công ty ứng viên đang theo dõi, mới theo dõi đứng trước. */
export default function FollowedCompanyList() {
  const [page, setPage] = useState(1)
  const { data, error, isPending, refetch } = useQuery({
    queryKey: followCompanyKeys.followedList(page),
    queryFn: ({ signal }) => getFollowedCompanies({ page, page_size: PAGE_SIZE }, { signal }),
    placeholderData: (previousPage) => previousPage,
  })
  const companies = data?.results || []
  const count = data?.count || 0
  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE))
  // Bỏ theo dõi dòng cuối của trang cuối đẩy trang hiện tại ra ngoài danh sách;
  // nếu việc đó xảy ra ở tab khác thì máy chủ trả 404 cho trang này.
  const pageOutOfRange = data ? page > lastPage : page > 1 && error?.response?.status === 404

  useEffect(() => {
    if (pageOutOfRange) setPage(lastPage)
  }, [lastPage, pageOutOfRange])

  if (isPending || pageOutOfRange) {
    return (
      <div className="space-y-3" aria-label="Đang tải công ty đang theo dõi">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div key={index} className="h-24 motion-safe:animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-xl bg-slate-50 px-3 py-4 text-center" role="alert">
        <p className="text-sm text-slate-500">Chưa thể tải danh sách công ty đang theo dõi.</p>
        <button type="button" onClick={() => refetch()} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800">
          <ReloadOutlined aria-hidden="true" /> Thử lại
        </button>
      </div>
    )
  }
  if (count === 0) {
    return (
      <MascotEmpty
        className="py-6"
        scene="searchJob"
        description={(
          <>
            <p className="text-base font-bold text-gray-800">Bạn chưa theo dõi công ty nào</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-gray-500">
              Theo dõi công ty bạn quan tâm để xem lại nhanh và nhận email khi công ty đăng việc làm mới.
            </p>
          </>
        )}
      >
        <Link
          to={COMPANY_DIRECTORY_PATH}
          className="inline-flex items-center gap-2 rounded-full !bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold !text-white transition hover:!bg-[var(--brand-primary-hover)]"
        >
          <CompassOutlined aria-hidden="true" />
          Khám phá công ty
        </Link>
      </MascotEmpty>
    )
  }

  return (
    <>
      <p className="mb-3 text-sm text-slate-500" role="status">
        {`${count.toLocaleString('vi-VN')} công ty đang theo dõi`}
      </p>
      <ul className="space-y-3">
        {companies.map((company) => <FollowedCompanyRow key={company.public_id} company={company} />)}
      </ul>
      {lastPage > 1 && (
        <nav aria-label="Phân trang công ty đang theo dõi" className="followed-company-pager">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button>
          <span aria-current="page">{`Trang ${page} / ${lastPage}`}</span>
          <button type="button" disabled={page === lastPage} onClick={() => setPage(page + 1)}>Trang sau</button>
        </nav>
      )}
    </>
  )
}
