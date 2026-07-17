import { CheckCircleFilled, DownloadOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Modal, Progress, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { createCvPdfExport, downloadCvPdf, getCvPdfExport, retryCvPdfExport } from '@/entities/cv'

function triggerBrowserDownload(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1_000)
}

export default function CvDownloadButton({ publicId, versionPublicId, title }) {
  const [open, setOpen] = useState(false)
  const [job, setJob] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const downloadedJobRef = useRef(null)

  useEffect(() => {
    if (!job || !['pending', 'processing'].includes(job.status)) return undefined
    const timer = window.setInterval(() => {
      getCvPdfExport(publicId, job.public_id)
        .then(setJob)
        .catch(() => setError('Không thể cập nhật trạng thái tạo PDF.'))
    }, 2_000)
    return () => window.clearInterval(timer)
  }, [job, publicId])

  useEffect(() => {
    if (job?.status !== 'completed' || !job.download_url || downloadedJobRef.current === job.public_id) return
    downloadedJobRef.current = job.public_id
    setSubmitting(true)
    downloadCvPdf(job.download_url)
      .then((blob) => {
        triggerBrowserDownload(blob, `${title || 'CV'}.pdf`)
        message.success('CV đã sẵn sàng và đang được tải xuống.')
      })
      .catch(() => setError('Không thể tải PDF. Vui lòng thử lại.'))
      .finally(() => setSubmitting(false))
  }, [job, publicId, title])

  async function startDownload() {
    setOpen(true)
    setSubmitting(true)
    setError('')
    downloadedJobRef.current = null
    try {
      setJob(await createCvPdfExport(publicId, versionPublicId))
    } catch {
      setError('Không thể tạo bản PDF. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  async function retry() {
    if (!job) return startDownload()
    setSubmitting(true)
    setError('')
    try {
      setJob(await retryCvPdfExport(publicId, job.public_id))
    } catch {
      setError('Không thể gửi lại yêu cầu tạo PDF.')
    } finally {
      setSubmitting(false)
    }
  }

  const progress = job?.status === 'completed' ? 100 : job?.status === 'processing' ? 72 : 34
  return (
    <>
      <Button type="primary" shape="round" size="large" icon={<DownloadOutlined />} className="!bg-[#00b14f] hover:!bg-[#009643]" onClick={startDownload}>
        Tải về
      </Button>
      <Modal open={open} footer={null} onCancel={() => setOpen(false)} centered width={480}>
        <div className="px-2 py-4 text-center">
          {job?.status === 'completed' && !error ? (
            <CheckCircleFilled className="text-5xl text-[#00b14f]" />
          ) : (
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl text-[#00b14f]"><LoadingOutlined spin /></span>
          )}
          <h3 className="mt-4 text-xl font-extrabold text-slate-800">
            {job?.status === 'completed' ? 'CV đã sẵn sàng!' : 'Đang chuẩn bị CV của bạn'}
          </h3>
          <p className="mt-2 text-sm text-slate-500">PDF được tạo từ đúng phiên bản vừa lưu trên máy chủ.</p>
          <Progress className="mt-5" percent={progress} showInfo={false} strokeColor="#00b14f" />
          {error && <Alert className="mt-4 text-left" type="error" showIcon title={error} />}
          {(error || job?.status === 'failed') && <Button className="mt-4" icon={<ReloadOutlined />} loading={submitting} onClick={retry}>Thử lại</Button>}
          {job?.status === 'completed' && <Button className="mt-4" onClick={() => setOpen(false)}>Đóng</Button>}
        </div>
      </Modal>
    </>
  )
}
