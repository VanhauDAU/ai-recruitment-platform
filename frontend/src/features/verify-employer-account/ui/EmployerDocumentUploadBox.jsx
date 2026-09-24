import {
  CloseOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  LoadingOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Button, Modal, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { message } from '@/shared/lib/toast'
import { getUploadStatePresentation } from '@/shared/api/upload-session'

const MAX_FILE_SIZE = 5 * 1024 * 1024

function uploadFileKey(file, index) {
  return file.uid || `${file.name}-${file.lastModified || index}`
}

function SelectedFileItem({
  file,
  disabled,
  onPreview,
  onRemove,
  previewing,
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const rawFile = file.originFileObj || file
  const fileName = file.name || rawFile.name
  const fileType = file.type || rawFile.type || ''
  const isImage = fileType.startsWith('image/')
  const isWord = fileType === 'application/msword'
    || fileType.includes('wordprocessingml')
    || /\.(doc|docx)$/i.test(fileName)

  useEffect(() => {
    if (
      !isImage
      || typeof URL.createObjectURL !== 'function'
      || typeof Blob === 'undefined'
      || !(rawFile instanceof Blob)
    ) return undefined

    const objectUrl = URL.createObjectURL(rawFile)
    setThumbnailUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [isImage, rawFile])

  return (
    <li className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
      <button
        type="button"
        aria-label={`Xem trước tệp ${fileName}`}
        disabled={disabled || previewing}
        onClick={() => onPreview(rawFile, fileName)}
        className="group block w-full cursor-pointer rounded text-left disabled:cursor-wait disabled:opacity-60"
      >
        <span className="flex h-28 items-center justify-center overflow-hidden rounded bg-slate-50">
          {previewing
            ? <LoadingOutlined className="text-3xl text-emerald-600" spin />
            : isImage && thumbnailUrl
              ? <img src={thumbnailUrl} alt={`Xem trước ${fileName}`} className="h-full w-full object-contain" />
              : isWord
                ? <FileWordOutlined className="text-4xl text-blue-600" />
                : <FilePdfOutlined className="text-4xl text-red-500" />}
        </span>
        <span className="mt-2 flex min-w-0 items-center gap-1 text-xs text-slate-600 group-hover:text-emerald-700">
          <EyeOutlined className="shrink-0" />
          <span className="truncate">Tệp mới: {fileName}</span>
        </span>
      </button>
      <Button
        type="text"
        size="small"
        aria-label={`Bỏ tệp ${fileName}`}
        icon={<CloseOutlined />}
        disabled={disabled || previewing}
        onClick={onRemove}
        className="mt-1 !h-7 !w-full !text-slate-500"
      >
        Bỏ tệp
      </Button>
    </li>
  )
}

export default function EmployerDocumentUploadBox({
  accept,
  className = '',
  disabled,
  files,
  label,
  maxCount = 1,
  multiple = false,
  onFilesChange,
  onResolvePreview,
  previewing = false,
  uploadHint,
  uploadState,
}) {
  const [openingFileKey, setOpeningFileKey] = useState('')
  const [previewFile, setPreviewFile] = useState(null)

  useEffect(() => () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url)
  }, [previewFile])

  async function openPreview(rawFile, fileName, fileKey) {
    if (
      typeof URL.createObjectURL !== 'function'
      || typeof Blob === 'undefined'
      || !(rawFile instanceof Blob)
    ) return

    setOpeningFileKey(fileKey)
    try {
      const previewContent = onResolvePreview
        ? await onResolvePreview(rawFile)
        : rawFile
      const previewUrl = URL.createObjectURL(previewContent)
      setPreviewFile({
        name: fileName,
        type: previewContent.type || rawFile.type || '',
        url: previewUrl,
      })
    } catch {
      // The caller reports the mapped API error and the upload remains editable.
    } finally {
      setOpeningFileKey('')
    }
  }

  const selectedFiles = files || []
  const effectiveMaxCount = multiple ? maxCount : 1
  const uploadStateMeta = getUploadStatePresentation(uploadState)

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      {label && (
        <h3 className="mb-2 text-sm font-semibold text-slate-800">
          {label} <span className="text-red-500">*</span>
        </h3>
      )}
      <Upload.Dragger
        accept={accept}
        beforeUpload={(file) => {
          if (file.size > MAX_FILE_SIZE) {
            message.error(`Tệp "${file.name}" vượt quá dung lượng tối đa 5MB.`)
            return Upload.LIST_IGNORE
          }
          return false
        }}
        disabled={disabled}
        fileList={selectedFiles}
        maxCount={effectiveMaxCount}
        multiple={multiple}
        showUploadList={false}
        onChange={({ fileList }) => onFilesChange(fileList.slice(-effectiveMaxCount))}
        className="!rounded-lg !border-dashed !border-slate-300 !bg-white !px-4 !py-2 hover:!border-emerald-500"
      >
        <p className="mb-1 text-sm font-medium text-slate-600">
          {multiple ? 'Chọn hoặc kéo nhiều tệp vào đây' : 'Chọn hoặc kéo tệp vào đây'}
        </p>
        <p className="mb-2 text-xs text-slate-500">{uploadHint}</p>
        <Button type="text" icon={<UploadOutlined />} className="!h-8 !border !border-emerald-100 !bg-emerald-50 !text-emerald-600">
          {multiple ? 'Chọn các tệp' : 'Chọn tệp'}
        </Button>
      </Upload.Dragger>
      {uploadStateMeta && (
        <p className={`mt-2 text-xs ${uploadStateMeta.tone}`} role="status">
          {uploadStateMeta.text}
        </p>
      )}
      {selectedFiles.length > 0 && (
        <ul
          aria-label={label ? `Các tệp đã chọn cho ${label}` : 'Các tệp đã chọn'}
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {selectedFiles.map((file, index) => {
            const fileKey = uploadFileKey(file, index)
            return (
              <SelectedFileItem
                key={fileKey}
                file={file}
                disabled={disabled}
                previewing={previewing || openingFileKey === fileKey}
                onPreview={(rawFile, fileName) => openPreview(
                  rawFile,
                  fileName,
                  fileKey,
                )}
                onRemove={() => onFilesChange(
                  selectedFiles.filter((_, fileIndex) => fileIndex !== index),
                )}
              />
            )
          })}
        </ul>
      )}
      <Modal
        centered
        destroyOnHidden
        footer={null}
        open={Boolean(previewFile)}
        title={previewFile?.name}
        width={760}
        onCancel={() => setPreviewFile(null)}
      >
        {previewFile?.type.startsWith('image/')
          ? (
              <img
                src={previewFile.url}
                alt={`Xem trước ${previewFile.name}`}
                className="mx-auto max-h-[70vh] max-w-full object-contain"
              />
            )
          : previewFile?.type.includes('wordprocessingml')
            ? (
                <div className="rounded-lg bg-slate-50 p-6 text-center">
                  <FileWordOutlined className="text-5xl text-blue-600" />
                  <p className="mt-3 text-sm text-slate-600">
                    Trình duyệt không xem trực tiếp tệp DOCX. Bạn có thể tải tệp đã chọn để kiểm tra.
                  </p>
                  <a
                    className="mt-4 inline-flex rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700"
                    download={previewFile.name}
                    href={previewFile.url}
                  >
                    Tải tệp đã chọn
                  </a>
                </div>
              )
            : (
              <iframe
                src={previewFile?.url}
                title={`Xem trước ${previewFile?.name}`}
                className="h-[70vh] w-full rounded border-0"
              />
              )}
      </Modal>
    </div>
  )
}
