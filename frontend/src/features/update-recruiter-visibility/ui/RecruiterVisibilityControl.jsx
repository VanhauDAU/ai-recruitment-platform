import { Checkbox, Modal, Skeleton, Switch, message } from 'antd'
import { useEffect, useState } from 'react'
import { getRecruiterVisibility, updateRecruiterVisibility } from '@/entities/candidate-preferences'

export default function RecruiterVisibilityControl({ cvPublicId }) {
  const [status, setStatus] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

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
        confirmed: enabled ? confirmed : false,
        cv_public_id: cvPublicId,
        policy_version: status?.policy_version || 'v1',
        source: 'cv_save_success',
        source_path: `${window.location.pathname}${window.location.search}`,
      })
      setStatus(saved)
      setConfirmOpen(false)
      setConfirmed(false)
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
      <Modal
        open={confirmOpen}
        title="Cho phép nhà tuyển dụng tìm kiếm hồ sơ?"
        okText="Xác nhận cho phép"
        cancelText="Để sau"
        okButtonProps={{ disabled: !confirmed, loading: updating, className: '!bg-[#00b14f]' }}
        onOk={() => persist(true)}
        onCancel={() => { setConfirmOpen(false); setConfirmed(false) }}
      >
        <div className="space-y-4 text-sm leading-6 text-slate-600">
          <p>Nhà tuyển dụng có thể xem kinh nghiệm, học vấn và kỹ năng trên CV để gửi lời mời kết nối phù hợp.</p>
          <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Họ tên, ảnh, số điện thoại, email và địa chỉ vẫn được ẩn cho tới khi bạn đồng ý lời mời kết nối.</p>
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>
            Tôi đã đọc và đồng ý mở hồ sơ cho nhà tuyển dụng tìm kiếm.
          </Checkbox>
        </div>
      </Modal>
    </>
  )
}
