import { CheckOutlined } from '@ant-design/icons'
import { Select, Slider } from 'antd'
import { useEffect, useState } from 'react'
import { getCvFontStack } from '@/entities/cv'
import { getCvBackgrounds, getCvTemplates } from '@/entities/cv-template'
import { useLocales } from '@/entities/locale'
import ThemeColorControl from './ThemeColorControl'
import './DesignFontPanel.css'

const FONT_NAMES = ['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro']
const FONTS = FONT_NAMES.map((value) => ({
  value,
  label: <span style={{ fontFamily: getCvFontStack(value) }}>{value}</span>,
}))

export default function DesignFontPanel({ editor, onStyle, onLocale }) {
  const { locales } = useLocales()
  const [colors, setColors] = useState([])
  const [backgrounds, setBackgrounds] = useState([])

  useEffect(() => {
    getCvTemplates({ locale: editor.document.content_json.locale })
      .then((data) => setColors((data?.results || []).find((item) => item.public_id === editor.cv.template_public_id)?.colors || []))
      .catch(() => setColors([]))
    getCvBackgrounds()
      .then((data) => setBackgrounds(Array.isArray(data) ? data : []))
      .catch(() => setBackgrounds([]))
  }, [editor.cv.template_public_id, editor.document.content_json.locale])

  const style = editor.document.style_json
  const localeName = (locale) => locale.label_vi || locale.native_name || locale.code
  const changeThemeColor = (theme_color) => onStyle({ theme_color })

  return <div className="space-y-7 text-slate-700">
    <div>
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Ngôn ngữ CV</span>
      <div className="grid grid-cols-2 gap-2">{locales.map((locale) => <button key={locale.code} type="button" onClick={() => onLocale(locale.code)} className={`min-h-10 cursor-pointer rounded-md border px-3 py-2 text-xs font-semibold transition ${editor.document.content_json.locale === locale.code ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'}`}>{localeName(locale)}</button>)}</div>
      <p className="mt-2 text-[11px] leading-4 text-slate-400">Đổi tiêu đề chuẩn của mẫu; nội dung tự viết được giữ nguyên.</p>
    </div>

    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Font chữ</span>
      <Select aria-label="Font chữ CV" value={style.font_family} options={FONTS} optionRender={(option) => <span style={{ fontFamily: getCvFontStack(option.value) }}>{option.value}</span>} onChange={(font_family) => onStyle({ font_family })} className="w-full" size="large" />
    </label>

    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>Cỡ chữ</span><span className="rounded bg-slate-100 px-2 py-1 font-semibold normal-case text-slate-600">{Math.round(style.font_scale * 100)}%</span></span>
      <Slider className="cv-builder-slider" min={0.8} max={1.4} step={0.1} dots tooltip={{ formatter: (value) => `${Math.round(value * 100)}%` }} value={style.font_scale} onChange={(font_scale) => onStyle({ font_scale })} />
      <span className="flex justify-between text-[11px] font-medium text-slate-400"><span>Nhỏ</span><span>Trung bình</span><span>Rất lớn</span></span>
    </label>

    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>Khoảng cách dòng</span><span className="rounded bg-slate-100 px-2 py-1 font-semibold normal-case text-slate-600">{style.line_height.toFixed(1)}</span></span>
      <Slider className="cv-builder-slider" min={1} max={2} step={0.2} dots tooltip={{ formatter: (value) => value.toFixed(1) }} value={style.line_height} onChange={(line_height) => onStyle({ line_height })} />
      <span className="flex justify-between text-[11px] font-medium text-slate-400"><span>1.0</span><span>1.4</span><span>2.0</span></span>
    </label>

    <div>
      <span className="mb-3 block text-xs font-bold uppercase tracking-wide text-slate-500">Màu chủ đề</span>
      <ThemeColorControl value={style.theme_color} presets={colors} onChange={changeThemeColor} />
    </div>

    <div>
      <span className="mb-3 block text-xs font-bold uppercase tracking-wide text-slate-500">Hình nền CV</span>
      <div className="grid grid-cols-4 gap-3">
        <button type="button" aria-label="Không dùng ảnh nền" onClick={() => onStyle({ background_asset_id: null })} className={`relative aspect-[3/4] cursor-pointer rounded-md border-2 bg-white text-[10px] transition hover:border-emerald-300 ${!style.background_asset_id ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-400'}`}>{!style.background_asset_id && <CheckOutlined className="absolute left-1 top-1" />}Không dùng</button>
        {backgrounds.map((background) => <button key={background.public_id} type="button" aria-label={`Chọn nền ${background.title || background.public_id}`} onClick={() => onStyle({ background_asset_id: background.public_id })} className={`aspect-[3/4] cursor-pointer overflow-hidden rounded-md border-2 transition hover:border-emerald-300 ${style.background_asset_id === background.public_id ? 'border-emerald-500' : 'border-slate-200'}`}><img src={background.url} alt="" className="h-full w-full object-cover" /></button>)}
      </div>
    </div>
  </div>
}
