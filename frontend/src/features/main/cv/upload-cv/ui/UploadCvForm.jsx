import { CheckCircleFilled, CloudUploadOutlined, FileTextOutlined } from '@ant-design/icons'
import { Alert, Button, Upload } from 'antd'
import { CV_ACCEPT, CV_UPLOAD_STANDARDS } from '../model/cv-upload-standards'
import { useUploadCv } from '../model/use-upload-cv'

/** Chọn/kéo thả một tệp CV, kiểm tra sớm rồi tải lên; báo `onUploaded(cv)` khi xong. */
export default function UploadCvForm({ onUploaded, disabled = false }) {
  const { file, error, uploading, uploadStatus, choose, submit } = useUploadCv({ onUploaded })

  return (
    <div className="space-y-4">
      <div>
        <Upload.Dragger
          accept={CV_ACCEPT}
          multiple={false}
          showUploadList={false}
          disabled={disabled || uploading}
          beforeUpload={(picked) => {
            choose(picked)
            return Upload.LIST_IGNORE
          }}
          className="block"
        >
          <div className="px-4 py-3">
            {file ? (
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
                <FileTextOutlined className="text-lg text-[var(--brand-primary)]" />
                <span className="truncate">{file.name}</span>
              </p>
            ) : (
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
                <CloudUploadOutlined className="text-2xl text-slate-400" />
                Tải lên CV từ máy tính, chọn hoặc kéo thả
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">Hỗ trợ PDF, DOCX dưới 5MB</p>
            <span className="mt-3 inline-block rounded-md bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-700">
              {file ? 'Chọn tệp khác' : 'Chọn CV'}
            </span>
          </div>
        </Upload.Dragger>
      </div>

      <ul className="space-y-1 text-xs text-slate-500">
        {CV_UPLOAD_STANDARDS.map((rule) => (
          <li key={rule} className="flex gap-2"><CheckCircleFilled className="mt-0.5 text-[var(--brand-primary)]" />{rule}</li>
        ))}
      </ul>

      {error && <Alert type="error" showIcon title={error} />}
      {uploadStatus && <p role="status" className={`text-sm font-medium ${uploadStatus.tone}`}>{uploadStatus.text}</p>}

      <div className="flex justify-center">
        <Button
          type="primary"
          size="large"
          onClick={submit}
          loading={uploading}
          disabled={disabled || !file}
          className="!bg-[var(--brand-primary)] !font-bold disabled:!bg-slate-200"
        >
          Tải CV lên
        </Button>
      </div>
    </div>
  )
}
