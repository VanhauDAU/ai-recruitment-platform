import { CheckCircleFilled, CloudSyncOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import { Alert, Button, Tag } from 'antd'

const STATE = {
  unsaved: { color: 'gold', icon: <ExclamationCircleFilled />, label: 'Chưa lưu' },
  saving: { color: 'processing', icon: <CloudSyncOutlined />, label: 'Đang lưu' },
  saved: { color: 'success', icon: <CheckCircleFilled />, label: 'Đã lưu' },
  failed: { color: 'error', icon: <ExclamationCircleFilled />, label: 'Lưu thất bại' },
  conflict: { color: 'error', icon: <ExclamationCircleFilled />, label: 'Có thay đổi ở tab khác' },
}

export default function EditorSaveState({ phase, error, onRetry, onReload, savedAt, compact = false }) {
  const state = STATE[phase] || STATE.saving
  const savedLabel = phase === 'saved' && savedAt
    ? `Đã lưu lúc ${savedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    : state.label
  if (compact) return <Tag title={savedLabel} color={state.color} icon={state.icon} className="m-0 max-w-40 truncate">{savedLabel}</Tag>
  return (
    <div className="space-y-3">
      <Tag color={state.color} icon={state.icon}>{savedLabel}</Tag>
      {phase === 'failed' && <Alert type="error" showIcon title="Không thể autosave bản nháp" description={<div className="space-y-2"><p>{error?.response?.data?.detail || 'Dữ liệu chưa được lưu trên máy chủ.'}</p><div className="flex gap-2"><Button size="small" onClick={onRetry}>Thử lưu lại</Button><Button size="small" onClick={onReload}>Khôi phục bản nháp đã lưu</Button></div></div>} />}
      {phase === 'conflict' && <Alert type="warning" showIcon title="Bản nháp vừa được sửa ở tab khác" description={<div className="space-y-2"><p>Autosave đã dừng để tránh ghi đè. Hãy tải bản nháp mới rồi tiếp tục chỉnh sửa.</p><Button size="small" onClick={onReload}>Tải lại bản nháp</Button>{error?.current_lock_version !== undefined && <p className="text-xs">Phiên bản bản nháp hiện tại: {error.current_lock_version}</p>}</div>} />}
    </div>
  )
}
