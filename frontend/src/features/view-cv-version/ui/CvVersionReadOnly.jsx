import { CopyOutlined } from '@ant-design/icons'
import { Alert, Skeleton } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { FittedCvPreview, UploadedCvPreview } from '@/entities/cv'
import { message } from '@/shared/lib/toast'
import { legacyAsset } from '@/shared/config/assets'

export const VIEWER_ACTION_CLASS = 'inline-flex cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent px-2.5 py-1.5 text-xs font-semibold !text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60'

function documentFromVersion(version) {
  return {
    schema_version: version.schema_version,
    content_json: version.content_json,
    layout_json: version.layout_json,
    style_json: version.style_json,
  }
}

function CopyLinkAction() {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('Đã sao chép liên kết CV vào bộ nhớ tạm.')
    } catch {
      message.error('Không thể sao chép liên kết.')
    }
  }
  return <button type="button" onClick={copy} className={VIEWER_ACTION_CLASS}><CopyOutlined /> Sao chép liên kết</button>
}

// Trang xem CV toàn màn hình: thanh thao tác mảnh ở trên, CV A4 ở giữa nền ảnh.
function CvVersionReadOnly({ load, inaccessibleMessage, shareToken, renderActions }) {
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

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <Alert type="error" showIcon title={inaccessibleMessage} />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton active paragraph={{ rows: 12 }} />
      </main>
    )
  }

  const { cv, version } = data
  // CV tải lên không có nội dung có cấu trúc: hiển thị tệp gốc thay vì version.
  const showSourceFile = cv.cv_type === 'uploaded'

  return (
    <div
      className="min-h-dvh w-full bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `url('${legacyAsset('cv-builder/bg-5.png')}')` }}
    >
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 bg-[#10242b]/85 px-3 text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:px-5">
        <h1 className="min-w-0 truncate text-[13px] font-medium text-slate-100">
          <span className="hidden sm:inline">Xem CV Online của</span> {cv.title || 'Ứng viên'}
        </h1>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {renderActions ? renderActions(data) : <CopyLinkAction />}
        </div>
      </header>

      <main className="flex justify-center px-2 py-6 sm:px-4 sm:py-8">
        {showSourceFile ? (
          <div className="w-[820px] max-w-full bg-white shadow-[0_24px_64px_rgba(0,0,0,0.35)]" style={{ height: 'calc(100dvh - 6rem)' }}>
            <UploadedCvPreview publicId={cv.public_id} shareToken={shareToken} title={cv.title} className="h-full w-full" />
          </div>
        ) : (
          <div className="w-[794px] max-w-full">
            <FittedCvPreview
              document={documentFromVersion(version)}
              rendererKey={version.template_renderer_key}
              assets={version.assets}
              className="shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
            />
          </div>
        )}
      </main>
    </div>
  )
}

export function OwnerCvVersionView({ publicId, loadOwnerView, renderActions }) {
  const load = useCallback(() => loadOwnerView(publicId), [loadOwnerView, publicId])
  return (
    <CvVersionReadOnly
      load={load}
      inaccessibleMessage="Không thể xem CV này."
      renderActions={renderActions}
    />
  )
}

export function SharedCvVersionView({ token, loadSharedView }) {
  const load = useCallback(() => loadSharedView(token), [loadSharedView, token])
  return (
    <CvVersionReadOnly
      load={load}
      inaccessibleMessage="Liên kết chia sẻ không tồn tại hoặc đã hết hạn."
      shareToken={token}
    />
  )
}
