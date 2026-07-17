import { SwapOutlined } from '@ant-design/icons'
import { Button, Modal, Select, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { getCvTemplate, getCvTemplates } from '@/entities/cv-template'

export default function TemplateSwitcher({ currentTemplatePublicId, locale, disabled, onSwitch, currentSections }) {
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(currentTemplatePublicId)
  const [loading, setLoading] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    getCvTemplates({ locale }).then((data) => {
      if (active) setTemplates(data.results)
    }).catch(() => {
      if (active) setTemplates([])
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [locale])

  useEffect(() => setSelected(currentTemplatePublicId), [currentTemplatePublicId])

  const options = templates.map((template) => ({ value: template.public_id, label: template.display_name }))
  const applyTemplate = async () => {
    if (!selected || selected === currentTemplatePublicId) return
    if (currentSections) {
      const template = templates.find((item) => item.public_id === selected)
      if (!template?.slug) return
      setLoading(true)
      try {
        const detail = await getCvTemplate(template.slug, locale)
        const supported = new Set(detail.sections.map((section) => section.section_key))
        setConfirmation({
          template,
          hidden: currentSections.filter((section) => !supported.has(section.section_key)),
        })
      } finally {
        setLoading(false)
      }
      return
    }
    setLoading(true)
    await onSwitch(selected)
    setLoading(false)
  }

  return (
    <section aria-labelledby="template-switch-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="template-switch-title" className="text-lg font-bold text-slate-900">Đổi mẫu</h2>
      <p className="mt-1 text-sm text-slate-500">Giữ nguyên nội dung CV; chỉ áp dụng layout, style và renderer của published template.</p>
      {currentSections && <div className="mt-4 grid grid-cols-2 gap-3">{loading && templates.length === 0 ? <Skeleton active /> : templates.map((template) => <button key={template.public_id} type="button" aria-pressed={selected === template.public_id} onClick={() => setSelected(template.public_id)} className={`overflow-hidden rounded-xl border-2 bg-white text-left ${selected === template.public_id ? 'border-emerald-500' : 'border-slate-200'}`}><div className="aspect-[3/4] bg-slate-100">{template.thumbnail_url && <img src={template.thumbnail_url} alt="" className="h-full w-full object-cover" />}</div><p className="p-2 text-sm font-bold">{template.display_name}</p></button>)}</div>}
      <div className="mt-4 flex flex-wrap gap-2"><Select aria-label="Mẫu CV" value={selected} options={options} loading={loading} onChange={setSelected} className="min-w-56 flex-1" /><Button aria-label="Áp dụng mẫu CV" icon={<SwapOutlined />} loading={loading} disabled={disabled || !selected || selected === currentTemplatePublicId} onClick={applyTemplate}>Áp dụng mẫu</Button></div>
      <Modal open={Boolean(confirmation)} title={`Đổi sang ${confirmation?.template.display_name || 'mẫu CV này'}?`} okText="Đổi mẫu" cancelText="Quay lại" confirmLoading={loading} onCancel={() => setConfirmation(null)} onOk={async () => { setLoading(true); await onSwitch(confirmation.template.public_id); setLoading(false); setConfirmation(null) }}><p>Nội dung CV được giữ nguyên. Composer backend sẽ quyết định bố cục cuối cùng.</p>{confirmation?.hidden.length > 0 ? <><p className="mt-3 font-semibold text-amber-700">Các mục sau sẽ được bảo toàn nhưng tạm ẩn:</p><ul className="mt-1 list-disc pl-5">{confirmation.hidden.map((section) => <li key={section.instance_id}>{section.title}</li>)}</ul></> : <p className="mt-3 text-emerald-700">Mẫu mới hỗ trợ tất cả mục đang dùng.</p>}</Modal>
    </section>
  )
}
