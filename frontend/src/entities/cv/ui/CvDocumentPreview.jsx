import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getRendererContract, paginateMeasuredProjection, projectDocumentForRenderer } from '../model/renderer-contracts'
import { getCvFontStack } from '../model/document'
import { getCvUiText, getSectionDefinition, getSectionDisplayName } from '../model/section-registry'
import './CvDocumentPreview.css'

function RichTextContent({ value }) {
  if (!value?.content) return null
  return value.content.map((block, blockIndex) => {
    const runs = value.format === 'rich_text_v2' ? block.runs || [] : [{ text: block.text || '' }]
    const content = runs.map((run, runIndex) => {
      const marks = run.marks || {}
      const style = {
        color: marks.color,
        fontFamily: marks.font_family ? getCvFontStack(marks.font_family) : undefined,
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

const CONTACT_FIELDS = Object.freeze(['email', 'phone', 'date_of_birth', 'address', 'website'])

function contactValues(personal) {
  return CONTACT_FIELDS.filter((field) => Boolean(personal[field]))
}

function fieldStyle(marks) {
  return {
    color: marks?.color,
    fontFamily: marks?.font_family ? getCvFontStack(marks.font_family) : undefined,
    fontSize: marks?.font_size_pt ? `${marks.font_size_pt}pt` : undefined,
    fontWeight: marks?.bold ? 700 : undefined,
    fontStyle: marks?.italic ? 'italic' : undefined,
    textDecoration: marks?.underline ? 'underline' : undefined,
  }
}

function avatarObjectPosition(personal) {
  const rawX = Number(personal.avatar_position?.x)
  const rawY = Number(personal.avatar_position?.y)
  const x = Math.min(100, Math.max(0, Number.isFinite(rawX) ? rawX : 50))
  const y = Math.min(100, Math.max(0, Number.isFinite(rawY) ? rawY : 50))
  return `${x}% ${y}%`
}

function avatarSize(personal) {
  const rawSize = Number(personal.avatar_size_mm)
  return Math.min(80, Math.max(20, Number.isFinite(rawSize) ? rawSize : 28))
}

function avatarZoom(personal) {
  const rawZoom = Number(personal.avatar_zoom)
  return Math.min(3, Math.max(1, Number.isFinite(rawZoom) ? rawZoom : 1))
}

function PreviewContact({ personal, inlineTextStyles = {} }) {
  const fields = contactValues(personal)
  if (!fields.length) return null
  return <div className="cv-document-preview__contact text-slate-600">{fields.map((field) => <span key={field} className="min-w-0 break-words" style={fieldStyle(inlineTextStyles[`personal:${field}`])}>{personal[field]}</span>)}</div>
}

function hasValue(value) {
  if (typeof value === 'string') return Boolean(value.trim())
  if (!value || typeof value !== 'object') return Boolean(value)
  if (Array.isArray(value.content)) return value.content.some((block) => hasValue(block.text) || (block.runs || []).some((run) => hasValue(run.text)))
  return Object.values(value).some((entry) => hasValue(entry))
}

function hasItemContent(item) {
  return Object.entries(item || {}).some(([key, value]) => key !== 'item_id' && hasValue(value))
}

function sectionHasVisibleContent(section, personal, assets) {
  if (section.section_key === 'nameplate') return hasValue(personal.full_name) || hasValue(personal.headline)
  if (section.section_key === 'contact') return contactValues(personal).length > 0
  if (section.section_key === 'avatar') return Boolean(assets?.[personal.avatar_asset_id]?.url)
  return (section.items || []).some(hasItemContent)
}

function SectionContent({ section, personal, assets, locale, inlineTextStyles = {} }) {
  if (section.section_key === 'nameplate') return <div>{personal.full_name && <div className="text-2xl font-extrabold text-slate-900" style={fieldStyle(inlineTextStyles['personal:full_name'])}>{personal.full_name}</div>}{personal.headline && <div className="font-semibold text-[var(--cv-theme)]" style={fieldStyle(inlineTextStyles['personal:headline'])}>{personal.headline}</div>}</div>
  if (section.section_key === 'contact') return <PreviewContact personal={personal} inlineTextStyles={inlineTextStyles} />
  if (section.section_key === 'avatar') {
    const avatar = assets?.[personal.avatar_asset_id]
    const size = avatarSize(personal)
    const position = avatarObjectPosition(personal)
    return avatar?.url ? <div className="mx-auto overflow-hidden rounded-full" style={{ width: `${size}mm`, height: `${size}mm` }}><img src={avatar.url} alt={getCvUiText('upload_avatar', locale)} className="h-full w-full object-cover" style={{ objectPosition: position, transform: `scale(${avatarZoom(personal)})`, transformOrigin: position }} /></div> : null
  }
  const itemAttribute = (item) => `${section.instance_id}:${item.item_id}`
  if (section.section_key === 'summary') return <div className="text-slate-700">{section.items.map((item) => hasValue(item.description) ? <div key={item.item_id} data-cv-item-id={itemAttribute(item)}><RichTextContent value={item.description} /></div> : <p key={item.item_id} data-cv-item-id={itemAttribute(item)}>{item.value}</p>)}</div>
  if (section.section_key === 'experience') return <div className="space-y-3">{section.items.filter(hasItemContent).map((item) => <div key={item.item_id} data-cv-item-id={itemAttribute(item)}>{(item.start_date || item.end_date) && <div className="text-slate-600">{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</div>}{item.role && <div className="font-semibold text-slate-800">{item.role}</div>}{item.company && <div className="text-slate-600">{item.company}</div>}<div className="mt-1 text-slate-700">{hasValue(item.description) ? <RichTextContent value={item.description} /> : item.value}</div></div>)}</div>
  if (section.section_key === 'skills') return <div className="space-y-4">{section.items.filter((item) => item.name || item.value).map((item) => {
    const level = Math.min(5, Math.max(0, Number(item.level) || 0))
    return <div key={item.item_id} data-cv-item-id={itemAttribute(item)} className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-slate-700">{item.name || item.value}</span>{level > 0 && <span className="mt-1 flex shrink-0 gap-0.5" aria-label={`Mức độ ${level} trên 5`}>{[1, 2, 3, 4, 5].map((number) => <span key={number} className={`h-1.5 w-3 rounded-full ${number <= level ? 'bg-[var(--cv-theme)]' : 'bg-slate-200'}`} />)}</span>}</div>
  })}</div>
  return <div className="space-y-3">{section.items.filter(hasItemContent).map((item) => <div key={item.item_id} data-cv-item-id={itemAttribute(item)}>{(item.start_date || item.end_date) && <p className="text-slate-600">{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</p>}{(item.name || item.degree || item.title || item.value) && <p className="font-semibold text-slate-800">{item.name || item.degree || item.title || item.value}</p>}{(item.institution || item.issuer || item.organization || item.role) && <p className="text-slate-600">{item.institution || item.issuer || item.organization || item.role}</p>}<div className="text-slate-700">{hasValue(item.description) ? <RichTextContent value={item.description} /> : null}</div></div>)}</div>
}

function PreviewSection({ section, themeColor, personal, assets, locale, inlineTextStyles }) {
  if (!section.enabled || !sectionHasVisibleContent(section, personal, assets)) return null
  const definition = getSectionDefinition(section.section_key)
  return <section data-section-id={section.instance_id} className="cv-document-preview__section mb-5 break-inside-avoid last:mb-0">{!definition?.personalInfoBacked && <h3 className="mb-3 border-b pb-2.5 text-sm font-bold uppercase tracking-wide" style={{ color: themeColor, borderColor: `${themeColor}55` }}>{section.title || getSectionDisplayName(section.section_key, locale)}</h3>}<SectionContent section={section} personal={personal} assets={assets} locale={locale} inlineTextStyles={inlineTextStyles} /></section>
}

function RegionRows({ regions, contract, document, assets, renderRegion, pageNumber }) {
  const personal = document.content_json.personal_info || {}
  return <div className="space-y-3">{contract.rows.map((row) => {
    const rowRegions = row.map((id) => regions.find((region) => region.id === id)).filter(Boolean)
    if (!rowRegions.length) return null
    return <div key={row.join(':')} className="grid gap-3" style={{ gridTemplateColumns: rowRegions.map((region) => `${region.widthPercent || 100}fr`).join(' ') }}>{rowRegions.map((region) => renderRegion
      ? renderRegion(region, pageNumber)
      : <div key={region.id}>{region.sections.map((section) => <PreviewSection key={section.instance_id} section={section} themeColor={document.style_json.theme_color} personal={personal} assets={assets} locale={document.content_json.locale} inlineTextStyles={document.content_json.inline_text_styles} />)}</div>)}</div>
  })}</div>
}

function A4Page({ page, document, contract, assets, renderRegion, renderHeader, pageAriaLabel, pageLabelVariant }) {
  const { content_json, style_json } = document
  const personal = content_json.personal_info || {}
  const background = assets?.[style_json.background_asset_id]
  const pageMargin = Math.min(18, Math.max(6, Number(document.layout_json?.page?.margin_mm) || 10))

  return (
    <div className="cv-document-preview__page-wrap relative mb-5">
      <p className={`cv-document-preview__page-label text-xs font-semibold ${pageLabelVariant === 'badge' ? 'absolute -left-3 bottom-2 z-10 rounded-sm bg-emerald-400 px-1.5 py-0.5 text-white' : 'mb-1 text-center text-slate-500'}`}>Trang {page.number}</p>
      <article
        aria-label={pageAriaLabel?.(page.number) || `Xem trước CV ${contract.key} trang ${page.number}`}
        className="cv-document-preview__page mx-auto h-[297mm] w-[210mm] overflow-hidden bg-white text-[11px] shadow-lg"
        style={{ padding: `${pageMargin}mm`, fontFamily: getCvFontStack(style_json.font_family), fontSize: `${style_json.font_scale}em`, lineHeight: style_json.line_height, backgroundImage: background?.url ? `url(${background.url})` : undefined, backgroundSize: 'cover', '--cv-theme': style_json.theme_color }}
      >
        {page.number === 1 && (renderHeader ? renderHeader(page.number) : contract.key !== 'header_two_column_v1' && (sectionHasVisibleContent({ section_key: 'nameplate' }, personal, assets) || contactValues(personal).length > 0) && <header className="mb-6 border-l-4 pl-4" style={{ borderColor: style_json.theme_color }}>
          {personal.full_name && <h2 className="text-2xl font-extrabold text-slate-900" style={fieldStyle(content_json.inline_text_styles?.['personal:full_name'])}>{personal.full_name}</h2>}
          {personal.headline && <p className="mt-1 font-semibold" style={{ ...fieldStyle(content_json.inline_text_styles?.['personal:headline']), color: content_json.inline_text_styles?.['personal:headline']?.color || style_json.theme_color }}>{personal.headline}</p>}
          <div className="mt-2"><PreviewContact personal={personal} inlineTextStyles={content_json.inline_text_styles} /></div>
        </header>)}
        <RegionRows regions={page.regions} contract={contract} document={document} assets={assets} renderRegion={renderRegion} pageNumber={page.number} />
      </article>
    </div>
  )
}

export default function CvDocumentPreview({ document, rendererKey, assets = {}, renderRegion, renderHeader, pageAriaLabel, className = '', paginateItems = true, editorChrome = true, pageLabelVariant = 'heading' }) {
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
        sections[element.dataset.sectionId] = (sections[element.dataset.sectionId] || 0) + Math.ceil(element.offsetHeight)
      }
      const next = {
        sections,
        items: paginateItems ? Object.fromEntries([...preview.querySelectorAll('[data-cv-item-id]')].map((element) => [element.dataset.cvItemId, Math.ceil(element.offsetHeight)])) : {},
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
  return (
    <div ref={previewRef} className={`cv-document-preview ${editorChrome ? 'overflow-auto rounded-xl bg-slate-200 p-3 shadow-inner' : 'overflow-visible bg-transparent p-0'} ${className}`}>
      {pages.map((page) => <A4Page key={page.number} page={page} document={document} contract={contract} assets={assets} renderRegion={renderRegion} renderHeader={renderHeader} pageAriaLabel={pageAriaLabel} pageLabelVariant={pageLabelVariant} />)}
    </div>
  )
}
