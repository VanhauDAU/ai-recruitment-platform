import {
  ArrowRightOutlined,
  CheckCircleFilled,
  CheckOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StarFilled,
} from '@ant-design/icons'
import { Alert, Button, Skeleton } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { Link } from 'react-router-dom'
import { CvDocumentPreview, getCv, getCvVersion } from '@/entities/cv'
import { formatLocations, formatSalary, getCvJobRecommendations, jobDetailPath } from '@/entities/job'
import { CvDownloadButton } from '@/features/export-cv-pdf'
import { RecruiterVisibilityControl } from '@/features/update-recruiter-visibility'

function displayCvTitle(title) {
  const normalized = (title || '').trim()
  if (!normalized) return 'CV của bạn'
  return /^cv\b/i.test(normalized) ? normalized : `CV của ${normalized}`
}

function versionDocument(version) {
  return {
    schema_version: version.schema_version,
    content_json: version.content_json,
    layout_json: version.layout_json,
    style_json: version.style_json,
  }
}

function SavedVersionImage({ version, title, onError }) {
  const sourceRef = useRef(null)
  const onErrorRef = useRef(onError)
  const [imageUrl, setImageUrl] = useState('')
  onErrorRef.current = onError

  useEffect(() => {
    let active = true
    let objectUrl = ''
    const pendingFrames = new Set()
    const scheduleFrame = (callback) => {
      const requestFrame = globalThis.requestAnimationFrame || globalThis.setTimeout
      const frameId = requestFrame(callback)
      pendingFrames.add(frameId)
      return frameId
    }
    const cancelPendingFrames = () => {
      const cancelFrame = globalThis.cancelAnimationFrame || globalThis.clearTimeout
      pendingFrames.forEach((frameId) => cancelFrame(frameId))
      pendingFrames.clear()
    }
    const waitForNextPaint = () => new Promise((resolve) => {
      scheduleFrame(() => {
        if (!active) return
        scheduleFrame(() => {
          if (active) resolve()
        })
      })
    })
    const capture = async () => {
      try {
        await globalThis.document.fonts?.ready
        if (!active) return
        await waitForNextPaint()
        if (!active) return
        const page = sourceRef.current?.querySelector('.cv-document-preview__page')
        if (!page) throw new Error('CV preview page is unavailable.')
        const images = [...page.querySelectorAll('img')]
        await Promise.allSettled(images.map((image) => image.complete ? image.decode?.() : new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        })))
        if (!active) return
        const blob = await toBlob(page, {
          backgroundColor: '#ffffff',
          cacheBust: false,
          pixelRatio: 1,
          width: page.scrollWidth,
          height: page.scrollHeight,
        })
        if (!active) return
        if (!blob) throw new Error('CV preview image is empty.')
        objectUrl = globalThis.URL.createObjectURL(blob)
        if (active) setImageUrl(objectUrl)
      } catch {
        if (active) onErrorRef.current()
      }
    }
    capture()
    return () => {
      active = false
      cancelPendingFrames()
      if (objectUrl) globalThis.URL.revokeObjectURL(objectUrl)
    }
  }, [version])

  return (
    <>
      {imageUrl ? (
        <img src={imageUrl} alt={`Ảnh xem trước ${title}`} className="h-full w-full object-contain object-top" />
      ) : (
        <div className="w-full px-8 text-center">
          <Skeleton.Image active className="!h-52 !w-full" />
          <p className="mt-4 text-sm font-medium text-slate-400">Đang tạo ảnh từ phiên bản CV vừa lưu…</p>
        </div>
      )}
      <div ref={sourceRef} aria-hidden="true" className="cv-saved-version-capture fixed left-[-10000px] top-0 w-[210mm] bg-white">
        <CvDocumentPreview
          document={versionDocument(version)}
          rendererKey={version.template_renderer_key}
          assets={version.assets}
          editorChrome={false}
          pageLabelVariant="badge"
        />
      </div>
    </>
  )
}

