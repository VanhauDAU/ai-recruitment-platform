import {
  CheckOutlined,
  DownloadOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  StarFilled,
} from '@ant-design/icons'
import { Alert, Button, Skeleton, Switch, message } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCandidateJobPreferences, updateCandidateJobPreferences } from '@/entities/candidate-preferences'
import { CvDocumentPreview, getCv, getCvDraft } from '@/entities/cv'
import { formatLocations, formatSalary, getJobs, jobDetailPath } from '@/entities/job'

function normalizeJobs(response) {
  if (Array.isArray(response)) return response
  return response?.results || []
}

const PREFERENCE_FIELDS = [
  'desired_specialization_ids',
  'desired_position_other',
  'desired_salary_vnd',
  'experience_level',
  'preferred_province_ids',
  'willing_to_relocate',
  'ai_recommendation_consent',
  'recruiter_visibility_consent',
]

function preferencePayload(preferences) {
  return Object.fromEntries(PREFERENCE_FIELDS.filter((field) => field in preferences).map((field) => [field, preferences[field]]))
}

/* ---------- Success banner with tick icon ---------- */
function SuccessBanner() {
  return (
    <div className="flex items-center gap-4">
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#00b14f]/10">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00b14f]">
          <CheckOutlined className="text-lg font-bold text-white" />
        </span>
      </span>
      <div>
        <h1 className="text-xl font-extrabold text-[#00b14f] md:text-2xl">Lưu CV thành công!</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Hồ sơ của bạn đã được cập nhật. Bạn có thể dùng CV này để ứng tuyển ngay.
        </p>
      </div>
    </div>
  )
}

/* ---------- CV preview thumbnail ---------- */
function CvThumbnail({ cv, draft }) {
  const document = {
    schema_version: draft.schema_version,
    content_json: draft.content_json,
    layout_json: draft.layout_json,
    style_json: draft.style_json,
  }
  return (
    <div
      className="mx-auto w-full max-w-[280px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      aria-label="Ảnh xem trước CV vừa lưu"
    >
      <div className="h-[360px] origin-top-left scale-[0.34]" style={{ width: '210mm' }}>
        <CvDocumentPreview
          document={document}
          rendererKey={cv.template_renderer_key || cv.template_version}
          assets={draft.assets || {}}
          editorChrome={false}
          pageLabelVariant="badge"
        />
      </div>
    </div>
  )
}

/* ---------- CV card (left column) ---------- */
function CvCard({ cv, draft, publicId }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <CvThumbnail cv={draft} draft={draft} />
      <h2 className="mt-4 text-center text-lg font-bold text-slate-800">CV của {cv.title}</h2>
      <div className="mt-4 flex justify-center gap-3">
        <Link to={`/cvs/${publicId}/edit`}>
          <Button
            shape="round"
            size="large"
            icon={<EditOutlined />}
            className="!border-[#00b14f] !text-[#00b14f] hover:!bg-[#f0faf4]"
          >
            Chỉnh sửa
          </Button>
        </Link>
        <Button
          type="primary"
          shape="round"
          size="large"
          icon={<DownloadOutlined />}
          className="!bg-[#00b14f] hover:!bg-[#009a43]"
          onClick={() => message.info('Tính năng tải CV sẽ được hoàn thiện ở bước tiếp theo.')}
        >
          Tải về
        </Button>
      </div>
    </div>
  )
}

