import {
  DownloadOutlined,
  FileTextOutlined,
  UploadOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { Button, Upload } from 'antd'

const AUTHORIZATION_TEMPLATE_URL = 'https://docs.google.com/document/d/1_cQDRuVuibU7XP1YPcsjpSYB8jokcqyR/edit?usp=sharing&ouid=111388583364027655585&rtpof=true&sd=true'
const ACCEPTED_FILE_TYPES = '.jpeg,.jpg,.png,.pdf'
const UPLOAD_HINT = 'Dung lượng tối đa 5MB, định dạng: jpeg, jpg, png, pdf'
const SAMPLE_IMAGES = {
  business: { src: '/images/employer/business-registration-sample.jpg', alt: 'Minh họa giấy chứng nhận đăng ký doanh nghiệp' },
  authorization: { src: '/images/employer/authorization-sample.jpg', alt: 'Minh họa giấy ủy quyền' },
  identity: { src: '/images/employer/identity-sample.jpg', alt: 'Minh họa căn cước công dân hoặc hộ chiếu' },
}

function Illustration({ variant }) {
  const image = SAMPLE_IMAGES[variant]

  return <img src={image.src} alt={image.alt} className="h-[128px] max-w-[176px] rounded border border-slate-200 bg-white object-contain shadow-sm" loading="lazy" />
}

function UploadBox({ label, files, onFilesChange, disabled }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{label} <span className="text-red-500">*</span></h3>
      <Upload.Dragger
        accept={ACCEPTED_FILE_TYPES}
        beforeUpload={() => false}
        disabled={disabled}
        fileList={files}
        maxCount={1}
        multiple={false}
        showUploadList={false}
        onChange={({ fileList }) => onFilesChange(fileList.slice(-1))}
        className="!rounded-lg !border-dashed !border-slate-300 !bg-white !px-4 !py-2 hover:!border-emerald-500"
      >
        <p className="mb-1 text-sm font-medium text-slate-600">Chọn hoặc kéo file vào đây</p>
        <p className="mb-2 text-xs text-slate-500">{UPLOAD_HINT}</p>
        <Button type="text" icon={<UploadOutlined />} className="!h-8 !border !border-emerald-100 !bg-emerald-50 !text-emerald-600">Chọn file</Button>
      </Upload.Dragger>
      {files[0] && <p className="mt-2 truncate text-xs text-emerald-700">Đã chọn: {files[0].name}</p>}
    </div>
  )
}

function UploadNotice({ documentName }) {
  return (
    <div className="mt-2 flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-600">
      <WarningFilled className="mt-0.5 shrink-0" />
      <ul className="list-disc space-y-0.5 pl-3">
        <li>Các văn bản đăng tải cần đầy đủ các mặt và không có dấu hiệu chỉnh sửa/ che/ cắt thông tin.</li>
        {documentName && <li>Vui lòng đăng tải {documentName} có thông tin trùng khớp với dữ liệu doanh nghiệp theo Trang thông tin điện tử của Cục Thuế.</li>}
      </ul>
    </div>
  )
}

export function EmployerBusinessDocumentCard({
  label,
  files,
  onFilesChange,
  variant,
  noticeDocument,
  showTemplate = false,
  disabled,
  savedDocument,
  submittedFileLabel,
  onViewDocument,
  viewingDocument,
}) {
  const displayedFileName = submittedFileLabel || savedDocument?.file_name || label

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 p-4 sm:p-6">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          {savedDocument ? (
            <>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">{label} <span className="text-red-500">*</span></h3>
              <button
                type="button"
                aria-label={`Xem tệp đã nộp: ${displayedFileName}`}
                disabled={viewingDocument}
                onClick={() => onViewDocument(savedDocument)}
                className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm font-medium text-slate-700 transition hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
              >
                <FileTextOutlined className="text-emerald-600" />
                <span className="truncate">{viewingDocument ? 'Đang mở tệp...' : displayedFileName}</span>
              </button>
            </>
          ) : (
            <>
              <UploadBox label={label} files={files} onFilesChange={onFilesChange} disabled={disabled} />
              <UploadNotice documentName={noticeDocument} />
            </>
          )}
        </div>
        <aside className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-slate-800">Minh họa</p>
          <Illustration variant={variant} />
          {showTemplate && <a href={AUTHORIZATION_TEMPLATE_URL} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500 px-4 py-2 text-center text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 sm:w-auto"><DownloadOutlined />Tải mẫu giấy ủy quyền</a>}
        </aside>
      </div>
    </section>
  )
}
