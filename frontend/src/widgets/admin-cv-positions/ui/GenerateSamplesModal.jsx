import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Checkbox, Modal, Progress, Select, Tag } from 'antd'
import { useState } from 'react'
import { estimateAdminCvGeneration, generateAdminCvSamples, getAdminCvGenerations } from '@/entities/cv-template'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { BANDS, LOCALES } from '../model/catalog'

const MAX_BATCH = 16
const FAILURES = {
  runtime_disabled: 'Tính năng AI đang tắt trên hệ thống.',
  provider_not_configured: 'Chưa cấu hình nhà cung cấp AI.',
  generation_in_progress: 'AI đang viết nhiều bản khác, thử lại sau ít phút.',
  batch_too_large: `Tối đa ${MAX_BATCH} tổ hợp mỗi lần.`,
}

// Nhờ AI viết nội dung gợi ý: chọn vị trí, ngôn ngữ, mức kinh nghiệm; xem số bản
// và chi phí ước tính; theo dõi từng bản. Kết quả chờ admin duyệt.
export default function GenerateSamplesModal({ open, positions, initialPositionIds = [], onClose, onFinished }) {
  const [positionIds, setPositionIds] = useState(initialPositionIds)
  const [locales, setLocales] = useState(LOCALES.map((locale) => locale.value))
  const [bands, setBands] = useState(['junior'])
  const [batchId, setBatchId] = useState(null)
  const count = positionIds.length * locales.length * bands.length
  const estimate = useQuery({ queryKey: ['admin-cv-generation-estimate', count], queryFn: () => estimateAdminCvGeneration(count), enabled: open && count > 0 && count <= MAX_BATCH })
  const generations = useQuery({
    queryKey: ['admin-cv-generations', batchId],
    queryFn: () => getAdminCvGenerations(batchId),
    enabled: Boolean(batchId),
    refetchInterval: (query) => (query.state.data?.every((row) => ['completed', 'failed'].includes(row.status)) ? false : 3000),
  })
  const start = useMutation({
    mutationFn: () => generateAdminCvSamples({ position_public_ids: positionIds, locales, experience_bands: bands }),
    onSuccess: (result) => setBatchId(result.batch_id),
  })
  const rows = generations.data || []
  const finished = rows.length > 0 && rows.every((row) => ['completed', 'failed'].includes(row.status))
  const close = () => {
    if (finished) onFinished()
    setBatchId(null)
    start.reset()
    onClose()
  }
  const errorCode = start.error?.response?.data?.code
  return <Modal open={open} title="Nhờ AI viết nội dung gợi ý" onCancel={close} okText={batchId ? 'Đóng' : `Viết ${count} bản`} cancelButtonProps={{ hidden: Boolean(batchId) }} okButtonProps={{ disabled: !batchId && (count === 0 || count > MAX_BATCH) }} confirmLoading={start.isPending} onOk={() => (batchId ? close() : start.mutate())}>
    {!batchId && <div className="space-y-4">
      <p className="text-sm text-slate-600">AI viết một bản cho mỗi tổ hợp vị trí × ngôn ngữ × mức kinh nghiệm bạn chọn.</p>
      <label className="block text-sm font-semibold">Vị trí
        <Select mode="multiple" className="mt-1 w-full" aria-label="Vị trí sinh nội dung" optionFilterProp="label" value={positionIds} onChange={setPositionIds} options={positions.map((position) => ({ value: position.position_public_id, label: position.position_name }))} />
      </label>
      <div><p className="mb-1 text-sm font-semibold">Ngôn ngữ</p><Checkbox.Group options={LOCALES} value={locales} onChange={setLocales} /></div>
      <div><p className="mb-1 text-sm font-semibold">Mức kinh nghiệm</p><Checkbox.Group options={BANDS.map((band) => ({ value: band.value, label: band.label }))} value={bands} onChange={setBands} /></div>
      <Alert type={count > MAX_BATCH ? 'warning' : 'info'} showIcon message={count > MAX_BATCH
        ? `${count} bản vượt giới hạn ${MAX_BATCH} bản mỗi lần. Bớt lựa chọn.`
        : `${count} bản · chi phí ước tính ${estimate.data?.estimated_cost_usd === null || estimate.data?.estimated_cost_usd === undefined ? 'chưa có dữ liệu' : `$${estimate.data.estimated_cost_usd}`}. Bạn duyệt xong ứng viên mới thấy.`} />
      {start.isError && <Alert type="error" showIcon message={FAILURES[errorCode] || getApiErrorMessage(start.error, 'Không thể bắt đầu sinh nội dung.')} />}
    </div>}
    {batchId && <div className="space-y-3">
      <Progress percent={rows.length ? Math.round((rows.filter((row) => ['completed', 'failed'].includes(row.status)).length * 100) / rows.length) : 0} />
      <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">{rows.map((row) => <li key={row.public_id} className="flex justify-between gap-2"><span>{positions.find((position) => position.position_public_id === row.position_public_id)?.position_name} · {row.locale} · {row.experience_band}</span><Tag color={{ completed: 'green', failed: 'red', processing: 'blue' }[row.status]}>{row.status === 'failed' ? `Lỗi: ${row.failure_code}` : row.status}</Tag></li>)}</ul>
      {finished && <Alert type="success" showIcon message={'Đã xong. Mở tab "Bản AI chờ duyệt" để đọc và duyệt.'} />}
    </div>}
  </Modal>
}
