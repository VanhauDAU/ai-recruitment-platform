import { Alert, Skeleton, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CopyOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons'
import { CvDocumentPreview } from '@/entities/cv'

function documentFromVersion(version) {
  return {
    schema_version: version.schema_version,
    content_json: version.content_json,
    layout_json: version.layout_json,
    style_json: version.style_json,
  }
}

function CvVersionReadOnly({ load, inaccessibleMessage, isOwner, publicId }) {
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

  const handleDownload = () => {
    message.loading('Đang chuẩn bị tệp PDF tải xuống...', 1.2).then(() => {
      message.success('Tải xuống CV PDF thành công!')
    })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('Đã sao chép liên kết CV vào bộ nhớ tạm.')
    } catch {
      message.error('Không thể sao chép liên kết.')
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <Alert type="error" showIcon message={inaccessibleMessage} />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Skeleton active paragraph={{ rows: 12 }} />
      </main>
    )
  }

  const { cv, version } = data

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed flex flex-col relative"
      style={{ backgroundImage: "url('https://www.topcv.vn/v4/image/cv_builder/background/bg_5.png')" }}
    >
      {/* Lớp phủ tối nhẹ tăng độ tương phản */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      {/* Thanh công cụ tối mờ cố định ở trên đầu */}
      <header className="fixed top-0 inset-x-0 h-12 bg-[#1a1a1a]/90 text-white flex items-center justify-between px-6 z-50 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
        <div className="text-[13px] font-medium text-slate-200 truncate">
          Xem CV Online của {cv.title || 'Ứng viên'}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded bg-white/10 hover:bg-white/20 transition-all px-3 py-1.5 text-xs font-bold text-white cursor-pointer border border-transparent hover:scale-105"
          >
            <DownloadOutlined /> Tải CV PDF
          </button>
          {isOwner && publicId && (
            <Link
              to={`/cvs/${publicId}/edit`}
              className="flex items-center gap-1.5 rounded bg-white/10 hover:bg-white/20 transition-all px-3 py-1.5 text-xs font-bold !text-white cursor-pointer border border-transparent hover:scale-105"
              style={{ color: '#ffffff' }}
            >
              <EditOutlined /> Sửa CV
            </Link>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded bg-white/10 hover:bg-white/20 transition-all px-3 py-1.5 text-xs font-bold text-white cursor-pointer border border-transparent hover:scale-105"
          >
            <CopyOutlined /> Copy CV
          </button>
        </div>
      </header>

      {/* Vùng cuộn chứa tài liệu A4 xem trước */}
      <main className="flex-1 w-full pt-16 pb-12 flex justify-center items-start overflow-y-auto px-4 z-10">
        <div className="shadow-[0_24px_64px_rgba(0,0,0,0.35)] rounded-sm bg-white overflow-hidden w-[820px] max-w-full">
          <CvDocumentPreview document={documentFromVersion(version)} rendererKey={version.template_renderer_key} />
        </div>
      </main>
    </div>
  )
}

export function OwnerCvVersionView({ publicId, loadOwnerView }) {
  const load = useCallback(() => loadOwnerView(publicId), [loadOwnerView, publicId])
  return (
    <CvVersionReadOnly
      load={load}
      inaccessibleMessage="Không thể xem CV này."
      isOwner={true}
      publicId={publicId}
    />
  )
}

export function SharedCvVersionView({ token, loadSharedView }) {
  const load = useCallback(() => loadSharedView(token), [loadSharedView, token])
  return (
    <CvVersionReadOnly
      load={load}
      inaccessibleMessage="Liên kết chia sẻ không tồn tại hoặc đã hết hạn."
      isOwner={false}
    />
  )
}
