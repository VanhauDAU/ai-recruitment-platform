import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { getRendererContract, paginateRendererProjection, projectDocumentForRenderer } from '../model/renderer-contracts'
import { richTextToText } from '../model/document'
import { getSectionDefinition } from '../model/section-registry'

function SectionContent({ section }) {
  if (section.section_key === 'summary') return <p className="whitespace-pre-line text-slate-700">{section.items.map((item) => item.value || richTextToText(item.description)).filter(Boolean).join('\n')}</p>
  if (section.section_key === 'experience') return <div className="space-y-3">{section.items.map((item) => <div key={item.item_id}><div className="font-semibold text-slate-800">{item.role || 'Vị trí'}</div><div className="text-slate-600">{[item.company, item.start_date, item.end_date].filter(Boolean).join(' · ')}</div><p className="mt-1 whitespace-pre-line text-slate-700">{item.description ? richTextToText(item.description) : item.value}</p></div>)}</div>
  if (section.section_key === 'skills') return <div className="flex flex-wrap gap-1.5">{section.items.filter((item) => item.name || item.value).map((item) => <span key={item.item_id} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{item.name || item.value}</span>)}</div>
  return <div className="space-y-2">{section.items.map((item) => <div key={item.item_id}><p className="font-semibold text-slate-800">{item.name || item.degree || item.title || item.value || 'Mục nội dung'}</p><p className="text-slate-600">{item.institution || item.issuer || item.organization || item.role || ''}</p><p className="whitespace-pre-line text-slate-700">{richTextToText(item.description)}</p></div>)}</div>
}

function PreviewSection({ section, themeColor }) {
  if (!section.enabled) return null
  return <section className="mb-5 break-inside-avoid"><h3 className="mb-2 border-b pb-1 text-sm font-bold uppercase tracking-wide" style={{ color: themeColor, borderColor: `${themeColor}55` }}>{section.title || getSectionDefinition(section.section_key)?.displayName || section.section_key}</h3><SectionContent section={section} /></section>
}

function A4Page({ page, document, contract, onOverflow }) {
  const ref = useRef(null)
  const { content_json, style_json } = document
  const personal = content_json.personal_info || {}
  const gridTemplateColumns = contract.columns === 2 ? page.regions.map((region) => `${region.widthPercent || 50}fr`).join(' ') : 'minmax(0, 1fr)'

  useLayoutEffect(() => {
    const element = ref.current
    if (element) onOverflow(page.number, element.scrollHeight > element.clientHeight + 1)
  }, [document, onOverflow, page.number])

  return (
    <div className="mb-5">
      <p className="mb-1 text-center text-xs font-semibold text-slate-500">Trang {page.number}</p>
      <article
        ref={ref}
        aria-label={`Xem trước CV ${contract.key} trang ${page.number}`}
        className="mx-auto h-[297mm] w-[210mm] overflow-hidden bg-white p-[12mm] text-[11px] shadow-lg"
        style={{ fontFamily: style_json.font_family, fontSize: `${style_json.font_scale}em`, lineHeight: style_json.line_height }}
      >
        <header className="mb-6 border-l-4 pl-4" style={{ borderColor: style_json.theme_color }}>
          <h2 className="text-2xl font-extrabold text-slate-900">{personal.full_name || 'Họ và tên'}</h2>
          <p className="mt-1 font-semibold" style={{ color: style_json.theme_color }}>{personal.headline || 'Chức danh mong muốn'}</p>
          <p className="mt-2 text-slate-600">{[personal.email, personal.phone, personal.address].filter(Boolean).join(' · ')}</p>
        </header>
        <div className="grid gap-5" style={{ gridTemplateColumns }}>
          {page.regions.map((region) => <div key={region.id}>{region.sections.map((section) => <PreviewSection key={section.instance_id} section={section} themeColor={style_json.theme_color} />)}</div>)}
        </div>
      </article>
    </div>
  )
}

export default function CvDocumentPreview({ document, rendererKey }) {
  const projection = projectDocumentForRenderer(document, rendererKey)
  const contract = getRendererContract(rendererKey)
  const pages = paginateRendererProjection(projection)
  const [overflowPages, setOverflowPages] = useState([])
  const onOverflow = useCallback((pageNumber, isOverflowing) => {
    setOverflowPages((current) => {
      const next = isOverflowing ? [...new Set([...current, pageNumber])] : current.filter((number) => number !== pageNumber)
      return next.length === current.length && next.every((number, index) => number === current[index]) ? current : next
    })
  }, [])

  return (
    <div className="overflow-auto rounded-xl bg-slate-200 p-3 shadow-inner">
      {overflowPages.length > 0 && <div role="alert" className="mx-auto mb-3 max-w-[210mm] rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Nội dung có thể bị tràn ở trang {overflowPages.join(', ')}. Hãy rút ngắn nội dung hoặc thêm section để Preview phân trang lại.</div>}
      {pages.map((page) => <A4Page key={page.number} page={page} document={document} contract={contract} onOverflow={onOverflow} />)}
    </div>
  )
}
