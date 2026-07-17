import { Modal, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { getCvSampleContents } from '@/entities/cv-template'

export default function SampleLibraryPanel({ locale, disabled, onApply }) {
  const [samples, setSamples] = useState(null)
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    let active = true
    setSamples(null)
    getCvSampleContents(locale).then((data) => { if (active) setSamples(data) }).catch(() => { if (active) setSamples([]) })
    return () => { active = false }
  }, [locale])
  if (!samples) return <Skeleton active paragraph={{ rows: 5 }} />
  return <div><div className="grid grid-cols-2 gap-3">{samples.map((sample) => <button key={sample.public_id} type="button" disabled={disabled} onClick={() => setSelected(sample)} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-emerald-400"><p className="font-bold">{sample.title}</p><p className="mt-1 text-xs text-slate-500">{sample.position_name_vi || sample.position_name}</p></button>)}</div>{samples.length === 0 && <p className="text-sm text-slate-500">Chưa có nội dung mẫu cho ngôn ngữ này.</p>}<Modal open={Boolean(selected)} title="Sử dụng mẫu nội dung?" okText="Sử dụng" cancelText="Quay lại" onCancel={() => setSelected(null)} onOk={async () => { await onApply(selected.public_id); setSelected(null) }}><p>Nội dung tất cả các mục trên CV của bạn, trừ Thông tin cá nhân và Tên, sẽ được thay thế bởi nội dung mẫu. Bạn có muốn tiếp tục?</p></Modal></div>
}
