import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getRendererContract, paginateMeasuredProjection, projectDocumentForRenderer } from '../model/renderer-contracts'
import { getSectionDefinition } from '../model/section-registry'
import './CvDocumentPreview.css'

function RichTextContent({ value }) {
  if (!value?.content) return null
  return value.content.map((block, blockIndex) => {
    const runs = value.format === 'rich_text_v2' ? block.runs || [] : [{ text: block.text || '' }]
    const content = runs.map((run, runIndex) => {
      const marks = run.marks || {}
      const style = {
        color: marks.color,
        fontFamily: marks.font_family,
        fontSize: marks.font_size_pt ? `${marks.font_size_pt}pt` : undefined,
        fontWeight: marks.bold ? 700 : undefined,
        fontStyle: marks.italic ? 'italic' : undefined,
        textDecoration: marks.underline ? 'underline' : undefined,
      }
      return <span key={`${blockIndex}-${runIndex}`} style={style}>{run.text}</span>
    })
    return block.type === 'bullet'
      ? <ul key={blockIndex} className="ml-4 list-disc"><li>{content}</li></ul>
      : <p key={blockIndex} className="whitespace-pre-line">{content}</p>
  })
}

function SectionContent({ section, personal, assets }) {
  if (section.section_key === 'nameplate') return <div><div className="text-2xl font-extrabold text-slate-900">{personal.full_name || 'Họ và tên'}</div><div className="font-semibold text-[var(--cv-theme)]">{personal.headline || 'Chức danh mong muốn'}</div></div>
  if (section.section_key === 'contact') return <p className="text-slate-600">{[personal.email, personal.phone, personal.address].filter(Boolean).join(' · ') || 'Thông tin liên hệ'}</p>
  if (section.section_key === 'avatar') {
    const avatar = assets?.[personal.avatar_asset_id]
    return avatar?.url ? <img src={avatar.url} alt="Ảnh đại diện" className="h-24 w-24 rounded-full object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">Ảnh đại diện</div>
  }
  const itemAttribute = (item) => `${section.instance_id}:${item.item_id}`
  if (section.section_key === 'summary') return <div className="text-slate-700">{section.items.map((item) => item.description ? <div key={item.item_id} data-cv-item-id={itemAttribute(item)}><RichTextContent value={item.description} /></div> : <p key={item.item_id} data-cv-item-id={itemAttribute(item)}>{item.value}</p>)}</div>
  if (section.section_key === 'experience') return <div className="space-y-3">{section.items.map((item) => <div key={item.item_id} data-cv-item-id={itemAttribute(item)}><div className="font-semibold text-slate-800">{item.role || 'Vị trí'}</div><div className="text-slate-600">{[item.company, item.start_date, item.end_date].filter(Boolean).join(' · ')}</div><div className="mt-1 text-slate-700">{item.description ? <RichTextContent value={item.description} /> : item.value}</div></div>)}</div>
  if (section.section_key === 'skills') return <div className="flex flex-wrap gap-1.5">{section.items.filter((item) => item.name || item.value).map((item) => <span key={item.item_id} data-cv-item-id={itemAttribute(item)} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{item.name || item.value}</span>)}</div>
  return <div className="space-y-2">{section.items.map((item) => <div key={item.item_id} data-cv-item-id={itemAttribute(item)}><p className="font-semibold text-slate-800">{item.name || item.degree || item.title || item.value || 'Mục nội dung'}</p><p className="text-slate-600">{item.institution || item.issuer || item.organization || item.role || ''}</p><div className="text-slate-700">{item.description ? <RichTextContent value={item.description} /> : null}</div></div>)}</div>
}

function PreviewSection({ section, themeColor, personal, assets }) {
  if (!section.enabled) return null
  const definition = getSectionDefinition(section.section_key)
  return <section data-section-id={section.instance_id} className="cv-document-preview__section mb-5 break-inside-avoid">{!definition?.personalInfoBacked && <h3 className="mb-2 border-b pb-1 text-sm font-bold uppercase tracking-wide" style={{ color: themeColor, borderColor: `${themeColor}55` }}>{section.title || definition?.displayName || section.section_key}</h3>}<SectionContent section={section} personal={personal} assets={assets} /></section>
}

function RegionRows({ regions, contract, document, assets, renderRegion, pageNumber }) {
  const personal = document.content_json.personal_info || {}
  return <div className="space-y-5">{contract.rows.map((row) => {
    const rowRegions = row.map((id) => regions.find((region) => region.id === id)).filter(Boolean)
    if (!rowRegions.length) return null
    return <div key={row.join(':')} className="grid gap-5" style={{ gridTemplateColumns: rowRegions.map((region) => `${region.widthPercent || 100}fr`).join(' ') }}>{rowRegions.map((region) => renderRegion
      ? renderRegion(region, pageNumber)
      : <div key={region.id}>{region.sections.map((section) => <PreviewSection key={section.instance_id} section={section} themeColor={document.style_json.theme_color} personal={personal} assets={assets} />)}</div>)}</div>
  })}</div>
}

