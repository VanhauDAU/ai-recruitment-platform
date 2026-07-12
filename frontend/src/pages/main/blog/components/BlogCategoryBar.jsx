import { useEffect, useRef, useState } from 'react'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { blogCategoryPath } from '../blogPaths'

// Thanh danh mục nằm ngang: lăn chuột để lướt hoặc bấm next/previous.
// Không có chip "Tất cả" — bấm logo mục "Cẩm nang" trên breadcrumb/menu là về /blog.
export default function BlogCategoryBar({ categories, activeSlug }) {
  const scrollerRef = useRef(null)
  const dragRef = useRef({ active: false, moved: false, startX: 0, startLeft: 0 })
  const ignoreDraggedClickRef = useRef(false)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  function updateArrows() {
    const el = scrollerRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return undefined
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [categories])

  // Lăn chuột dọc trên thanh -> lướt ngang danh mục.
  function handleWheel(event) {
    const el = scrollerRef.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault()
      el.scrollBy({ left: event.deltaY })
    }
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [categories])

  function scrollByArrow(direction) {
    scrollerRef.current?.scrollBy({ left: direction * 260, behavior: 'smooth' })
  }

  function startDragging(event) {
    const el = scrollerRef.current
    // Mobile dùng native horizontal scrolling để không chặn thao tác vuốt dọc.
    if (!el || event.pointerType !== 'mouse' || event.button !== 0) {
      dragRef.current.active = false
      return
    }
    dragRef.current = { active: true, moved: false, startX: event.clientX, startLeft: el.scrollLeft }
  }

  function drag(event) {
    const el = scrollerRef.current
    if (!el || !dragRef.current.active) return
    const distance = event.clientX - dragRef.current.startX
    if (Math.abs(distance) > 4 && !dragRef.current.moved) {
      dragRef.current.moved = true
      // Chỉ capture sau khi đã xác nhận đây là thao tác kéo. Capture ngay từ
      // pointerdown sẽ khiến click thường bị đổi target từ Link sang scroller.
      el.setPointerCapture?.(event.pointerId)
    }
    if (dragRef.current.moved) {
      event.preventDefault()
      el.scrollLeft = dragRef.current.startLeft - distance
    }
  }

  function stopDragging(event) {
    const el = scrollerRef.current
    if (el?.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId)
    const shouldIgnoreClick = dragRef.current.moved
    dragRef.current.active = false
    dragRef.current.moved = false

    // Chỉ bỏ click sinh ra ngay sau lúc thả một thao tác kéo. Nếu trình duyệt
    // không phát sinh click đó, cờ cũng tự hết trong tick kế tiếp để lần bấm
    // thật sau vẫn điều hướng bình thường.
    if (shouldIgnoreClick) {
      ignoreDraggedClickRef.current = true
      window.setTimeout(() => { ignoreDraggedClickRef.current = false }, 0)
    }
  }

  function preventDraggedClick(event) {
    if (!ignoreDraggedClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    ignoreDraggedClickRef.current = false
  }

  if (!categories?.length) return null

  return (
    <div className="relative flex items-center">
      {canLeft && <Arrow direction="left" onClick={() => scrollByArrow(-1)} />}
      <div
        ref={scrollerRef}
        onPointerDown={startDragging}
        onPointerMove={drag}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onClickCapture={preventDraggedClick}
        className="flex gap-2 overflow-x-auto scroll-smooth py-2.5 select-none touch-pan-x sm:cursor-grab sm:active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((cat) => (
          <Chip key={cat.slug} to={blogCategoryPath(cat.slug)} active={cat.slug === activeSlug}>
            {cat.name}
          </Chip>
        ))}
      </div>
      {canRight && <Arrow direction="right" onClick={() => scrollByArrow(1)} />}
    </div>
  )
}

// Khối bọc sticky ngay dưới header (header cao h-16) dùng chung cho mọi trang blog.
export function BlogCategoryNav({ categories, activeSlug }) {
  return (
    <div className="sticky top-16 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <BlogCategoryBar categories={categories} activeSlug={activeSlug} />
      </div>
    </div>
  )
}

function Chip({ to, active, children }) {
  return (
    <Link
      to={to}
      draggable={false}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:px-4 sm:text-sm ${
        active
          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] !text-[var(--brand-primary)]'
          : 'border-slate-300 bg-white !text-slate-900 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)]'
      }`}
    >
      {children}
    </Link>
  )
}

function Arrow({ direction, onClick }) {
  const isLeft = direction === 'left'
  return (
    <button
      type="button"
      aria-label={isLeft ? 'Danh mục trước' : 'Danh mục sau'}
      onClick={onClick}
      className={`absolute z-10 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] sm:flex ${
        isLeft ? 'left-0' : 'right-0'
      }`}
    >
      {isLeft ? <LeftOutlined /> : <RightOutlined />}
    </button>
  )
}
