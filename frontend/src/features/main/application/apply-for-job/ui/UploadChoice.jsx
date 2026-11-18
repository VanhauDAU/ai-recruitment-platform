import { CloudUploadOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons'
import { Button, Spin } from 'antd'
import { getUploadStatePresentation } from '@/shared/api/upload-session'
import { UPLOAD_CHOICE_ID } from '../model/use-apply-form'

/** Lựa chọn "tải tệp CV mới từ máy"; `children` là form liên hệ hiện khi đang chọn. */
export default function UploadChoice({
  selected,
  uploading,
  uploadState,
  file,
  onSelect,
  onChooseFile,
  onDeleteFile,
  onDrop,
  children,
}) {
  const uploadStateMeta = getUploadStatePresentation(uploadState)
  const chooseFile = (event) => {
    event.stopPropagation()
    onSelect()
    onChooseFile()
  }
  return (
    <div
      onClick={onSelect}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={`af-upload${selected ? ' af-upload--selected' : ''}`}
    >
      <div className="af-upload__row">
        <input
          type="radio"
          name="application-cv"
          value={UPLOAD_CHOICE_ID}
          checked={selected}
          onChange={onSelect}
          onClick={(event) => event.stopPropagation()}
          aria-label="Tải CV từ máy tính"
          className="af-upload__radio"
        />
        <div className="af-upload__main">
          <span className="af-upload__title">
            {uploading ? <Spin size="small" /> : <CloudUploadOutlined className="af-upload__icon" />}
            Tải CV từ máy tính, chọn hoặc kéo thả
          </span>
          <span className="af-upload__hint">Hỗ trợ định dạng PDF, DOCX có kích thước dưới 5MB</span>
          {uploadStateMeta && (
            <span role="status" className={`af-upload__state ${uploadStateMeta.tone}`}>{uploadStateMeta.text}</span>
          )}
          {!file && <Button size="small" disabled={uploading} onClick={chooseFile}>Chọn CV</Button>}
        </div>
        <span className="af-upload__spacer" />
      </div>

      {selected && (
        <div className="af-upload__body">
          {file && (
            <div className="af-upload__file">
              <FileTextOutlined className="af-upload__file-icon" />
              <span className="af-upload__filename">{file.name}</span>
              <button
                type="button"
                aria-label="Xóa CV tải lên"
                disabled={uploading}
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteFile()
                }}
                className="af-upload__remove"
              >
                <DeleteOutlined />
              </button>
              <Button size="small" disabled={uploading} onClick={chooseFile}>Chọn CV khác</Button>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
