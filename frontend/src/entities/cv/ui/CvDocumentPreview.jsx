import { getRendererContract, projectDocumentForRenderer } from '../model/renderer-contracts'
import { richTextToText } from '../model/document'
import { getSectionDefinition } from '../model/section-registry'

function SectionContent({ section }) {
  if (section.section_key === 'summary') return <p className="whitespace-pre-line text-slate-700">{section.items.map((item) => item.value || richTextToText(item.description)).filter(Boolean).join('\n')}</p>
  if (section.section_key === 'experience') return <div className="space-y-3">{section.items.map((item) => <div key={item.item_id}><div className="font-semibold text-slate-800">{item.role || 'Vị trí'}</div><div className="text-slate-600">{[item.company, item.start_date, item.end_date].filter(Boolean).join(' · ')}</div><p className="mt-1 whitespace-pre-line text-slate-700">{item.description ? richTextToText(item.description) : item.value}</p></div>)}</div>
  if (section.section_key === 'skills') return <div className="flex flex-wrap gap-1.5">{section.items.filter((item) => item.name || item.value).map((item) => <span key={item.item_id} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{item.name || item.value}</span>)}</div>
  return <div className="space-y-1">{section.items.map((item) => <p key={item.item_id} className="text-slate-700">{item.value || item.name || item.title || ''}</p>)}</div>
}

function PreviewSection({ section, themeColor }) {
  if (!section.enabled) return null
  return <section className="mb-5"><h3 className="mb-2 border-b pb-1 text-sm font-bold uppercase tracking-wide" style={{ color: themeColor, borderColor: `${themeColor}55` }}>{section.title || getSectionDefinition(section.section_key)?.displayName || section.section_key}</h3><SectionContent section={section} /></section>
}

export default function CvDocumentPreview({ document, rendererKey }) {
  const { content_json, style_json } = document
  const projection = projectDocumentForRenderer(document, rendererKey)
  const contract = getRendererContract(rendererKey)
  const personal = content_json.personal_info || {}
  const gridTemplateColumns = contract.columns === 2 ? projection.regions.map((region) => `${region.widthPercent || 50}fr`).join(' ') : 'minmax(0, 1fr)'

  return (
    <div className="overflow-auto rounded-xl bg-slate-200 p-3 shadow-inner">
      <article
        aria-label={`Xem trước CV ${contract.key}`}
        className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-[11px] shadow-lg"
        style={{ fontFamily: style_json.font_family, fontSize: `${style_json.font_scale}em`, lineHeight: style_json.line_height }}
      >
        <header className="mb-6 border-l-4 pl-4" style={{ borderColor: style_json.theme_color }}>
          <h2 className="text-2xl font-extrabold text-slate-900">{personal.full_name || 'Họ và tên'}</h2>
          <p className="mt-1 font-semibold" style={{ color: style_json.theme_color }}>{personal.headline || 'Chức danh mong muốn'}</p>
          <p className="mt-2 text-slate-600">{[personal.email, personal.phone, personal.address].filter(Boolean).join(' · ')}</p>
        </header>
        <div className="grid gap-5" style={{ gridTemplateColumns }}>
          {projection.regions.map((region) => <div key={region.id}>{region.sections.map((section) => <PreviewSection key={section.instance_id} section={section} themeColor={style_json.theme_color} />)}</div>)}
        </div>
      </article>
    </div>
  )
}
