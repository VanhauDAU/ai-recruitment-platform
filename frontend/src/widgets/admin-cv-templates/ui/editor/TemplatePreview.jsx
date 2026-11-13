import { LoadingOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Segmented, Select } from 'antd'
import { useMemo, useState } from 'react'
import { FittedCvPreview } from '@/entities/cv'
import { CV_EXPERIENCE_BANDS, DEFAULT_CV_EXPERIENCE_BAND, getCvPositionOptions, previewAdminTemplate } from '@/entities/cv-template'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

const LOCALES = [{ value: 'vi-VN', label: 'Tiếng Việt' }, { value: 'en-US', label: 'Tiếng Anh' }]
const BLANK = ''

// Xem trước bản đang sửa với nội dung gợi ý của một vị trí — đúng thứ ứng viên
// nhận. Đổi màu chỉ thay màu chủ đạo phía client, không gọi lại API.
export default function TemplatePreview({ template, version }) {
  const [locale, setLocale] = useState('vi-VN')
  const [band, setBand] = useState(DEFAULT_CV_EXPERIENCE_BAND)
  const [position, setPosition] = useState(null)
  const [color, setColor] = useState(null)
  const positions = useQuery({ queryKey: ['cv-position-options', locale], queryFn: () => getCvPositionOptions(locale), staleTime: 10 * 60_000 })
  // Chưa chọn: lấy vị trí đầu tiên để bản xem trước có nội dung thật.
  const positionId = position ?? positions.data?.[0]?.public_id ?? BLANK
  const payload = { version_id: version.id, locale, experience_band: band, ...(positionId ? { position_public_id: positionId } : {}) }
  const revision = { renderer: version.renderer_key, layout: version.default_layout_json, style: version.default_style_json, sections: version.sections }
  const preview = useQuery({
    queryKey: ['admin-cv-template-preview', template.public_id, payload, revision],
    queryFn: () => previewAdminTemplate(template.public_id, payload),
    enabled: !positions.isLoading,
    placeholderData: keepPreviousData,
  })
  const defaultColor = template.colors.find((item) => item.is_default)?.hex_code
  const themeColor = template.colors.some((item) => item.hex_code === color) ? color : defaultColor
  const document = useMemo(() => {
    const base = preview.data?.document
    return base && themeColor ? { ...base, style_json: { ...base.style_json, theme_color: themeColor } } : base
  }, [preview.data, themeColor])

  return <section aria-label="Xem trước mẫu" className="overflow-hidden rounded-[13px] border border-slate-200 bg-white shadow-sm">
    <div className="space-y-2 border-b border-slate-100 p-3">
      <div className="flex flex-wrap gap-2">
        <Select showSearch aria-label="Vị trí xem trước" className="min-w-0 flex-[1_1_12rem]" optionFilterProp="label" loading={positions.isLoading} value={positionId} onChange={setPosition}
          options={[{ value: BLANK, label: 'CV trống (chưa có nội dung)' }, ...(positions.data || []).map((item) => ({ value: item.public_id, label: item.display_name }))]} />
        <Select aria-label="Kinh nghiệm xem trước" className="flex-[0_1_9rem]" value={band} onChange={setBand} options={CV_EXPERIENCE_BANDS.map(({ value, label }) => ({ value, label }))} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented size="small" aria-label="Ngôn ngữ xem trước" value={locale} onChange={(next) => { setLocale(next); setPosition(null) }} options={LOCALES} />
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Màu xem trước">{template.colors.map((item) => <button key={item.public_id} type="button" role="radio" aria-checked={item.hex_code === themeColor} title={item.name} onClick={() => setColor(item.hex_code)}
          className={`h-5 w-5 rounded-full border border-black/10 transition ${item.hex_code === themeColor ? 'ring-2 ring-slate-700 ring-offset-1' : 'hover:scale-110'}`} style={{ background: item.hex_code }} />)}</div>
        {preview.isFetching && <span className="ml-auto flex items-center gap-1 text-xs text-slate-500"><LoadingOutlined />Đang cập nhật</span>}
      </div>
    </div>
    <div className="bg-slate-100 p-3 sm:p-4 lg:max-h-[calc(100vh_-_var(--admin-topbar-height,72px)_-_8rem)] lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
      {preview.isError && <Alert className="!mb-3" type="warning" showIcon message={getApiErrorMessage(preview.error, 'Chưa xem trước được với lựa chọn này.')} />}
      {document
        ? <FittedCvPreview document={document} rendererKey={preview.data.renderer_key} updating={preview.isFetching} />
        : !preview.isError && <div className="mx-auto aspect-[210/297] w-full max-w-[794px] animate-pulse rounded bg-white" />}
    </div>
  </section>
}
