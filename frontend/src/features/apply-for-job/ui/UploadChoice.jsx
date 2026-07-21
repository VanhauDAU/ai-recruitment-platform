import { DeleteOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Input, Spin } from 'antd'
import { UPLOAD_CHOICE_ID } from '../model/use-apply-form'

function RequiredLabel({ children }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-slate-700">
      {children} <span className="text-rose-500">*</span>
    </span>
  )
}

export default function UploadChoice({
  selected,
  uploading,
  file,
  onSelect,
  onChooseFile,
  onDeleteFile,
  onDrop,
  contactName,
  contactEmail,
  contactPhone,
  onContactNameChange,
  onContactEmailChange,
  onContactPhoneChange,
}) {
  return (
    <div
      onClick={onSelect}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="cursor-pointer rounded-md border border-dashed border-slate-300 px-4 py-4"
    >
      <div className="grid grid-cols-[24px_minmax(0,1fr)_24px] items-start gap-2">
        <input
          type="radio"
          name="application-cv"
          value={UPLOAD_CHOICE_ID}
          checked={selected}
          onChange={onSelect}
          onClick={(event) => event.stopPropagation()}
          aria-label="Tải CV từ máy tính"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
        />
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="flex items-center justify-center gap-3">
            {uploading
              ? <Spin size="small" />
              : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-400"><UploadOutlined /></span>}
            <span className="text-sm font-semibold text-slate-800">
              Tải CV từ máy tính, chọn hoặc kéo thả
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">Hỗ trợ định dạng PDF, DOCX có kích thước dưới 5MB</p>
          <Button
            disabled={uploading}
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
              onChooseFile()
            }}
            className="mt-2 !border-0 !bg-slate-100 !px-7 !font-semibold !text-slate-700 hover:!bg-slate-200"
          >
            Chọn CV
          </Button>
        </div>
        <span />
      </div>

      {selected && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          {file && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
              <FileTextOutlined className="text-xl text-[var(--brand-primary)]" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--brand-primary)]">
                {file.name}
              </span>
              <button
                type="button"
                aria-label="Xóa CV tải lên"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteFile()
                }}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100"
              >
                <DeleteOutlined />
              </button>
              <Button
                onClick={(event) => {
                  event.stopPropagation()
                  onChooseFile()
                }}
                className="!border-0 !bg-slate-100 !font-semibold !text-slate-700 hover:!bg-slate-200"
              >
                Chọn CV khác
              </Button>
            </div>
          )}

          <div className={file ? 'pt-3' : ''}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--brand-primary)]">
                Vui lòng nhập đầy đủ thông tin chi tiết:
              </p>
              <p className="text-xs text-rose-500">(*) Thông tin bắt buộc.</p>
            </div>

            <label className="block">
              <RequiredLabel>Họ và tên</RequiredLabel>
              <Input
                size="large"
                aria-label="Họ và tên ứng tuyển"
                value={contactName}
                onChange={(event) => onContactNameChange(event.target.value)}
                placeholder="Họ tên hiển thị với Nhà tuyển dụng"
                className="!rounded-lg"
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                <RequiredLabel>Email</RequiredLabel>
                <Input
                  size="large"
                  type="email"
                  aria-label="Email ứng tuyển"
                  value={contactEmail}
                  onChange={(event) => onContactEmailChange(event.target.value)}
                  placeholder="Email hiển thị với Nhà tuyển dụng"
                  className="!rounded-lg"
                />
              </label>
              <label>
                <RequiredLabel>Số điện thoại</RequiredLabel>
                <Input
                  size="large"
                  aria-label="Số điện thoại ứng tuyển"
                  value={contactPhone}
                  onChange={(event) => onContactPhoneChange(event.target.value)}
                  placeholder="Số điện thoại hiển thị với Nhà tuyển dụng"
                  className="!rounded-lg"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
