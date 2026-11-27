import { Skeleton } from 'antd'
import { Suspense, useCallback } from 'react'
import { useInViewOnce } from '../model/use-in-view-once'

// Dựng sớm hơn lúc lộ ra một đoạn để chunk + API kịp về trước khi người dùng nhìn thấy.
const MOUNT_MARGIN = '600px 0px'
// Chỉ trồi lên khi khối đã vào hẳn khung nhìn một đoạn, không phải ngay mép dưới.
const REVEAL_MARGIN = '0px 0px -12% 0px'

// Khối trang chủ "cuộn tới đâu tải tới đó": chỉ dựng (tải chunk, gọi API, tải ảnh)
// khi cuộn tới gần, rồi trồi lên khi vào khung nhìn (home-motion.css). `reserve`
// giữ chỗ để thanh cuộn không nhảy; `eager` cho khối sát màn đầu chỉ cần hiệu ứng.
export default function HomeSection({ children, reserve = 0, eager = false, className = '' }) {
  const [nearRef, near] = useInViewOnce(0, MOUNT_MARGIN)
  const [viewRef, inView] = useInViewOnce(0, REVEAL_MARGIN)
  const setRef = useCallback((node) => {
    nearRef.current = node
    viewRef.current = node
  }, [nearRef, viewRef])
  const mounted = eager || near

  return (
    <div
      ref={setRef}
      className={`home-reveal${inView ? ' is-revealed' : ''} ${className}`}
      style={mounted ? undefined : { minHeight: reserve }}
    >
      {mounted && (
        <Suspense fallback={<SectionSkeleton height={reserve} />}>{children}</Suspense>
      )}
    </div>
  )
}

function SectionSkeleton({ height }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" style={{ minHeight: height }} aria-hidden="true">
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  )
}