function CvPreviewCard({ cv, version, publicId, previewError, onCaptureError, onRetryPreview }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#16c768] bg-white p-3 shadow-[0_12px_28px_rgba(0,177,79,0.08)]">
      <div className="flex aspect-[210/280] items-center justify-center overflow-hidden rounded-lg bg-[#f8fafb]">
        {version && !previewError ? (
          <SavedVersionImage version={version} title={cv.title} onError={onCaptureError} />
        ) : previewError ? (
          <div className="max-w-xs px-6 text-center">
            <p className="font-bold text-slate-600">Chưa thể tạo ảnh xem trước</p>
            <p className="mt-2 text-sm leading-5 text-slate-400">Không thể tải phiên bản vừa lưu. CV vẫn được lưu an toàn.</p>
            <Button className="mt-4 !border-[#00b14f] !font-bold !text-[#00b14f]" icon={<ReloadOutlined />} onClick={onRetryPreview}>
              Tải lại bản xem trước
            </Button>
          </div>
        ) : (
          <div className="w-full px-8 text-center">
            <Skeleton.Image active className="!h-52 !w-full" />
            <p className="mt-4 text-sm font-medium text-slate-400">Đang tải phiên bản CV vừa lưu…</p>
          </div>
        )}
      </div>
      <h2 className="mt-5 text-center text-xl font-extrabold text-[#26384a]">{displayCvTitle(cv.title)}</h2>
      <div className="mt-4 flex flex-wrap justify-center gap-3 pb-2">
        <Link to={`/cvs/${publicId}/edit?mode=edit`}>
          <Button shape="round" size="large" icon={<EditOutlined />} className="!border-[#00b14f] !font-bold !text-[#00b14f] hover:!bg-emerald-50">
            Chỉnh sửa
          </Button>
        </Link>
        <CvDownloadButton publicId={publicId} versionPublicId={version?.public_id || cv.latest_version_public_id} title={cv.title} />
      </div>
    </div>
  )
}

function VisibilityCard({ publicId }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-[0_2px_14px_rgba(15,23,42,0.05)] md:p-7">
      <h2 className="text-xl font-extrabold leading-snug text-[#26384a] md:text-2xl">200,000 NTD đang tìm kiếm ứng viên mỗi ngày!</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
        Hãy bật Cho phép ngay để không bỏ lỡ những cơ hội nghề nghiệp đầy tiềm năng.
        <Link to="/viec-lam" className="ml-1 font-semibold text-[#00b14f] underline">Khám phá nhà tuyển dụng uy tín.</Link>
      </p>
      <div className="mt-4"><RecruiterVisibilityControl cvPublicId={publicId} /></div>
      <div className="mt-5 space-y-2 text-sm leading-6 text-slate-500 md:text-base">
        <p>Khi cho phép, nhà tuyển dụng uy tín có thể tiếp cận kinh nghiệm làm việc, học vấn và kỹ năng trên CV của bạn.</p>
        <p className="flex items-start gap-2"><CheckOutlined className="mt-1 text-[#00b14f]" /><span>Nếu phù hợp, nhà tuyển dụng sẽ gửi cho bạn một <strong>Lời mời kết nối.</strong></span></p>
        <p className="flex items-start gap-2"><SafetyCertificateOutlined className="mt-1 text-[#00b14f]" /><span>Họ tên, ảnh đại diện, số điện thoại, email và địa chỉ chỉ được chia sẻ sau khi bạn đồng ý lời mời.</span></p>
        <p>Bạn có thể thay đổi lại quyền này bất cứ lúc nào trong phần cài đặt tài khoản.</p>
      </div>
    </section>
  )
}

