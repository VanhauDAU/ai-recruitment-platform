import { ArrowLeftOutlined } from '@ant-design/icons'
import { Empty, Result, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CvDocumentPreview } from '@/entities/cv'
import {
  CvTemplateCard,
  TemplateColorSwatches,
  getCvTemplate,
  getRelatedCvTemplates,
  templateColors,
} from '@/entities/cv-template'
import { usePreviewFitZoom } from '@/shared/hooks/use-preview-fit-zoom'
import { useLocales } from '@/entities/locale'
import { CvSourcePanel, UseTemplateModal } from '@/features/create-cv-from-template'
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
  const { locales, loaded: localesLoaded } = useLocales()
  const [template, setTemplate] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalSelection, setModalSelection] = useState(null)

  // Quản lý màu CV và canonical preview được chọn ở Detail
  const [selectedColor, setSelectedColor] = useState(null)
  const [preview, setPreview] = useState(null)

  const { containerRef: previewWrapRef, zoom: previewZoom } = usePreviewFitZoom(!loading && Boolean(template))

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

  const colors = useMemo(() => templateColors(template), [template])

  const previewDocument = useMemo(() => {
    if (!preview?.document) return null
    if (!selectedColor) return preview.document
    return {
      ...preview.document,
      style_json: { ...preview.document.style_json, theme_color: selectedColor },
    }
  }, [preview, selectedColor])

  const localeLabel = LOCALE_LABELS[locale] || 'tiếng Việt'

  if (localesLoaded && !locales.some((item) => item.code === locale)) {
    return <Result status="404" title="Ngôn ngữ CV không tồn tại hoặc đã ngừng hoạt động" />
  }

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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1">Tông màu:</span>
            <TemplateColorSwatches
              colors={colors}
              selectedKey={selectedColor}
              onSelect={(color) => setSelectedColor(color.hex_code)}
            />
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
              <div className="min-h-full w-full max-w-[794px] bg-white p-10 shadow-sm">
                {preview?.empty && <p className="py-20 text-center text-sm text-slate-500">Chưa có nội dung CV mẫu cho ngôn ngữ này.</p>}
                {preview?.error && <p className="py-20 text-center text-sm text-rose-600">Không tải được bản xem trước.</p>}
                {preview?.unavailable && <p className="py-20 text-center text-sm text-slate-500">Bản xem trước cho nguồn này sẽ được hiển thị khi workflow sẵn sàng.</p>}
                {!preview && <Skeleton active paragraph={{ rows: 16 }} />}
              </div>
            ) : (
              <div className="h-fit" style={{ zoom: previewZoom }}>
                <div className="shadow-[0_12px_40px_rgba(0,0,0,0.06)] rounded-lg overflow-hidden bg-white">
                  <CvDocumentPreview document={previewDocument} rendererKey={preview.renderer?.key} />
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
              onCreated={(cv) => navigate(`/cvs/${cv.public_id}/edit?mode=create`)}
              onBack={() => navigate(basePath)}
              onPreviewChange={setPreview}
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
        onCreated={(cv) => navigate(`/cvs/${cv.public_id}/edit?mode=create`)}
        locale={locale}
      />
    </div>
  )
}
