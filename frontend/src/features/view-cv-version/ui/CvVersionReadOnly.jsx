import { Alert, Skeleton, Tag } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { CvDocumentPreview } from '@/entities/cv'

function documentFromVersion(version) {
  return {
    schema_version: version.schema_version,
    content_json: version.content_json,
    layout_json: version.layout_json,
    style_json: version.style_json,
  }
}

function CvVersionReadOnly({ load, heading, inaccessibleMessage }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setData(null)
    setError(false)
    load().then((response) => {
      if (active) setData(response)
    }).catch(() => {
      if (active) setError(true)
    })
    return () => { active = false }
  }, [load])

  if (error) return <main className="mx-auto max-w-4xl px-4 py-12"><Alert type="error" showIcon title={inaccessibleMessage} /></main>
  if (!data) return <main className="mx-auto max-w-6xl px-4 py-10"><Skeleton active paragraph={{ rows: 12 }} /></main>

  const { cv, version } = data
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[var(--brand-primary)]">{heading}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold text-slate-900">{cv.title}</h1><Tag color="blue">Phiên bản {version.version_number}</Tag></div>
        <p className="mt-2 text-sm text-slate-500">Nội dung chỉ đọc từ phiên bản đã lưu, không phải bản nháp đang chỉnh sửa.</p>
      </header>
      <CvDocumentPreview document={documentFromVersion(version)} rendererKey={version.template_renderer_key} />
    </main>
  )
}

export function OwnerCvVersionView({ publicId, loadOwnerView }) {
  const load = useCallback(() => loadOwnerView(publicId), [loadOwnerView, publicId])
  return <CvVersionReadOnly load={load} heading="CV của bạn" inaccessibleMessage="Không thể xem CV này." />
}

export function SharedCvVersionView({ token, loadSharedView }) {
  const load = useCallback(() => loadSharedView(token), [loadSharedView, token])
  return <CvVersionReadOnly load={load} heading="CV được chia sẻ" inaccessibleMessage="Liên kết chia sẻ không tồn tại hoặc đã hết hạn." />
}
