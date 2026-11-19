import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloudSyncOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { Button, Tag } from 'antd'
import { stateColor } from '../model/editor-options'

const SAVE_STATE_COPY = {
  dirty: { color: 'gold', icon: <EditOutlined />, label: 'Có thay đổi chưa lưu' },
  error: { color: 'red', icon: <ExclamationCircleOutlined />, label: 'Lưu thất bại' },
  saved: { color: 'green', icon: <CheckCircleOutlined />, label: 'Đã lưu' },
  saving: { color: 'processing', icon: <CloudSyncOutlined spin />, label: 'Đang lưu…' },
}

export default function BlogEditorHeader({
  allowedActions,
  canEdit,
  createLoading,
  isNew,
  onBack,
  onCreate,
  onPreview,
  onPublish,
  onSave,
  onSubmit,
  post,
  saveLoading,
  saveState,
  submitLabel,
  title,
}) {
  const saveStatus = SAVE_STATE_COPY[saveState] || SAVE_STATE_COPY.saved
  return (
    <header className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button className="min-h-11 min-w-11" aria-label="Quay lại danh sách bài viết" icon={<ArrowLeftOutlined />} onClick={onBack} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Cẩm nang nghề nghiệp / {isNew ? 'Bài viết mới' : 'Biên tập'}</p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="max-w-full truncate text-lg font-bold text-slate-900 sm:text-xl">{title || 'Bài viết chưa đặt tên'}</h1>
              {post && <Tag color={stateColor(post.editorial_state)}>{post.editorial_state_label}</Tag>}
              {!isNew && !canEdit && <Tag>Chỉ xem nội dung</Tag>}
              {(isNew || canEdit) && <Tag color={saveStatus.color} icon={saveStatus.icon}>{isNew ? 'Chưa tạo bản nháp' : saveStatus.label}</Tag>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button className="min-h-11" icon={<EyeOutlined />} onClick={onPreview}>Xem trước</Button>
          {!isNew && canEdit && <Button className="min-h-11" loading={saveLoading} onClick={onSave}>Lưu ngay</Button>}
          {isNew && <Button className="col-span-2 min-h-11 sm:col-span-1" type="primary" loading={createLoading} onClick={onCreate}>Tạo bản nháp</Button>}
          {allowedActions.includes('submit') && <Button className="col-span-2 min-h-11 sm:col-span-1" type="primary" icon={<SendOutlined />} onClick={onSubmit}>{submitLabel}</Button>}
          {allowedActions.includes('publish') && <Button className="col-span-2 min-h-11 sm:col-span-1" type="primary" onClick={onPublish}>Xuất bản</Button>}
        </div>
      </div>
    </header>
  )
}
