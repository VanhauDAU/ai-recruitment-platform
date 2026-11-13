import { useLayoutEffect, useRef, useState } from 'react'
import CvDocumentPreview from './CvDocumentPreview'

const A4_WIDTH_PX = 794 // 210mm ở 96dpi
const SCROLLBAR_SLACK_PX = 24

// Trang A4 co theo chiều rộng khung chứa để không tràn ngang trên màn hẹp.
// Tỉ lệ được tính trước lần vẽ đầu (không nháy cỡ thật rồi mới co). Khung cha có
// thanh cuộn: trang co lại làm thanh cuộn biến mất, khung rộng ra, trang phóng to,
// thanh cuộn hiện lại… — vòng lặp đó làm preview bị giật. Bỏ qua phần nới rộng
// nhỏ hơn một thanh cuộn sẽ cắt vòng lặp.
// `updating` làm mờ nhẹ bản đang hiển thị trong lúc tải bản mới.
export default function FittedCvPreview({ updating = false, ...props }) {
  const containerRef = useRef(null)
  const fittedWidth = useRef(0)
  const [zoom, setZoom] = useState(0)

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return undefined
    const fit = () => {
      const width = element.clientWidth
      // Nới rộng chưa quá một thanh cuộn: giữ tỉ lệ cũ (luôn vừa khung).
      if (width > fittedWidth.current && width - fittedWidth.current < SCROLLBAR_SLACK_PX && fittedWidth.current) return
      fittedWidth.current = width
      setZoom(Math.min(1, Math.floor((width / A4_WIDTH_PX) * 100) / 100))
    }
    fit()
    const observer = globalThis.ResizeObserver ? new ResizeObserver(fit) : null
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full min-w-0 overflow-x-hidden">
      <div
        className={`mx-auto w-fit transition-opacity duration-200 ${updating ? 'opacity-60' : 'opacity-100'}`}
        style={{ zoom: zoom || 1, visibility: zoom ? 'visible' : 'hidden' }}
        aria-busy={updating || undefined}
      >
        <CvDocumentPreview pageLabelVariant="none" editorChrome={false} {...props} />
      </div>
    </div>
  )
}
