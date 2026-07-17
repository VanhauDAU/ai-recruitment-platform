import { useCallback, useEffect, useState } from 'react'

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

function hexToHsv(hex) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.slice(1) : '00A66A'
  const [red, green, blue] = [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16) / 255)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2)
    else hue = 60 * (((red - green) / delta) + 4)
  }
  return { h: hue < 0 ? hue + 360 : hue, s: max ? delta / max : 0, v: max }
}

function hsvToHex({ h, s, v }) {
  const chroma = v * s
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const match = v - chroma
  const [red, green, blue] = h < 60 ? [chroma, x, 0]
    : h < 120 ? [x, chroma, 0]
      : h < 180 ? [0, chroma, x]
        : h < 240 ? [0, x, chroma]
          : h < 300 ? [x, 0, chroma]
            : [chroma, 0, x]
  return `#${[red, green, blue].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export default function ThemeColorControl({ value, presets, onChange }) {
  const hsv = hexToHsv(value)
  const [hexDraft, setHexDraft] = useState(value.toUpperCase())
  useEffect(() => setHexDraft(value.toUpperCase()), [value])
  const updateSaturationAndBrightness = useCallback((event) => {
    if (event.type === 'pointermove' && event.buttons !== 1) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const saturation = clamp((event.clientX - bounds.left) / bounds.width)
    const brightness = 1 - clamp((event.clientY - bounds.top) / bounds.height)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    onChange(hsvToHex({ h: hsv.h, s: saturation, v: brightness }))
  }, [hsv.h, onChange])
  const updateFromKeyboard = (event) => {
    const step = event.shiftKey ? 0.1 : 0.02
    const next = { ...hsv }
    if (event.key === 'ArrowLeft') next.s = clamp(hsv.s - step)
    else if (event.key === 'ArrowRight') next.s = clamp(hsv.s + step)
    else if (event.key === 'ArrowUp') next.v = clamp(hsv.v + step)
    else if (event.key === 'ArrowDown') next.v = clamp(hsv.v - step)
    else return
    event.preventDefault()
    onChange(hsvToHex(next))
  }

  return <div>
    <div className="mb-4 flex flex-wrap gap-3">
      {presets.map((color) => {
        const hex = color.hex_code.toUpperCase()
        const active = value.toUpperCase() === hex
        return <button
          key={color.public_id || hex}
          type="button"
          aria-label={`Chọn màu ${hex}`}
          aria-pressed={active}
          onClick={() => onChange(hex)}
          className={`h-11 w-11 cursor-pointer rounded-full border-[3px] shadow-sm transition hover:scale-105 ${active ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-white ring-1 ring-slate-200'}`}
          style={{ backgroundColor: hex }}
        />
      })}
    </div>
    <div
      role="slider"
      aria-label="Độ đậm và độ sáng của màu"
      aria-valuetext={value}
      tabIndex={0}
      onKeyDown={updateFromKeyboard}
      onPointerDown={updateSaturationAndBrightness}
      onPointerMove={updateSaturationAndBrightness}
      className="relative h-44 w-full touch-none cursor-crosshair overflow-hidden rounded-lg shadow-inner ring-1 ring-slate-200"
      style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)`, backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)' }}
    >
      <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,.55)]" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
    </div>
    <input
      aria-label="Sắc độ màu"
      type="range"
      min="0"
      max="359"
      value={Math.round(hsv.h)}
      onChange={(event) => onChange(hsvToHex({ ...hsv, h: Number(event.target.value) }))}
      className="cv-builder-hue-slider mt-3 h-4 w-full cursor-pointer appearance-none rounded-full"
    />
    <div className="mt-3 flex items-center gap-3">
      <span className="h-10 w-14 shrink-0 rounded-md border border-white shadow ring-1 ring-slate-200" style={{ backgroundColor: value }} />
      <label className="flex-1">
        <span className="sr-only">Mã màu HEX</span>
        <input
          value={hexDraft}
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value.toUpperCase()
            setHexDraft(next)
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next)
          }}
          onBlur={() => setHexDraft(value.toUpperCase())}
          className="h-10 w-full rounded-md border border-slate-200 px-3 font-mono text-sm font-semibold uppercase text-slate-600 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
    </div>
  </div>
}
