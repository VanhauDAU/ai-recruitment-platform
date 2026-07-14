import { CrownFilled, RightOutlined } from '@ant-design/icons'
import { Button, Tag } from 'antd'
import { Link } from 'react-router-dom'
import CvTemplatePreview from './CvTemplatePreview'

export default function CvTemplateCard({ template, onUse }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/mau-cv/${template.slug}`} className="block p-3">
        <CvTemplatePreview template={template} compact />
      </Link>
      <div className="px-4 pb-4 pt-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/mau-cv/${template.slug}`} className="line-clamp-1 text-base font-bold text-slate-900 transition group-hover:text-[var(--brand-primary)]">
            {template.display_name}
          </Link>
          {template.is_premium && <CrownFilled className="mt-1 shrink-0 text-amber-400" title="Mẫu Premium" />}
        </div>
        <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{template.description || 'Mẫu CV có bố cục rõ ràng, dễ tùy chỉnh.'}</p>
        <div className="mt-3 flex min-h-5 flex-wrap gap-1.5">
          {template.tags.slice(0, 2).map((tag) => <Tag key={tag.public_id} color="green" className="!m-0">{tag.name}</Tag>)}
        </div>
        <div className="mt-4 flex gap-2">
          <Link to={`/mau-cv/${template.slug}`} className="flex-1">
            <Button block>Chi tiết <RightOutlined /></Button>
          </Link>
          <Button
            type="primary"
            onClick={() => onUse?.(template)}
            className="!min-w-24"
          >
            Dùng mẫu
          </Button>
        </div>
      </div>
    </article>
  )
}
