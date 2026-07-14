import { SwapOutlined } from '@ant-design/icons'
import { Button, Select } from 'antd'
import { useEffect, useState } from 'react'
import { getCvTemplates } from '@/entities/cv-template'

export default function TemplateSwitcher({ currentTemplatePublicId, locale, disabled, onSwitch }) {
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(currentTemplatePublicId)
  const [loading, setLoading] = useState(false)

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
    setLoading(true)
    await onSwitch(selected)
    setLoading(false)
  }

  return (
    <section aria-labelledby="template-switch-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="template-switch-title" className="text-lg font-bold text-slate-900">Đổi mẫu</h2>
      <p className="mt-1 text-sm text-slate-500">Giữ nguyên nội dung CV; chỉ áp dụng layout, style và renderer của published template.</p>
      <div className="mt-4 flex flex-wrap gap-2"><Select aria-label="Mẫu CV" value={selected} options={options} loading={loading} onChange={setSelected} className="min-w-56 flex-1" /><Button aria-label="Áp dụng mẫu CV" icon={<SwapOutlined />} loading={loading} disabled={disabled || !selected || selected === currentTemplatePublicId} onClick={applyTemplate}>Áp dụng mẫu</Button></div>
    </section>
  )
}
