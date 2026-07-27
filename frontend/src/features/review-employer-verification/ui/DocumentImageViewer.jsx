import {
  CompressOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  OneToOneOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'
import { Button, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 50
const MAX_ZOOM = 400
const ZOOM_STEP = 25

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export default function DocumentImageViewer({
  src,
  alt,
  contentType,
  onError,
}) {
  const viewerRef = useRef(null)
  const [zoom, setZoom] = useState(100)
  const [fitToViewport, setFitToViewport] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    setZoom(100)
    setFitToViewport(true)
  }, [src])

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === viewerRef.current)
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  const changeZoom = (delta) => {
    setFitToViewport(false)
    setZoom((current) => clampZoom((fitToViewport ? 100 : current) + delta))
  }

  const resetZoom = () => {
    setFitToViewport(false)
    setZoom(100)
  }

  const fitImage = () => {
    setZoom(100)
    setFitToViewport(true)
  }

  const toggleFullscreen = async () => {
    if (!viewerRef.current?.requestFullscreen) return
    if (document.fullscreenElement === viewerRef.current) {
      await document.exitFullscreen()
      return
    }
    await viewerRef.current.requestFullscreen()
  }

  const handleKeyDown = (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      changeZoom(ZOOM_STEP)
    } else if (event.key === '-') {
      event.preventDefault()
      changeZoom(-ZOOM_STEP)
    } else if (event.key === '0') {
      event.preventDefault()
      resetZoom()
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      fitImage()
    }
  }

  const handleWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
  }

  const zoomLabel = fitToViewport ? 'Vừa khung' : `${zoom}%`
  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled

  return (
    <div
      ref={viewerRef}
      className="verification-image-viewer"
      data-fullscreen={isFullscreen || undefined}
    >
      <div
        className="verification-image-toolbar"
        role="toolbar"
        aria-label="Điều khiển phóng thu giấy tờ"
      >
        <Button
          icon={<ZoomOutOutlined />}
          aria-label="Thu nhỏ giấy tờ"
          title="Thu nhỏ (-)"
          disabled={!fitToViewport && zoom <= MIN_ZOOM}
          onClick={() => changeZoom(-ZOOM_STEP)}
        />
        <Typography.Text
          className="verification-image-zoom-value"
          aria-live="polite"
        >
          {zoomLabel}
        </Typography.Text>
        <Button
          icon={<ZoomInOutlined />}
          aria-label="Phóng to giấy tờ"
          title="Phóng to (+)"
          disabled={!fitToViewport && zoom >= MAX_ZOOM}
          onClick={() => changeZoom(ZOOM_STEP)}
        />
        <Button
          icon={<OneToOneOutlined />}
          aria-label="Hiển thị giấy tờ ở mức 100 phần trăm"
          title="Kích thước 100% (0)"
          onClick={resetZoom}
        >
          100%
        </Button>
        <Button
          icon={<CompressOutlined />}
          aria-label="Đưa toàn bộ giấy tờ vừa khung xem"
          title="Vừa khung (F)"
          type={fitToViewport ? 'primary' : 'default'}
          onClick={fitImage}
        >
          Vừa khung
        </Button>
        <Button
          icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Xem giấy tờ toàn màn hình'}
          title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          disabled={!fullscreenSupported}
          onClick={toggleFullscreen}
        />
      </div>

      <div
        className="verification-image-canvas"
        tabIndex={0}
        role="region"
        aria-label={`Vùng xem ${alt}. Dùng phím cộng hoặc trừ để zoom, phím 0 để về 100%, phím F để vừa khung.`}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
      >
        <div
          className={`verification-image-stage ${fitToViewport ? 'is-fit' : 'is-zoomed'}`}
          style={fitToViewport ? undefined : { '--document-zoom': zoom / 100 }}
        >
          <img
            src={src}
            alt={alt}
            className="verification-document-image"
            draggable={false}
            onError={onError}
          />
        </div>
      </div>

      <Typography.Text type="secondary" className="verification-preview-meta">
        {`${contentType} · ${zoomLabel} · Giữ Ctrl/⌘ và cuộn chuột để phóng to hoặc thu nhỏ.`}
      </Typography.Text>
    </div>
  )
}
