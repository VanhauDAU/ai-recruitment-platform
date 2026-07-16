import { ColorPicker, Select, Slider } from 'antd'
import { useEffect, useState } from 'react'
import { getCvBackgrounds, getCvTemplates } from '@/entities/cv-template'
import { useLocales } from '@/entities/locale'

const FONTS = ['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'].map((value) => ({ value, label: value }))

export default function DesignFontPanel({ editor, onStyle, onLocale, legacyContent }) {
  const { locales } = useLocales()
  const [colors, setColors] = useState([])
  const [backgrounds, setBackgrounds] = useState([])
  useEffect(() => {
    getCvTemplates({ locale: editor.document.content_json.locale }).then((data) => setColors(data.results.find((item) => item.public_id === editor.cv.template_public_id)?.colors || [])).catch(() => setColors([]))
    getCvBackgrounds().then(setBackgrounds).catch(() => setBackgrounds([]))
  }, [editor.cv.template_public_id, editor.document.content_json.locale])
  const style = editor.document.style_json
  return <div className="space-y-5">
    <label className="block"><span className="mb-1 block text-sm font-semibold">Ngôn ngữ CV</span><Select value={editor.document.content_json.locale} options={locales.map((locale) => ({ value: locale.code, label: locale.label_vi || locale.native_name || locale.code }))} onChange={onLocale} className="w-full" /></label>
    <label className="block"><span className="mb-1 block text-sm font-semibold">Font chữ</span><Select value={style.font_family} options={FONTS} onChange={(font_family) => onStyle({ font_family })} className="w-full" /></label>
    <label className="block"><span className="mb-1 block text-sm font-semibold">Cỡ chữ</span><Slider min={0.8} max={1.4} step={0.05} value={style.font_scale} onChange={(font_scale) => onStyle({ font_scale })} /></label>
    <label className="block"><span className="mb-1 block text-sm font-semibold">Khoảng cách dòng</span><Slider min={1} max={2} step={0.1} value={style.line_height} onChange={(line_height) => onStyle({ line_height })} /></label>
    <div><span className="mb-2 block text-sm font-semibold">Màu chủ đề</span><div className="flex flex-wrap items-center gap-2">{colors.map((color) => <button key={color.public_id || color.hex_code} type="button" aria-label={`Chọn màu ${color.hex_code}`} onClick={() => onStyle({ theme_color: color.hex_code.toUpperCase() })} className={`h-7 w-7 rounded-full border-2 ${style.theme_color.toUpperCase() === color.hex_code.toUpperCase() ? 'border-slate-900' : 'border-white shadow'}`} style={{ backgroundColor: color.hex_code }} />)}<ColorPicker value={style.theme_color} onChange={(_, hex) => onStyle({ theme_color: hex.toUpperCase() })} /></div></div>
    <div><span className="mb-2 block text-sm font-semibold">Hình nền CV</span><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => onStyle({ background_asset_id: null })} className="aspect-[3/4] rounded border border-slate-300 bg-white text-xs">Không dùng</button>{backgrounds.map((background) => <button key={background.public_id} type="button" aria-label={`Chọn nền ${background.title || background.public_id}`} onClick={() => onStyle({ background_asset_id: background.public_id })} className="aspect-[3/4] overflow-hidden rounded border border-slate-300"><img src={background.url} alt="" className="h-full w-full object-cover" /></button>)}</div></div>
    <details className="rounded-lg border border-dashed border-slate-300 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Form chỉnh sửa dự phòng</summary><div className="mt-4 space-y-4">{legacyContent}</div></details>
  </div>
}
