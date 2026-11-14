import { ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Drawer, Empty, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { CvTemplateCard, TemplateColorSwatches, cvLanguage, getCvTemplate, getRelatedCvTemplates, templateColors } from '@/entities/cv-template'
import { useLoginPrompt } from '@/features/auth'
import { CvSourcePanel, CvSourcePreview, UseTemplateModal, useCvSource } from '@/features/create-cv-from-template'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import { catalogLocaleFromPath, catalogPathForCategory } from './locale-paths'
import { templateHeading } from './model/template-selection-params'
import { useTemplateSelection } from './model/use-template-selection'

const DETAIL_STALE_MS = 5 * 60_000
const editorPath = (cv) => `/cvs/${cv.public_id}/edit?mode=create`

// Phần trang cần mẫu đã tải: lựa chọn (URL) → nội dung, tiêu đề, preview, tạo CV.
function TemplateWorkspace({ template, colors, locale, basePath, selection, update, hasQuery }) {
  const navigate = useNavigate()
  const { promptLogin } = useLoginPrompt()
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeColor = colors.find((color) => color.slug === selection.colorSlug) || colors[0]
  const cv = useCvSource({
    template,
    locale,
    selection,
    onSelectionChange: update,
    themeColor: activeColor?.hex_code,
    onCreated: (created) => navigate(editorPath(created)),
    onRequireLogin: promptLogin,
  })
  const heading = templateHeading({
    templateName: template.display_name,
    source: cv.source,
    positionLabel: cv.position?.display_name || cv.position?.name_vi,
    language: cv.source === 'sample' ? cv.sampleLocale : locale,
  })
  const localeLabel = cvLanguage(locale).inlineLabel
  useDocumentMetadata({
    title: heading,
    description: template.seo_description || template.description || `Xem trước và tạo CV ${localeLabel} với mẫu ${template.display_name} chuyên nghiệp.`,
    // Mọi biến thể lựa chọn trỏ về trang mẫu gốc; trang có query không lập chỉ mục.
    canonicalPath: `${basePath}/chi-tiet/${template.slug}`,
    imageUrl: template.preview_url || template.thumbnail_url,
    ...(hasQuery ? { robots: 'noindex, follow' } : {}),
  })
  useEffect(() => {
    globalThis.document.body.classList.add('has-bottom-action-bar')
    return () => globalThis.document.body.classList.remove('has-bottom-action-bar')
  }, [])
  const category = template.categories?.[0]
  const createLabel = cv.submitting ? 'Đang xử lý…' : cv.source === 'upload' ? 'Phân tích và tạo CV' : 'Tạo CV'

  return <>
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-medium text-slate-500">
      <Link to="/" className="transition hover:text-[var(--brand-primary)]">Trang chủ</Link>
      <span className="text-slate-400">/</span>
      <Link to={basePath} className="transition hover:text-[var(--brand-primary)]">Mẫu CV {localeLabel}</Link>
      {category && <>
        <span className="text-slate-400">/</span>
        <Link to={catalogPathForCategory(basePath, category.slug)} className="transition hover:text-[var(--brand-primary)]">{category.name}</Link>
      </>}
      <span className="text-slate-400">/</span>
      <span className="font-semibold text-slate-800">{heading}</span>
    </nav>

    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl md:text-3xl">{heading}</h1>
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1.5 lg:mx-0 lg:px-1.5">
        <span className="shrink-0 text-xs font-semibold text-slate-500">Tông màu:</span>
        <TemplateColorSwatches colors={colors} selectedKey={activeColor?.hex_code} onSelect={(color) => update({ colorSlug: color.slug })} />
      </div>
    </div>

    <div className="mt-5 grid gap-6 lg:grid-cols-10">
      <div className="min-w-0 rounded-2xl bg-slate-200/60 p-2 sm:p-4 lg:col-span-7 lg:h-[calc(100vh-11rem)] lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
        <CvSourcePreview preview={cv.preview} themeColor={activeColor?.hex_code} />
      </div>
      <aside className="hidden min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-slate-50 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] lg:sticky lg:top-24 lg:col-span-3 lg:flex lg:max-h-[calc(100vh-7rem)] lg:self-start">
        <h2 className="mb-4 text-base font-bold text-[var(--brand-primary)]">Bạn muốn tạo CV từ?</h2>
        <CvSourcePanel cv={cv} onBack={() => navigate(basePath)} />
      </aside>
    </div>

    {/* Màn hẹp: nút Tạo CV luôn hiển thị; tùy chọn nội dung mở dạng bottom sheet. */}
    <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
      <button type="button" onClick={() => setSheetOpen(true)} className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700">
        <SettingOutlined /><span className="truncate">{cv.source === 'sample' && cv.position ? cv.position.display_name || cv.position.name_vi : 'Chọn nội dung'}</span>
      </button>
      <button type="button" disabled={cv.submitting || (!cv.canSubmit && cv.source !== 'upload')} onClick={cv.source === 'upload' && !cv.uploadFile ? () => setSheetOpen(true) : cv.submit} className="flex-1 rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400">
        {createLabel}
      </button>
    </div>
    <Drawer open={sheetOpen} onClose={() => setSheetOpen(false)} placement="bottom" size="85vh" title="Bạn muốn tạo CV từ?" className="lg:hidden" styles={{ body: { display: 'flex', flexDirection: 'column', paddingBottom: 16 } }}>
      <CvSourcePanel cv={cv} />
    </Drawer>
  </>
}

export default function TemplateDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { locale, path: basePath } = catalogLocaleFromPath(pathname)
  const { promptLogin } = useLoginPrompt()
  const [modalSelection, setModalSelection] = useState(null)
  const detail = useQuery({ queryKey: ['cv-template', slug, locale], queryFn: () => getCvTemplate(slug, locale), staleTime: DETAIL_STALE_MS, retry: false })
  const related = useQuery({ queryKey: ['cv-template-related', slug, locale], queryFn: () => getRelatedCvTemplates(slug, locale), staleTime: DETAIL_STALE_MS, enabled: detail.isSuccess })
  const template = detail.data
  const colors = useMemo(() => templateColors(template), [template])
  const { selection, update, hasQuery } = useTemplateSelection(locale, colors[0]?.slug)

  if (detail.isPending) {
    return <div className="mx-auto max-w-7xl px-4 py-10"><Skeleton active avatar paragraph={{ rows: 8 }} /></div>
  }
  if (!template) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <Empty description="Mẫu CV không tồn tại hoặc đã ngừng phát hành">
        <Link to={basePath} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)]"><ArrowLeftOutlined /> Về kho mẫu</Link>
      </Empty>
    </div>
  }

  return <div className="min-h-screen bg-[#f4f6f8] pb-24 pt-6 md:pt-10 lg:pb-10">
    <main className="mx-auto max-w-7xl px-4">
      <TemplateWorkspace key={`${template.public_id}:${locale}`} template={template} colors={colors} locale={locale} basePath={basePath} selection={selection} update={update} hasQuery={hasQuery} />
      {related.data?.length > 0 && <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-800">Mẫu liên quan</h2>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {related.data.map((item) => <CvTemplateCard key={item.public_id} template={item} detailBasePath={basePath} onUse={(chosen, color) => setModalSelection({ template: chosen, color })} />)}
        </div>
      </section>}
    </main>
    <UseTemplateModal template={modalSelection?.template || null} themeColor={modalSelection?.color} open={Boolean(modalSelection)} onClose={() => setModalSelection(null)} onCreated={(cv) => navigate(editorPath(cv))} locale={locale} onRequireLogin={promptLogin} />
  </div>
}
