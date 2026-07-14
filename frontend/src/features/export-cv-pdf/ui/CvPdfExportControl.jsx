import { Alert, Button, Select, Skeleton, Tag } from 'antd'
import { useEffect, useState } from 'react'
import {
  createCvPdfExport,
  downloadCvPdf,
  getCv,
  getCvPdfExport,
  getCvVersions,
  retryCvPdfExport,
} from '@/entities/cv'

const STATUS_LABELS = {
  pending: 'Đang chờ xuất',
  processing: 'Đang tạo PDF',
  completed: 'PDF đã sẵn sàng',
  failed: 'Xuất PDF thất bại',
}

function versionLabel(version) {
  return `Phiên bản ${version.version_number}${version.version_kind === 'published' ? ' (đã publish)' : ''}`
}

function triggerBrowserDownload(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(objectUrl)
}

export default function CvPdfExportControl({ publicId }) {
  const [versions, setVersions] = useState([])
  const [versionPublicId, setVersionPublicId] = useState()
  const [exportJob, setExportJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getCv(publicId), getCvVersions(publicId)])
      .then(([cv, availableVersions]) => {
        if (!active) return
        setVersions(availableVersions)
        setVersionPublicId(cv.published_version_public_id || cv.latest_version_public_id || availableVersions[0]?.public_id)
      })
      .catch(() => {
        if (active) setError('Không thể tải danh sách phiên bản để xuất PDF.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [publicId])

  useEffect(() => {
    if (!exportJob || !['pending', 'processing'].includes(exportJob.status)) return undefined
    const timer = window.setInterval(() => {
      getCvPdfExport(publicId, exportJob.public_id)
        .then(setExportJob)
        .catch(() => setError('Không thể cập nhật trạng thái xuất PDF.'))
    }, 3000)
    return () => window.clearInterval(timer)
  }, [exportJob, publicId])

  async function queueExport() {
    if (!versionPublicId) return
    setSubmitting(true)
    setError('')
    try {
      setExportJob(await createCvPdfExport(publicId, versionPublicId))
    } catch {
      setError('Không thể tạo yêu cầu xuất PDF.')
    } finally {
      setSubmitting(false)
    }
  }

  async function retryExport() {
    if (!exportJob) return
    setSubmitting(true)
    setError('')
    try {
      setExportJob(await retryCvPdfExport(publicId, exportJob.public_id))
    } catch {
      setError('Không thể gửi lại yêu cầu xuất PDF.')
    } finally {
      setSubmitting(false)
    }
  }

  async function downloadExport() {
    if (!exportJob?.download_url) return
    setSubmitting(true)
    setError('')
    try {
      const blob = await downloadCvPdf(exportJob.download_url)
      triggerBrowserDownload(blob, `cv-${publicId}-v${exportJob.version_public_id}.pdf`)
    } catch {
      setError('Không thể tải PDF. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-4 pt-6"><Skeleton active paragraph={{ rows: 1 }} /></div>

  return (
    <section aria-label="Xuất PDF CV" className="mx-auto mb-4 max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex md:items-center md:justify-between md:gap-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">Xuất PDF</h2>
        <p className="mt-1 text-sm text-slate-500">PDF được tạo từ phiên bản đã lưu trên máy chủ, không dùng bản nháp hoặc Preview trên trình duyệt.</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0">
        <Select
          aria-label="Chọn phiên bản PDF"
          className="min-w-56"
          value={versionPublicId}
          options={versions.map((version) => ({ value: version.public_id, label: versionLabel(version) }))}
          onChange={setVersionPublicId}
          disabled={submitting || versions.length === 0}
        />
        <Button type="primary" onClick={queueExport} loading={submitting} disabled={!versionPublicId}>Xuất PDF</Button>
      </div>
      {exportJob && (
        <div className="mt-3 flex flex-wrap items-center gap-2 md:col-span-2 md:justify-self-end">
          <Tag color={exportJob.status === 'completed' ? 'green' : exportJob.status === 'failed' ? 'red' : 'blue'}>{STATUS_LABELS[exportJob.status] || exportJob.status}</Tag>
          {exportJob.status === 'failed' && <Button onClick={retryExport} loading={submitting}>Thử lại</Button>}
          {exportJob.status === 'completed' && exportJob.download_url && <Button onClick={downloadExport} loading={submitting}>Tải PDF</Button>}
        </div>
      )}
      {error && <Alert className="mt-3 md:col-span-2" type="error" showIcon title={error} />}
      {!error && versions.length === 0 && <Alert className="mt-3 md:col-span-2" type="info" showIcon title="CV chưa có phiên bản đã lưu để xuất PDF." />}
    </section>
  )
}
