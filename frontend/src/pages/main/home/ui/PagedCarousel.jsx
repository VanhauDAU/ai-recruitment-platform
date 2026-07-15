import ArrowButton from '@/shared/ui/ArrowButton'

// Header carousel: tiêu đề + chỉ số trang + 2 nút điều hướng (ẩn trên mobile,
// mobile điều hướng bằng kéo).
export function CarouselHeader({ title, carousel, totalPages, prevLabel, nextLabel }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-xl font-extrabold text-[var(--brand-primary)]">{title}</h2>
      <div className="hidden items-center gap-2 sm:flex">
        <span className="mr-1 text-sm font-medium text-gray-500">
          <span className="text-[var(--brand-primary)]">{carousel.page + 1}</span>/{totalPages}
        </span>
        <ArrowButton dir="left" disabled={!carousel.canPrev} onClick={carousel.goPrev} aria-label={prevLabel} />
        <ArrowButton dir="right" disabled={!carousel.canNext} onClick={carousel.goNext} aria-label={nextLabel} />
      </div>
    </div>
  )
}

// Track trượt ngang theo trang, hỗ trợ offset khi đang kéo.
export function PagedTrack({ groups, page, dragOffset, isDragging, children }) {
  return (
    <div
      className="overflow-hidden px-px pb-2 pt-1"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="flex"
        style={{
          transform: `translateX(calc(${-page * 100}% + ${dragOffset}px))`,
          transition: isDragging ? 'none' : 'transform 320ms ease',
        }}
      >
        {groups.map((group, index) => (
          <div key={index} className="min-w-full">
            {children(group)}
          </div>
        ))}
      </div>
    </div>
  )
}
