import { Skeleton, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { getRecruiterVisibility, updateRecruiterVisibility } from '@/entities/candidate-preferences'
import { message } from '@/shared/lib/toast'
import RecruiterConsentModal from './RecruiterConsentModal'

export default function RecruiterVisibilityControl({ cvPublicId }) {
  const [status, setStatus] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    let active = true
    getRecruiterVisibility()
      .then((data) => { if (active) setStatus(data) })
      .catch(() => { if (active) message.error('Không thể tải cài đặt hiển thị hồ sơ.') })
    return () => { active = false }
  }, [])

  async function persist(enabled) {
    setUpdating(true)
    try {
      const saved = await updateRecruiterVisibility({
        enabled,
        confirmed: enabled,
        cv_public_id: cvPublicId,
        policy_version: status?.policy_version || 'v1',
        source: 'cv_save_success',
        source_path: `${window.location.pathname}${window.location.search}`,
      })
      setStatus(saved)
      setConfirmOpen(false)
      message.success(enabled ? 'Đã cho phép nhà tuyển dụng tìm kiếm hồ sơ.' : 'Đã tắt quyền tìm kiếm hồ sơ.')
    } catch {
      message.error('Không thể cập nhật quyền tìm kiếm hồ sơ lúc này.')
    } finally {
      setUpdating(false)
    }
  }

  if (!status) return <Skeleton.Button active size="small" className="!w-72" />

  return (
    <>
      <div className="flex items-center gap-3">
        <Switch
          aria-label="Cho phép nhà tuyển dụng tìm kiếm hồ sơ"
          checked={status.enabled}
          loading={updating}
          onChange={(checked) => checked ? setConfirmOpen(true) : persist(false)}
          className={status.enabled ? '!bg-[#00b14f]' : ''}
        />
        <span className={`text-sm font-bold ${status.enabled ? 'text-[#00b14f]' : 'text-slate-500'}`}>
          {status.enabled ? 'Cho phép NTD tìm kiếm hồ sơ' : 'Chưa cho phép NTD tìm kiếm hồ sơ'}
        </span>
      </div>
      <RecruiterConsentModal
        open={confirmOpen}
        loading={updating}
        onConfirm={() => persist(true)}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
