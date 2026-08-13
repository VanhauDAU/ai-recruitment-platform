import { BellOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { Alert, Button, Modal } from 'antd'
import {
  createEmployerJobAlert,
  previewEmployerJobAlert,
} from '@/entities/service-package'
import { message } from '@/shared/lib/toast'

function dispatchKey() {
  return globalThis.crypto?.randomUUID?.() || `job-alert-${Date.now()}-${Math.random()}`
}

function errorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.join(' ')
  const blockers = error?.response?.data?.blockers
  if (Array.isArray(blockers)) return blockers.join(' ')
  return fallback
}

export default function JobAlertAction({ activation, item, canUse, onSent }) {
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)

  const openPreview = async () => {
    setPreviewing(true)
    try {
      setPreview(await previewEmployerJobAlert(activation.public_id))
    } catch (error) {
      message.error(errorMessage(error, 'Không thể kiểm tra điều kiện gửi Job Alert.'))
    } finally {
      setPreviewing(false)
    }
  }

  const send = async () => {
    setSending(true)
    try {
      await createEmployerJobAlert(activation.public_id, dispatchKey())
      message.success('Đã tạo đợt gửi Job Alert. Hệ thống sẽ chỉ gửi tới ứng viên phù hợp.')
      setPreview(null)
      await onSent()
    } catch (error) {
      message.error(errorMessage(error, 'Không thể tạo đợt gửi Job Alert.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        className="w-full sm:w-auto"
        icon={<BellOutlined />}
        loading={previewing}
        disabled={!canUse || item.remaining_quantity < 1}
        onClick={openPreview}
      >
        {item.remaining_quantity > 0 ? 'Gửi Job Alert' : 'Đã dùng hết Job Alert'}
      </Button>
      <Modal
        title="Gửi Job Alert"
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        onOk={send}
        okText="Dùng 1 lượt và gửi"
        cancelText="Đóng"
        confirmLoading={sending}
        okButtonProps={{ disabled: !preview?.can_dispatch }}
        destroyOnHidden
      >
        {preview && (
          <div className="space-y-4">
            {preview.blockers?.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="Chưa thể gửi Job Alert"
                description={preview.blockers.join(' ')}
              />
            )}
            <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              <p>{preview.message}</p>
              <p className="mt-2">Hệ thống kiểm tra lại trạng thái tin, mức độ phù hợp và tùy chọn nhận email ngay trước khi gửi.</p>
            </div>
            <Alert
              type="info"
              showIcon
              message="Không cam kết số hồ sơ ứng tuyển"
              description="Một lượt chỉ tạo một đợt gửi. Ứng viên có thể tắt nhận email trước thời điểm hệ thống xử lý."
            />
          </div>
        )}
      </Modal>
    </>
  )
}