function JobCard({ job }) {
  const compatibility = job.is_high_match ? 'Rất phù hợp' : `${job.match_score}% phù hợp`
  return (
    <Link to={jobDetailPath(job)} className="group relative flex gap-4 overflow-hidden rounded-2xl border border-white !bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_28px_rgba(0,177,79,0.12)] md:items-center">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white md:h-24 md:w-24">
        {job.company_logo_url ? <img src={job.company_logo_url} alt="" className="h-full w-full object-contain p-2" /> : <span className="text-2xl font-black text-[#00b14f]">{job.company_name?.charAt(0) || 'P'}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-base font-extrabold leading-6 text-[#26384a] transition group-hover:text-[#00b14f]">{job.title}</h3>
        <p className="mt-1 truncate text-sm uppercase text-slate-500">{job.company_name}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-md bg-[#f1f3f5] px-3 py-1">{formatSalary(job)}</span>
          {formatLocations(job) && <span className="inline-flex items-center gap-1 rounded-md bg-[#f1f3f5] px-3 py-1"><EnvironmentOutlined />{formatLocations(job)}</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-bold ${job.is_high_match ? 'border-emerald-300 bg-emerald-50 text-[#00b14f]' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <StarFilled /> {compatibility}
          </span>
          {job.match_details?.map((detail) => (
            <span key={detail.code} className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
              {detail.label} +{detail.points}
            </span>
          ))}
        </div>
        <span className="mt-3 inline-flex items-center justify-center rounded-full bg-[#00b14f] px-5 py-2 text-sm font-bold text-white shadow-sm transition group-hover:bg-[#009643] md:absolute md:bottom-4 md:right-4 md:mt-0 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
          Ứng tuyển
        </span>
      </div>
    </Link>
  )
}

export default function CvSaveSuccessView({ publicId, savedCv = null, savedVersion = null }) {
  const [cv, setCv] = useState(savedCv)
  const [version, setVersion] = useState(savedVersion)
  const [recommendations, setRecommendations] = useState(null)
  const [error, setError] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [previewRetry, setPreviewRetry] = useState(0)

  useEffect(() => {
    let active = true
    getCv(publicId).then((value) => {
      if (active) setCv(value)
    }).catch(() => {
      if (active && !savedCv) setError(true)
    })
    getCvJobRecommendations(publicId).then((value) => {
      if (active) setRecommendations(value)
    }).catch(() => {
      if (active) setRecommendations({ results: [], related_positions: [], focus_keyword: '' })
    })
    return () => { active = false }
  }, [publicId, savedCv])

  useEffect(() => {
    if (version || !cv?.latest_version_public_id) return undefined
    let active = true
    setPreviewError(false)
    getCvVersion(publicId, cv.latest_version_public_id).then((value) => {
      if (active) setVersion(value)
    }).catch(() => {
      if (active) setPreviewError(true)
    })
    return () => { active = false }
  }, [cv?.latest_version_public_id, previewRetry, publicId, version])

  if (error) return <div className="mx-auto max-w-3xl px-4 py-16"><Alert showIcon type="error" title="Không thể tải CV vừa lưu" description="Vui lòng quay lại trang quản lý CV và thử lại." action={<Link to="/tai-khoan/cv-cua-toi">Quản lý CV</Link>} /></div>
  if (!cv) return <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-8 lg:grid-cols-[410px_1fr]"><Skeleton active paragraph={{ rows: 16 }} /><Skeleton active paragraph={{ rows: 14 }} /></div>

  const jobs = recommendations || { results: [], related_positions: [], focus_keyword: '' }
  const viewAllPath = jobs.focus_keyword ? `/viec-lam?search=${encodeURIComponent(jobs.focus_keyword)}` : '/viec-lam'
  return (
    <div className="min-h-screen bg-[#f3f5f7] py-6 md:py-8">
      <div className="mx-auto grid max-w-[1180px] gap-6 px-4 lg:grid-cols-[410px_minmax(0,1fr)] lg:px-0">
        <aside className="h-fit lg:sticky lg:top-24">
          <div className="rounded-2xl bg-gradient-to-b from-[#e7fbf1] via-white to-white p-5 shadow-[0_3px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-4 px-1 py-2">
              <CheckCircleFilled className="text-6xl text-[#00b14f]" />
              <div><h1 className="text-2xl font-extrabold text-[#00a848]">Lưu CV thành công!</h1><p className="mt-1 leading-6 text-slate-600">Hồ sơ của bạn đã được cập nhật. Bạn có thể dùng CV này để ứng tuyển ngay.</p></div>
            </div>
            <div className="mt-5"><CvPreviewCard cv={cv} version={version} publicId={publicId} previewError={previewError} onCaptureError={() => setPreviewError(true)} onRetryPreview={() => {
                setPreviewError(false)
                if (!version) setPreviewRetry((value) => value + 1)
              }} /></div>
            <Link to="/tai-khoan/cv-cua-toi" className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#00b14f] bg-white py-3 font-bold text-[#00b14f] transition hover:bg-emerald-50">Tới trang quản lý CV <ArrowRightOutlined /></Link>
          </div>
        </aside>

        <main className="min-w-0 space-y-7">
          <VisibilityCard publicId={publicId} />
          <section>
            <h2 className="mb-4 text-2xl font-extrabold text-[#26384a]">Việc làm {jobs.focus_keyword && <>&ldquo;{jobs.focus_keyword}&rdquo; </>}phù hợp với CV của bạn</h2>
            {!recommendations ? <Skeleton active paragraph={{ rows: 5 }} /> : jobs.results.length ? <div className="space-y-4">{jobs.results.map((job) => <JobCard key={job.public_id} job={job} />)}</div> : <div className="rounded-2xl bg-white p-10 text-center text-slate-500">Chưa có việc làm đủ phù hợp. Hệ thống sẽ tiếp tục cập nhật cho bạn.</div>}
            <div className="mt-6 flex justify-center"><Link to={viewAllPath} className="inline-flex items-center gap-2 rounded-full border-2 border-[#00b14f] bg-white px-7 py-3 font-bold text-[#00b14f] transition hover:bg-emerald-50">Việc làm phù hợp với CV của bạn <ArrowRightOutlined /></Link></div>
          </section>
          {jobs.related_positions.length > 0 && (
            <section className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
              <h2 className="text-xl font-extrabold text-[#26384a]">Vị trí có thể bạn quan tâm</h2>
              <div className="mt-4 flex flex-wrap gap-3">{jobs.related_positions.map((position) => <Link key={position.label} to={`/viec-lam?search=${encodeURIComponent(position.search)}`} className="rounded-full border border-slate-200 bg-[#f8fafb] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#00b14f] hover:bg-emerald-50 hover:text-[#00b14f]">{position.label}</Link>)}</div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
