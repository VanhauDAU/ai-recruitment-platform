import { ArrowLeftOutlined } from '@ant-design/icons'
import { Empty, Skeleton, Spin } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CvDocumentPreview } from '@/entities/cv'
import { CvTemplateCard, getCvTemplate, getRelatedCvTemplates, templateColors } from '@/entities/cv-template'
import {
  CvSourcePanel,
  UseTemplateModal,
  buildDocumentFromSampleContent,
  buildSamplePreviewDocument,
} from '@/features/create-cv-from-template'
import { catalogLocaleFromPath, catalogPathForCategory } from './locale-paths'

const LOCALE_LABELS = {
  'vi-VN': 'tiếng Việt',
  'en-US': 'tiếng Anh',
  'ja-JP': 'tiếng Nhật',
  'zh-CN': 'tiếng Trung',
}

export default function TemplateDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { locale, path: basePath } = catalogLocaleFromPath(pathname)
  const [template, setTemplate] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalSelection, setModalSelection] = useState(null)

  // Quản lý màu CV và nội dung mẫu được chọn ở Detail
  const [selectedColor, setSelectedColor] = useState(null)
  const [sampleContent, setSampleContent] = useState(null)

  // Zoom xem trước A4
  const previewWrapRef = useRef(null)
  const [previewZoom, setPreviewZoom] = useState(1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getCvTemplate(slug, locale), getRelatedCvTemplates(slug, locale)])
      .then(([detail, recommendations]) => {
        if (cancelled) return
        setTemplate(detail)
        setRelated(recommendations)
        setSelectedColor(templateColors(detail)[0].hex_code)
        document.title = `${detail.display_name} | Mẫu CV ProCV`
      })
      .catch(() => !cancelled && setTemplate(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [slug, locale])

  // Co giãn A4 vừa khít container bên trái
  useEffect(() => {
    if (loading || !template) return undefined
    const element = previewWrapRef.current
    if (!element) return undefined
    const fit = () => setPreviewZoom(Math.min(1, element.clientWidth / 842))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [loading, template])

  const colors = useMemo(() => templateColors(template), [template])

  const previewDocument = useMemo(() => {
    if (!template) return null
    if (sampleContent) {
      return buildDocumentFromSampleContent(template, sampleContent, selectedColor)
    }
    return buildSamplePreviewDocument(template, selectedColor)
  }, [template, sampleContent, selectedColor])

  const localeLabel = LOCALE_LABELS[locale] || 'tiếng Việt'

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <Skeleton active avatar paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <Empty description="Mẫu CV không tồn tại hoặc đã ngừng phát hành">
          <Link to={basePath} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)]">
            <ArrowLeftOutlined /> Về kho mẫu
          </Link>
        </Empty>
      </div>
    )
  }

  // Phân nhóm danh mục để hiển thị breadcrumbs
  const activeCategory = template.categories?.[0]
  const isPosition = activeCategory?.type === 'position'
  const groupLabel = isPosition ? 'Mẫu CV theo ngành nghề' : 'Mẫu CV theo style'

  return (
    <div className="min-h-screen bg-[#f4f6f8] py-6 md:py-10">
      <main className="mx-auto max-w-7xl px-4">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium">
          <Link to="/" className="transition hover:text-[var(--brand-primary)]">
            Trang chủ
          </Link>
          <span className="text-slate-400">/</span>
          <Link to={basePath} className="transition hover:text-[var(--brand-primary)]">
            Mẫu CV {localeLabel}
          </Link>
          <span className="text-slate-400">/</span>
          {activeCategory && (
            <>
              <Link to={catalogPathForCategory(basePath, activeCategory.slug)} className="transition hover:text-[var(--brand-primary)]">{groupLabel}</Link>
              <span className="text-slate-400">/</span>
            </>
          )}
          <span className="text-slate-800 font-semibold">
            Mẫu CV {localeLabel} - {template.display_name}
          </span>
        </nav>

        {/* Tiêu đề & Chọn màu nằm ngang hàng */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-extrabold text-slate-900 md:text-3xl">
            Mẫu CV {localeLabel} - {template.display_name}
          </h1>

          {/* Hộp chọn màu */}
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Chọn màu mẫu CV">
            <span className="text-xs font-semibold text-slate-500 mr-1">Tông màu:</span>
            {colors.map((color) => (
              <button
                key={color.public_id || color.slug}
                type="button"
                role="radio"
                aria-checked={selectedColor === color.hex_code}
                title={color.name}
                onMouseEnter={() => setSelectedColor(color.hex_code)}
                onFocus={() => setSelectedColor(color.hex_code)}
                className={[
                  'h-4.5 w-4.5 cursor-pointer rounded-full transition-all duration-200',
                  selectedColor === color.hex_code
                    ? 'ring-2 ring-slate-900 ring-offset-2 scale-110'
                    : 'ring-1 ring-black/10 hover:ring-2 hover:ring-slate-400 hover:scale-105',
                ].join(' ')}
                style={{ backgroundColor: color.hex_code }}
              />
            ))}
          </div>
        </div>

        {/* Bố cục chính 2 cột */}
        <div className="mt-6 grid gap-6 lg:grid-cols-10">
          {/* Cột trái: Preview CV - Hiển thị nổi trực tiếp trên nền trang */}
          <div
            ref={previewWrapRef}
            className="lg:col-span-7 h-[78vh] overflow-y-auto overflow-x-hidden flex justify-center p-2"
          >
            {!previewDocument ? (
              <div className="flex h-full items-center justify-center">
                <Spin />
              </div>
            ) : (
              <div className="h-fit" style={{ zoom: previewZoom }}>
                <div className="shadow-[0_12px_40px_rgba(0,0,0,0.06)] rounded-lg overflow-hidden bg-white">
                  <CvDocumentPreview document={previewDocument} rendererKey={template.renderer?.key} />
                </div>
              </div>
            )}
          </div>

          {/* Cột phải: Panel lựa chọn tạo CV */}
          <div className="lg:col-span-3 flex flex-col bg-slate-50 border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <h3 className="mb-4 text-base font-bold text-[var(--brand-primary)]">Bạn muốn tạo CV từ?</h3>
            <CvSourcePanel
              template={template}
              locale={locale}
              themeColor={selectedColor}
              onCreated={(cv) => navigate(`/cvs/${cv.public_id}/edit`)}
              onBack={() => navigate(basePath)}
              onSampleContentChange={setSampleContent}
            />
          </div>
        </div>

        {/* Khối danh sách các CV liên quan */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-slate-800">Mẫu liên quan</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {related.map((item) => (
                <CvTemplateCard
                  key={item.public_id}
                  template={item}
                  detailBasePath={basePath}
                  onUse={(chosen, color) => {
                    setModalSelection({ template: chosen, color })
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Modal Popup sử dụng mẫu CV khi nhấn vào các card mẫu liên quan */}
      <UseTemplateModal
        template={modalSelection?.template || null}
        themeColor={modalSelection?.color}
        open={Boolean(modalSelection)}
        onClose={() => setModalSelection(null)}
        onCreated={(cv) => navigate(`/cvs/${cv.public_id}/edit`)}
        locale={locale}
      />
    </div>
  )
}
