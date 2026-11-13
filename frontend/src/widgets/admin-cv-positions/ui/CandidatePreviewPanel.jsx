import { LoadingOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Segmented, Select } from 'antd'
import { useState } from 'react'
import { FittedCvPreview } from '@/entities/cv'
import { DEFAULT_CV_EXPERIENCE_BAND, adminCvTemplates, previewAdminTemplate } from '@/entities/cv-template'
import { BANDS, LOCALES } from '../model/catalog'

// CV ứng viên thực sự nhận khi chọn vị trí này, theo mức kinh nghiệm, ngôn ngữ và
// mẫu. Chỉ hiện nội dung đã lưu và đã xuất bản.
export default function CandidatePreviewPanel({ positionPublicId, positionName }) {
  const [band, setBand] = useState(DEFAULT_CV_EXPERIENCE_BAND)
  const [locale, setLocale] = useState('vi-VN')
  const [templateId, setTemplateId] = useState()
  const templates = useQuery({ queryKey: ['admin-cv-templates'], queryFn: () => adminCvTemplates.list() })
  const published = (templates.data || []).filter((template) => template.current_published_version_id)
  const template = published.find((item) => item.public_id === templateId) || published[0]
  const preview = useQuery({
    queryKey: ['admin-cv-position-preview', positionPublicId, band, locale, template?.public_id],
    queryFn: () => previewAdminTemplate(template.public_id, { position_public_id: positionPublicId, experience_band: band, locale }),
    enabled: Boolean(template),
    placeholderData: keepPreviousData,
  })
  return <aside aria-label="CV ứng viên nhận" className="overflow-hidden rounded-[13px] border border-slate-200 bg-white shadow-sm">
    <header className="space-y-2 border-b border-slate-100 p-3">
      <p className="flex items-center justify-between gap-2 text-sm font-bold text-slate-900">
        <span className="min-w-0 truncate">CV ứng viên nhận · {positionName}</span>
        {preview.isFetching && <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-slate-500"><LoadingOutlined />Đang cập nhật</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <Select size="small" aria-label="Số năm kinh nghiệm xem thử" value={band} onChange={setBand} options={BANDS.map((item) => ({ value: item.value, label: item.label, title: item.who }))} className="flex-[1_1_7rem]" />
        <Select size="small" aria-label="Mẫu CV xem thử" value={template?.public_id} onChange={setTemplateId} loading={templates.isLoading} options={published.map((item) => ({ value: item.public_id, label: `Mẫu ${item.name}` }))} className="flex-[1_1_9rem]" />
        <Segmented size="small" aria-label="Ngôn ngữ xem thử" value={locale} onChange={setLocale} options={LOCALES.map(({ value }) => ({ value, label: value === 'vi-VN' ? 'VI' : 'EN' }))} />
      </div>
    </header>
    <div className="bg-slate-100 p-3 xl:max-h-[calc(100vh_-_var(--admin-topbar-height,72px)_-_9rem)] xl:overflow-y-auto xl:[scrollbar-gutter:stable]">
      {!templates.isLoading && !template && <Alert type="info" showIcon message="Chưa có mẫu CV nào được xuất bản để xem thử." />}
      {preview.isError && <Alert className="!mb-3" type="warning" showIcon message="Chưa xem thử được: vị trí chưa có nội dung cho lựa chọn này." />}
      {preview.data?.document
        ? <FittedCvPreview document={preview.data.document} rendererKey={preview.data.renderer_key} updating={preview.isFetching} />
        : template && !preview.isError && <div className="mx-auto aspect-[210/297] w-full animate-pulse rounded bg-white" />}
    </div>
  </aside>
}
