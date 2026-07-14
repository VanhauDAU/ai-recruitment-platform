import { FilterOutlined, FileAddOutlined } from '@ant-design/icons'
import { Button, Empty, Select, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CvTemplateCard, getCvCategories, getCvTemplates } from '@/entities/cv-template'
import { UseTemplateModal } from '@/features/create-cv-from-template'

const LOCALE = 'vi-VN'

export default function TemplateCatalog() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState()
  const [tag, setTag] = useState()
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCvCategories().then((data) => !cancelled && setCategories(data)).catch(() => !cancelled && setCategories([]))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCvTemplates({ locale: LOCALE, ...(category ? { category } : {}), ...(tag ? { tag } : {}) })
      .then((data) => !cancelled && setTemplates(data.results))
      .catch(() => !cancelled && setTemplates([]))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [category, tag])

  useEffect(() => { document.title = 'Mẫu CV chuyên nghiệp | ProCV' }, [])

  const categoryOptions = useMemo(
    () => categories
      .filter((item) => item.category_type !== 'feature')
      .map((item) => ({ value: item.slug, label: item.name })),
    [categories],
  )
  const tagOptions = useMemo(
    () => categories
      .filter((item) => item.category_type === 'feature')
      .map((item) => ({ value: item.slug, label: item.name })),
    [categories],
  )

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50">
      <section className="bg-gradient-to-br from-[#053a2c] via-[var(--brand-primary)] to-[#0b7154] text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-100">CV Builder</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">Chọn mẫu CV, khởi đầu thật tự tin</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-emerald-50">Mỗi mẫu có layout và phong cách đã được kiểm duyệt. Bạn luôn có thể bắt đầu từ trang trắng hoặc nội dung mẫu.</p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-7 md:py-10">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
          <div className="flex items-center gap-2 font-semibold text-slate-700"><FilterOutlined className="text-[var(--brand-primary)]" /> Lọc mẫu</div>
          <Select allowClear placeholder="Phong cách / đối tượng" value={category} onChange={setCategory} options={categoryOptions} className="min-w-0 flex-1" />
          <Select allowClear placeholder="Tính năng" value={tag} onChange={setTag} options={tagOptions} className="min-w-0 flex-1" />
        </div>

        <div className="mb-5 flex items-end justify-between gap-4">
          <div><h2 className="text-xl font-extrabold text-slate-900">Kho mẫu CV</h2><p className="mt-1 text-sm text-slate-500">{loading ? 'Đang tìm mẫu phù hợp…' : `${templates.length} mẫu đang sẵn sàng`}</p></div>
          <Button icon={<FileAddOutlined />} onClick={() => templates[0] && setSelectedTemplate(templates[0])} disabled={!templates.length}>Tạo CV</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3"><Skeleton.Image active className="!h-64 !w-full" /><Skeleton active paragraph={{ rows: 2 }} className="mt-3" /></div>)}</div>
        ) : templates.length === 0 ? (
          <Empty description="Không tìm thấy mẫu phù hợp với bộ lọc này"><Button onClick={() => { setCategory(undefined); setTag(undefined) }}>Xóa bộ lọc</Button></Empty>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => <CvTemplateCard key={template.public_id} template={template} onUse={setSelectedTemplate} />)}
          </div>
        )}
      </main>

      <UseTemplateModal
        template={selectedTemplate}
        open={Boolean(selectedTemplate)}
        onClose={() => setSelectedTemplate(null)}
        onCreated={(cv) => navigate(`/cvs/${cv.public_id}/edit`)}
        locale={LOCALE}
      />
    </div>
  )
}
