import { Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { getCvSampleContents } from '@/entities/cv-template'
import ConfirmActionModal from '@/shared/ui/ConfirmActionModal'

export default function SampleLibraryPanel({ locale, disabled, onApply }) {
  const [samples, setSamples] = useState(null)
  const [selected, setSelected] = useState(null)
  const [applying, setApplying] = useState(false)
  useEffect(() => {
    let active = true
    setSamples(null)
    getCvSampleContents(locale).then((data) => { if (active) setSamples(data) }).catch(() => { if (active) setSamples([]) })
    return () => { active = false }
  }, [locale])
  if (!samples) return <Skeleton active paragraph={{ rows: 5 }} />
  const applySelectedSample = async () => {
    if (!selected) return
    setApplying(true)
    try {
      const result = await onApply(selected.public_id)
      if (result) setSelected(null)
      return result
    } finally {
      setApplying(false)
    }
  }
  return <div><div className="grid grid-cols-2 gap-3">{samples.map((sample) => <button key={sample.public_id} type="button" disabled={disabled} onClick={() => setSelected(sample)} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-emerald-400"><p className="font-bold">{sample.title}</p><p className="mt-1 text-xs text-slate-500">{sample.position_name_vi || sample.position_name}</p></button>)}</div>{samples.length === 0 && <p className="text-sm text-slate-500">Chưa có nội dung mẫu cho ngôn ngữ này.</p>}<ConfirmActionModal open={Boolean(selected)} title="Sử dụng nội dung mẫu" confirmText="Sử dụng mẫu" cancelText="Quay lại" confirmLoading={applying} danger onCancel={() => setSelected(null)} onConfirm={applySelectedSample}><p>Bạn có chắc muốn sử dụng mẫu <strong>{selected?.title}</strong> không?</p><p className="mt-1">Nội dung các mục hiện tại, trừ Thông tin cá nhân và Tên, sẽ được thay thế.</p></ConfirmActionModal></div>
}
