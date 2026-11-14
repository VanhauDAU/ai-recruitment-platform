import { EyeInvisibleOutlined, LockOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Empty, Result, Skeleton } from 'antd'
import { useParams } from 'react-router'
import { applicationKeys, getPublicApplicationReview } from '@/entities/application'
import { CvDocumentPreview } from '@/entities/cv'
import { ReviewScorecardForm } from '@/features/submit-application-review'
import { usePreviewFitZoom } from '@/shared/hooks/use-preview-fit-zoom'
import { formatDateTime } from '@/shared/lib/date-time'

/** Public page behind a review link: a de-identified CV and a scorecard. */
export default function ApplicationReview() {
  const { token } = useParams()
  const query = useQuery({
    queryKey: applicationKeys.publicReview(token),
    queryFn: () => getPublicApplicationReview(token),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const data = query.data
  const { containerRef, zoom } = usePreviewFitZoom(Boolean(data))

  if (query.isPending) return <div className="mx-auto max-w-6xl p-6"><Skeleton active paragraph={{ rows: 12 }} /></div>
  if (query.isError) {
    return (
      <Result
        status="404"
        title="Link đánh giá không còn hiệu lực"
        subTitle="Link có thể đã hết hạn hoặc bị thu hồi. Hãy liên hệ người đã gửi cho bạn."
      />
    )
  }

  return (
    <main className="min-h-dvh bg-slate-100 px-3 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-emerald-600">{data.company_name} mời bạn đánh giá hồ sơ</p>
          <h1 className="mt-1 text-xl font-black text-slate-900">{data.candidate_name} — {data.job_title}</h1>
          <p className="mt-1 text-xs text-slate-500">Gửi tới {data.reviewer_name} · Hết hạn {formatDateTime(data.expires_at)}</p>
          {data.message && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">“{data.message}”</p>}
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
            <EyeInvisibleOutlined aria-hidden /> Ảnh, email, số điện thoại, địa chỉ và người tham chiếu đã được ẩn để đánh giá khách quan.
          </p>
        </header>
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <section aria-label="CV ứng viên" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:col-span-8">
            {data.cv?.template_renderer_key ? (
              <div ref={containerRef} className="flex w-full justify-center">
                <div className="h-fit origin-top overflow-hidden rounded-sm bg-white shadow-xl shadow-slate-900/10" style={{ zoom }}>
                  <CvDocumentPreview
                    document={{
                      schema_version: data.cv.schema_version,
                      content_json: data.cv.content_json,
                      layout_json: data.cv.layout_json,
                      style_json: data.cv.style_json,
                    }}
                    rendererKey={data.cv.template_renderer_key}
                    assets={data.cv.assets}
                    editorChrome={false}
                  />
                </div>
              </div>
            ) : <Empty description="CV này chưa có bản xem trước" />}
          </section>
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
              <LockOutlined className="text-emerald-600" aria-hidden /> Phiếu đánh giá
            </h2>
            <ReviewScorecardForm token={token} review={data.review} />
          </aside>
        </div>
      </div>
    </main>
  )
}
