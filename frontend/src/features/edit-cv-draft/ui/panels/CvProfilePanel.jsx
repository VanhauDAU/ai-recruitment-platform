import { Select } from 'antd'
import { useEffect, useState } from 'react'
import { getCvPositionDetails, getCvPositionOptions } from '@/entities/cv-template'
import { POSITION_LEVEL_LABELS } from '@/entities/job'
import { message } from '@/shared/lib/toast'

const LEVEL_OPTIONS = Object.entries(POSITION_LEVEL_LABELS).map(([value, label]) => ({ value, label }))

// Hồ sơ ứng tuyển (CVT-3): vị trí mục tiêu và cấp bậc mong muốn, cùng từ vựng
// với tin tuyển dụng để gợi ý việc làm. Không in lên CV; đổi vị trí thì mục
// "Thông tin chuyên môn" đổi theo trường riêng của vị trí mới.
export default function CvProfilePanel({ cv, locale, disabled, onUpdate, onPositionDetails }) {
  const [positions, setPositions] = useState(null)
  const [saving, setSaving] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    getCvPositionOptions(locale, '', controller.signal).then(setPositions).catch(() => { if (!controller.signal.aborted) setPositions([]) })
    return () => controller.abort()
  }, [locale])

  const save = async (field, changes, after) => {
    setSaving(field)
    try {
      await onUpdate(changes)
      if (after) await after()
    } catch {
      message.error('Không thể lưu hồ sơ ứng tuyển')
    } finally {
      setSaving(null)
    }
  }
  const choosePosition = (positionPublicId) => save('position', { position_public_id: positionPublicId ?? null }, positionPublicId && (async () => {
    onPositionDetails(await getCvPositionDetails(positionPublicId, locale))
  }))

  return <div className="space-y-5">
    <p className="text-sm text-slate-500">Thông tin này không in lên CV. Hệ thống dùng nó để gợi ý việc làm phù hợp với bạn.</p>
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">Vị trí mục tiêu</span>
      <Select showSearch allowClear optionFilterProp="label" aria-label="Vị trí mục tiêu" className="w-full" placeholder="Chọn vị trí" loading={!positions || saving === 'position'} disabled={disabled || saving === 'position'} value={cv?.position_public_id || undefined} options={(positions || []).map((position) => ({ value: position.public_id, label: position.display_name }))} onChange={choosePosition} />
      <span className="mt-1 block text-xs text-slate-500">Mục "Thông tin chuyên môn" trên CV dùng trường riêng của vị trí này.</span>
    </label>
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">Cấp bậc mong muốn</span>
      <Select allowClear aria-label="Cấp bậc mong muốn" className="w-full" placeholder="Chọn cấp bậc" loading={saving === 'level'} disabled={disabled || saving === 'level'} value={cv?.position_level || undefined} options={LEVEL_OPTIONS} onChange={(level) => save('level', { position_level: level || '' })} />
    </label>
  </div>
}
