import { CopyOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { cvApiErrorMessage, duplicateCv, getUploadedCvFile } from '@/entities/cv'
import { CvDownloadButton } from '@/features/export-cv-pdf'
import { VIEWER_ACTION_CLASS } from '@/features/view-cv-version'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
import { message } from '@/shared/lib/toast'

function DownloadSourceAction({ cv }) {
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      triggerBlobDownload(await getUploadedCvFile(cv.public_id), `${(cv.title || 'CV').replace(/\.(pdf|docx)$/i, '')}.pdf`)
    } catch {
      message.error('Không thể tải CV. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }
  return <button type="button" disabled={busy} onClick={download} className={VIEWER_ACTION_CLASS}><DownloadOutlined /> Tải CV PDF</button>
}

/** Tải CV PDF, Sửa CV và Copy CV trên thanh xem CV của chủ sở hữu. */
export default function OwnerCvActions({ cv, version }) {
  const navigate = useNavigate()
  const [copying, setCopying] = useState(false)

  if (cv.cv_type === 'uploaded') return <DownloadSourceAction cv={cv} />

  const copyCv = async () => {
    setCopying(true)
    try {
      const copy = await duplicateCv(cv.public_id)
      message.success('Đã tạo bản sao CV.')
      navigate(`/cvs/${copy.public_id}/edit`)
    } catch (error) {
      message.error(cvApiErrorMessage(error, 'Không thể tạo bản sao CV.'))
    } finally {
      setCopying(false)
    }
  }

  return (
    <>
      <CvDownloadButton
        publicId={cv.public_id}
        versionPublicId={version.public_id}
        title={cv.title}
        renderTrigger={({ onClick }) => <button type="button" onClick={onClick} className={VIEWER_ACTION_CLASS}><DownloadOutlined /> Tải CV PDF</button>}
      />
      <Link to={`/cvs/${cv.public_id}/edit`} className={VIEWER_ACTION_CLASS}><EditOutlined /> Sửa CV</Link>
      <button type="button" disabled={copying} onClick={copyCv} className={VIEWER_ACTION_CLASS}><CopyOutlined /> Copy CV</button>
    </>
  )
}
