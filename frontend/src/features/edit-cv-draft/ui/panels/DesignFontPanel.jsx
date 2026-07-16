import { CheckOutlined, PlusOutlined } from '@ant-design/icons'
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
    getCvTemplates({ locale: editor.document.content_json.locale }).then((data) => setColors((data?.results || []).find((item) => item.public_id === editor.cv.template_public_id)?.colors || [])).catch(() => setColors([]))
    getCvBackgrounds().then((data) => setBackgrounds(Array.isArray(data) ? data : [])).catch(() => setBackgrounds([]))
  }, [editor.cv.template_public_id, editor.document.content_json.locale])
  const style = editor.document.style_json
  const localeName = (locale) => locale.label_vi || locale.native_name || locale.code
  return <div className="space-y-6 text-slate-700">
    <div><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Ngôn ngữ CV</span><div className="flex flex-wrap gap-2">{locales.map((locale) => <button key={locale.code} type="button" onClick={() => onLocale(locale.code)} className={`rounded border px-3 py-2 text-xs font-semibold transition ${editor.document.content_json.locale === locale.code ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{localeName(locale)}</button>)}</div></div>
    <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Font chữ</span><Select value={style.font_family} options={FONTS} onChange={(font_family) => onStyle({ font_family })} className="w-full" /></label>
    <label className="block"><span className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>Cỡ chữ</span><span className="font-semibold normal-case text-slate-400">{Math.round(style.font_scale * 100)}%</span></span><Slider min={0.8} max={1.4} step={0.05} value={style.font_scale} onChange={(font_scale) => onStyle({ font_scale })} /><span className="flex justify-between text-[11px] text-slate-400"><span>Nhỏ</span><span>Trung bình</span><span>Siêu lớn</span></span></label>
    <label className="block"><span className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>Khoảng cách dòng</span><span className="font-semibold normal-case text-slate-400">{style.line_height.toFixed(1)}</span></span><Slider min={1} max={2} step={0.1} value={style.line_height} onChange={(line_height) => onStyle({ line_height })} /><span className="flex justify-between text-[11px] text-slate-400"><span>1.0</span><span>2.0</span></span></label>
    <div><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Màu chủ đề</span><div className="flex flex-wrap items-center gap-2">{colors.map((color) => {
      const active = style.theme_color.toUpperCase() === color.hex_code.toUpperCase()
      return <button key={color.public_id || color.hex_code} type="button" aria-label={`Chọn màu ${color.hex_code}`} onClick={() => onStyle({ theme_color: color.hex_code.toUpperCase() })} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs text-white shadow-sm ${active ? 'border-slate-700' : 'border-white'}`} style={{ backgroundColor: color.hex_code }}>{active && <CheckOutlined />}</button>
    })}<ColorPicker value={style.theme_color} onChange={(_, hex) => onStyle({ theme_color: hex.toUpperCase() })}><button type="button" aria-label="Chọn màu tùy chỉnh" className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-400 bg-white text-slate-500"><PlusOutlined /></button></ColorPicker></div><div className="mt-3 flex items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2"><span className="h-6 w-9 rounded-sm border border-white shadow" style={{ backgroundColor: style.theme_color }} /><span className="text-xs font-semibold uppercase text-slate-500">{style.theme_color}</span></div></div>
    <div><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Hình nền CV</span><div className="grid grid-cols-4 gap-2"><button type="button" aria-label="Không dùng ảnh nền" onClick={() => onStyle({ background_asset_id: null })} className={`relative aspect-[3/4] rounded-sm border-2 bg-white text-[10px] ${!style.background_asset_id ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-400'}`}>{!style.background_asset_id && <CheckOutlined className="absolute left-1 top-1" />}Không dùng</button>{backgrounds.map((background) => <button key={background.public_id} type="button" aria-label={`Chọn nền ${background.title || background.public_id}`} onClick={() => onStyle({ background_asset_id: background.public_id })} className={`aspect-[3/4] overflow-hidden rounded-sm border-2 ${style.background_asset_id === background.public_id ? 'border-emerald-500' : 'border-slate-200'}`}><img src={background.url} alt="" className="h-full w-full object-cover" /></button>)}</div></div>
    <details className="border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-500">Chỉnh sửa bằng biểu mẫu</summary><div className="mt-4 space-y-4">{legacyContent}</div></details>
  </div>
}