function A4Page({ page, document, contract, assets, onOverflow, renderRegion, renderHeader, pageAriaLabel }) {
  const ref = useRef(null)
  const { content_json, style_json } = document
  const personal = content_json.personal_info || {}
  const background = assets?.[style_json.background_asset_id]

  useLayoutEffect(() => {
    const element = ref.current
    if (element) onOverflow(page.number, element.scrollHeight > element.clientHeight + 1)
  }, [document, onOverflow, page.number])

  return (
    <div className="cv-document-preview__page-wrap mb-5">
      <p className="cv-document-preview__page-label mb-1 text-center text-xs font-semibold text-slate-500">Trang {page.number}</p>
      <article
        ref={ref}
        aria-label={pageAriaLabel?.(page.number) || `Xem trước CV ${contract.key} trang ${page.number}`}
        className="cv-document-preview__page mx-auto h-[297mm] w-[210mm] overflow-hidden bg-white p-[12mm] text-[11px] shadow-lg"
        style={{ fontFamily: style_json.font_family, fontSize: `${style_json.font_scale}em`, lineHeight: style_json.line_height, backgroundImage: background?.url ? `url(${background.url})` : undefined, backgroundSize: 'cover', '--cv-theme': style_json.theme_color }}
      >
        {renderHeader ? renderHeader(page.number) : contract.key !== 'header_two_column_v1' && <header className="mb-6 border-l-4 pl-4" style={{ borderColor: style_json.theme_color }}>
          <h2 className="text-2xl font-extrabold text-slate-900">{personal.full_name || 'Họ và tên'}</h2>
          <p className="mt-1 font-semibold" style={{ color: style_json.theme_color }}>{personal.headline || 'Chức danh mong muốn'}</p>
          <p className="mt-2 text-slate-600">{[personal.email, personal.phone, personal.address].filter(Boolean).join(' · ')}</p>
        </header>}
        <RegionRows regions={page.regions} contract={contract} document={document} assets={assets} renderRegion={renderRegion} pageNumber={page.number} />
      </article>
    </div>
  )
}

export default function CvDocumentPreview({ document, rendererKey, assets = {}, renderRegion, renderHeader, pageAriaLabel, className = '', paginateItems = true }) {
  const projection = projectDocumentForRenderer(document, rendererKey)
  const contract = getRendererContract(rendererKey)
  const previewRef = useRef(null)
  const [measurements, setMeasurements] = useState({ sections: {}, items: {} })
  const pages = useMemo(() => paginateMeasuredProjection(projection, measurements, contract.key === 'header_two_column_v1' ? 980 : 900), [contract.key, measurements, projection])
  useLayoutEffect(() => {
    const preview = previewRef.current
    if (!preview) return undefined
    const measure = () => {
      const sections = {}
      for (const element of preview.querySelectorAll('[data-section-id]')) {
        sections[element.dataset.sectionId] = (sections[element.dataset.sectionId] || 0) + Math.ceil(element.getBoundingClientRect().height)
      }
      const next = {
        sections,
        items: paginateItems ? Object.fromEntries([...preview.querySelectorAll('[data-cv-item-id]')].map((element) => [element.dataset.cvItemId, Math.ceil(element.getBoundingClientRect().height)])) : {},
      }
      setMeasurements((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    measure()
    const Observer = globalThis.ResizeObserver
    const observer = Observer ? new Observer(measure) : null
    observer?.observe(preview)
    globalThis.document.fonts?.ready?.then(measure)
    return () => observer?.disconnect()
  }, [document, pages.length, paginateItems])
  const [overflowPages, setOverflowPages] = useState([])
  const onOverflow = useCallback((pageNumber, isOverflowing) => {
    setOverflowPages((current) => {
      const next = isOverflowing ? [...new Set([...current, pageNumber])] : current.filter((number) => number !== pageNumber)
      return next.length === current.length && next.every((number, index) => number === current[index]) ? current : next
    })
  }, [])

  return (
    <div ref={previewRef} className={`cv-document-preview overflow-auto rounded-xl bg-slate-200 p-3 shadow-inner ${className}`}>
      {overflowPages.length > 0 && <div role="alert" className="cv-document-preview__overflow mx-auto mb-3 max-w-[210mm] rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Nội dung có thể bị tràn ở trang {overflowPages.join(', ')}. Hãy rút ngắn nội dung hoặc thêm section để Preview phân trang lại.</div>}
      {pages.map((page) => <A4Page key={page.number} page={page} document={document} contract={contract} assets={assets} onOverflow={onOverflow} renderRegion={renderRegion} renderHeader={renderHeader} pageAriaLabel={pageAriaLabel} />)}
    </div>
  )
}