/* ---------- Recruiter visibility card (right column, top) ---------- */
function VisibilityCard({ preferences, onChange, updating }) {
  const visible = Boolean(preferences?.recruiter_visibility_consent)
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-lg font-extrabold text-slate-800 md:text-xl">
        <span className="text-amber-500">200,000</span> NTD đang tìm kiếm ứng viên mỗi ngày!
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {visible ? (
          <>Tuyệt vời! Hồ sơ của bạn hiện đang mở cho nhà tuyển dụng tìm kiếm. </>
        ) : (
          <>Hãy bật <strong>Cho phép</strong> ngay để không bỏ lỡ những cơ hội nghề nghiệp đầy tiềm năng. </>
        )}
        Xem thêm danh sách các <span className="cursor-pointer font-semibold text-[#00b14f] underline">Nhà tuyển dụng Pro uy tín nhất.</span>
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Switch
          aria-label="Cho phép nhà tuyển dụng tìm kiếm hồ sơ"
          checked={visible}
          loading={updating}
          onChange={onChange}
          className={visible ? '!bg-[#00b14f]' : ''}
        />
        <span className={`text-sm font-bold ${visible ? 'text-[#00b14f]' : 'text-slate-500'}`}>
          {visible ? 'Cho phép NTD tìm kiếm hồ sơ' : 'Chưa cho phép NTD tìm kiếm hồ sơ'}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-500">
        <p>
          Khi bạn cho phép Nhà tuyển dụng (NTD) tìm kiếm hồ sơ, các NTD uy tín có thể tiếp cận thông tin kinh
          nghiệm làm việc, học vấn, kỹ năng… trên CV của bạn.
        </p>
        <p className="flex items-start gap-2">
          <CheckOutlined className="mt-0.5 shrink-0 text-[#00b14f]" />
          <span>Nếu cảm thấy bạn phù hợp, NTD sẽ gửi tới bạn một <strong>Lời mời kết nối.</strong></span>
        </p>
        <p className="flex items-start gap-2">
          <SafetyCertificateOutlined className="mt-0.5 shrink-0 text-[#00b14f]" />
          <span>
            Toàn bộ thông tin định danh cá nhân của bạn như họ tên, ảnh đại diện, số điện thoại, email, địa chỉ
            sẽ không được chia sẻ với NTD cho đến khi bạn xác nhận đồng ý với <strong>Lời mời kết nối</strong> này.
          </span>
        </p>
        <p>
          Bạn luôn có thể thay đổi lại trạng thái cho phép NTD tìm kiếm CV{' '}
          <Link to="/tai-khoan/goi-y-viec-lam" className="font-semibold text-[#00b14f] underline">
            tại đây
          </Link>
          .
        </p>
      </div>
    </section>
  )
}

