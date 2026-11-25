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
