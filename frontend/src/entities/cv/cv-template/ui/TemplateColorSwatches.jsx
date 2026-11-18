export default function TemplateColorSwatches({
  colors,
  selectedKey,
  onSelect,
  onActivate,
  sizeClass = 'h-4.5 w-4.5',
  ariaLabel = 'Chọn màu mẫu CV',
}) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      {colors.map((color) => {
        const key = color.public_id || color.slug || color.hex_code
        const active = selectedKey === key || selectedKey === color.hex_code || selectedKey === color.slug
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            title={color.name}
            onMouseEnter={() => onSelect?.(color)}
            onFocus={() => onSelect?.(color)}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSelect?.(color)
              onActivate?.(color)
            }}
            className={[
              sizeClass,
              'cursor-pointer rounded-full transition-all duration-200',
              active
                ? 'scale-110 ring-2 ring-slate-900 ring-offset-2'
                : 'ring-1 ring-black/10 hover:scale-105 hover:ring-2 hover:ring-slate-400',
            ].join(' ')}
            style={{ backgroundColor: color.hex_code }}
          />
        )
      })}
    </div>
  )
}