/* ---------- Single suggested job card ---------- */
function SuggestedJob({ job }) {
  return (
    <Link
      to={jobDetailPath(job)}
      className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#00b14f]/30 hover:shadow-md"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        {job.company_logo_url ? (
          <img src={job.company_logo_url} alt={job.company_name} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-xl font-black text-[#00b14f]">{job.company_name?.charAt(0) || 'P'}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-800 transition group-hover:text-[#00b14f]">
          {job.title}
        </h3>
        <p className="mt-1 truncate text-xs uppercase text-slate-500">{job.company_name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium">{formatSalary(job)}</span>
          {formatLocations(job) && (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium">
              <EnvironmentOutlined className="text-[10px]" />
              {formatLocations(job)}
            </span>
          )}
        </div>
      </div>
      <span className="hidden h-fit shrink-0 items-center gap-1 rounded-full border border-[#00b14f]/40 bg-[#f0faf4] px-2.5 py-1 text-xs font-bold text-[#00b14f] sm:inline-flex">
        <StarFilled className="text-[10px]" /> Rất phù hợp
      </span>
    </Link>
  )
}

/* ---------- Main page component ---------- */
export default function CvSaveSuccess() {
  const { publicId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [updatingVisibility, setUpdatingVisibility] = useState(false)

  useEffect(() => {
    let active = true
    Promise.allSettled([
      Promise.all([getCv(publicId), getCvDraft(publicId)]),
      getCandidateJobPreferences(),
      getJobs({ page_size: 6, ordering: '-published_at' }),
    ]).then(([cvResult, preferencesResult, jobsResult]) => {
      if (!active) return
      if (cvResult.status === 'rejected') {
        setError(true)
        return
      }
      const [cv, draft] = cvResult.value
      setData({
        cv,
        draft,
        preferences: preferencesResult.status === 'fulfilled' ? preferencesResult.value : null,
        jobs: jobsResult.status === 'fulfilled' ? normalizeJobs(jobsResult.value).slice(0, 6) : [],
      })
    })
    return () => {
      active = false
    }
  }, [publicId])

  const changeVisibility = async (checked) => {
    if (!data.preferences) {
      message.info('Bạn có thể thiết lập quyền tìm kiếm hồ sơ trong phần Cài đặt gợi ý việc làm.')
      return
    }
    const previous = data.preferences
    const next = { ...previous, recruiter_visibility_consent: checked }
    setData((current) => ({ ...current, preferences: next }))
    setUpdatingVisibility(true)
    try {
      const saved = await updateCandidateJobPreferences(preferencePayload(next))
      setData((current) => ({ ...current, preferences: saved }))
      message.success(checked ? 'Đã cho phép nhà tuyển dụng tìm kiếm hồ sơ.' : 'Đã tắt quyền tìm kiếm hồ sơ.')
    } catch {
      setData((current) => ({ ...current, preferences: previous }))
      message.error('Không thể cập nhật cài đặt lúc này.')
    } finally {
      setUpdatingVisibility(false)
    }
  }

  useEffect(() => {
    document.title = 'Lưu CV thành công | ProCV'
  }, [])

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert
          showIcon
          type="error"
          title="Không thể tải CV vừa lưu"
          description="Vui lòng quay lại trang quản lý CV và thử lại."
          action={<Link to="/tai-khoan/cv-cua-toi">Quản lý CV</Link>}
        />
      </div>
    )

  if (!data)
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[380px_1fr]">
        <Skeleton active paragraph={{ rows: 14 }} />
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )

  const keyword = data.draft?.content_json?.personal_info?.headline?.trim()

  return (
    <div className="min-h-screen bg-[#f4f5f5] py-6 md:py-8">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-6">
        {/* ---- Left column: Success + CV card + manage link ---- */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-xl border border-[#00b14f]/20 bg-gradient-to-b from-[#e8f8ef] to-white p-5 shadow-sm md:p-6">
            <SuccessBanner />
            <div className="mt-5">
              <CvCard cv={data.cv} draft={data.draft} publicId={publicId} />
            </div>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <Link
              to="/tai-khoan/cv-cua-toi"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#00b14f] py-2.5 text-sm font-bold text-[#00b14f] transition hover:bg-[#f0faf4]"
            >
              Tới trang quản lý CV <ArrowRightOutlined />
            </Link>
          </div>
        </aside>

        {/* ---- Right column: Visibility + Jobs ---- */}
        <main className="min-w-0 space-y-6">
          <VisibilityCard preferences={data.preferences} updating={updatingVisibility} onChange={changeVisibility} />

          <section>
            <h2 className="mb-4 text-lg font-extrabold text-slate-800 md:text-xl">
              Việc làm {keyword && <span className="text-[#00b14f]">&ldquo;{keyword}&rdquo;</span>} phù hợp với CV của bạn
            </h2>
            {data.jobs.length > 0 ? (
              <div className="space-y-3">
                {data.jobs.map((job) => (
                  <SuggestedJob key={job.public_id} job={job} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">
                Chưa có việc làm phù hợp để gợi ý. Hãy quay lại sau nhé.
              </div>
            )}

            {data.jobs.length > 0 && (
              <div className="mt-6 flex justify-center">
                <Link
                  to="/viec-lam"
                  className="inline-flex items-center gap-2 rounded-full border border-[#00b14f] bg-white px-6 py-3 text-sm font-bold text-[#00b14f] shadow-sm transition hover:bg-[#f0faf4]"
                >
                  Việc làm phù hợp với CV của bạn <ArrowRightOutlined />
                </Link>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
