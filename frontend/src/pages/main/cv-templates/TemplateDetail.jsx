import { ArrowLeftOutlined, CheckCircleFilled, FileAddOutlined } from '@ant-design/icons'
import { Button, Empty, Skeleton, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CvTemplateCard, CvTemplatePreview, getCvTemplate, getRelatedCvTemplates } from '@/entities/cv-template'
import { UseTemplateModal } from '@/features/create-cv-from-template'
import { catalogLocaleFromPath } from './locale-paths'

export default function TemplateDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // pathname = /mau-cv-tieng-anh/chi-tiet/:slug → catalogLocaleFromPath vẫn detect đúng locale
  const { locale, path: basePath } = catalogLocaleFromPath(pathname)
  const [template, setTemplate] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [useOpen, setUseOpen] = useState(false)
  const [templateToUse, setTemplateToUse] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getCvTemplate(slug, locale), getRelatedCvTemplates(slug, locale)])
      .then(([detail, recommendations]) => {
        if (cancelled) return
        setTemplate(detail)
        setTemplateToUse(detail)
        setRelated(recommendations)
        document.title = `${detail.display_name} | Mẫu CV ProCV`
      })
      .catch(() => !cancelled && setTemplate(null))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [slug, locale])

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10"><Skeleton active avatar paragraph={{ rows: 8 }} /></div>
  if (!template) return <div className="mx-auto max-w-6xl px-4 py-16"><Empty description="Mẫu CV không tồn tại hoặc đã ngừng phát hành"><Link to={basePath}><Button>Về kho mẫu</Button></Link></Empty></div>

  return (
    <div className="bg-slate-50 py-6 md:py-10">
      <main className="mx-auto max-w-6xl px-4">
        <Link to={basePath} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[var(--brand-primary)]"><ArrowLeftOutlined /> Tất cả mẫu CV</Link>
        <div className="mt-5 grid gap-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)] md:p-8">
          <div className="mx-auto w-full max-w-sm"><CvTemplatePreview template={template} /></div>
          <div className="flex flex-col">
            <div className="flex flex-wrap gap-2">{template.categories.map((category) => <Tag key={category.public_id} color="blue">{category.name}</Tag>)}{template.tags.map((tag) => <Tag key={tag.public_id} color="green">{tag.name}</Tag>)}</div>
            <h1 className="mt-4 text-3xl font-extrabold text-slate-900 md:text-4xl">{template.display_name}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">{template.description || 'Một bố cục CV cân đối, sẵn sàng để bạn biến thành câu chuyện nghề nghiệp của riêng mình.'}</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {template.sections.map((section) => <div key={`${section.region_key}-${section.section_key}`} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircleFilled style={{ color: template.theme_color }} /> {section.display_name}</div>)}
            </div>
            <div className="mt-8"><Button type="primary" size="large" icon={<FileAddOutlined />} onClick={() => { setTemplateToUse(template); setUseOpen(true) }}>Dùng mẫu này</Button></div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-10"><h2 className="text-2xl font-extrabold text-slate-900">Mẫu liên quan</h2><div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((item) => <CvTemplateCard key={item.public_id} template={item} detailBasePath={basePath} onUse={(chosen) => { setTemplateToUse(chosen); setUseOpen(true) }} />)}</div></section>
        )}
      </main>
      <UseTemplateModal template={templateToUse} open={useOpen} onClose={() => setUseOpen(false)} onCreated={(cv) => navigate(`/cvs/${cv.public_id}/edit`)} locale={locale} />
    </div>
  )
}
