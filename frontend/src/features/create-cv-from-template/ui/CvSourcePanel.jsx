import { InboxOutlined, LinkedinFilled } from '@ant-design/icons'
import { Select, Spin, Upload, message } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyCvs } from '@/entities/cv'
import { getCvPositionOptions, getCvPositionPreview } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { useSiteSettings } from '@/entities/site-settings'
import { createCvFromTemplate } from '../api/create-cv.api'
import { createCvErrorMessage } from '../api/create-cv.errors'

const SAMPLE_LOCALES = [
  { value: 'vi-VN', label: 'Tiếng Việt' },
  { value: 'en-US', label: 'Tiếng Anh' },
  { value: 'ja-JP', label: 'Tiếng Nhật' },
  { value: 'zh-CN', label: 'Tiếng Trung' },
]

function SourceOption({ value, current, onSelect, title, note, disabled, children }) {
  const active = current === value
  return (
    <div
      className={[
        'rounded-xl border bg-white transition-all duration-200',
        active ? 'border-[var(--brand-primary)] shadow-sm' : 'border-slate-200 hover:border-[var(--brand-primary)]',
        disabled ? 'opacity-55' : 'cursor-pointer',
      ].join(' ')}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(value)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left disabled:cursor-not-allowed cursor-pointer"
      >
        <span
          aria-hidden
          className={[
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
            active ? 'border-[var(--brand-primary)]' : 'border-slate-300',
          ].join(' ')}
        >
          {active && <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" />}
        </span>
        <span className="min-w-0">
          <span className={`block text-sm font-semibold transition-colors duration-200 ${active ? 'text-[var(--brand-primary)]' : 'text-slate-800'}`}>{title}</span>
          {note && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{note}</span>}
        </span>
      </button>
      {active && children && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function CvSourcePanel({ template, locale = 'vi-VN', themeColor, onCreated, onBack, onSampleContentChange }) {
  const { user, isAuthenticated } = useSession()
  const { siteName } = useSiteSettings()
  const [source, setSource] = useState(null)
  const [myCvs, setMyCvs] = useState([])
  const [selectedCvId, setSelectedCvId] = useState(null)
  const [sampleLocale, setSampleLocale] = useState(locale)
  const [positions, setPositions] = useState([])
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewAvailable, setPreviewAvailable] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setSource(null)
    setSelectedCvId(null)
    setSelectedPosition(null)
    setSampleLocale(locale)

    let cancelled = false
    if (isAuthenticated && user?.role === 'candidate') {
      getMyCvs()
        .then((data) => !cancelled && setMyCvs(data))
        .catch(() => !cancelled && setMyCvs([]))
    } else {
      setMyCvs([])
    }
    return () => {
      cancelled = true
    }
  }, [template, locale, isAuthenticated, user])

  useEffect(() => {
    if (source !== 'sample') return undefined
    let cancelled = false
    setLoadingPositions(true)
    getCvPositionOptions()
      .then((data) => {
        if (cancelled) return
        setPositions(data)
        setSelectedPosition((current) => {
          const options = data.map((position) => position.public_id).filter(Boolean)
          return current && options.includes(current) ? current : (options[0] || null)
        })
      })
      .catch(() => !cancelled && setPositions([]))
      .finally(() => !cancelled && setLoadingPositions(false))
    return () => {
      cancelled = true
    }
  }, [source])

  useEffect(() => {
    if (source !== 'sample' || !selectedPosition) {
      setPreviewAvailable(false)
      setPreviewError('')
      onSampleContentChange?.(null)
      return undefined
    }
    let cancelled = false
    setLoadingPreview(true)
    setPreviewAvailable(false)
    setPreviewError('')
    onSampleContentChange?.(null)
    getCvPositionPreview(selectedPosition, sampleLocale)
      .then((data) => {
        if (!cancelled) {
          setPreviewAvailable(true)
          onSampleContentChange?.(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError('Vị trí này chưa được quản trị cấu hình nội dung cho ngôn ngữ đã chọn.')
          onSampleContentChange?.(null)
        }
      })
      .finally(() => !cancelled && setLoadingPreview(false))
    return () => {
      cancelled = true
    }
  }, [source, selectedPosition, sampleLocale, onSampleContentChange])

  const canSubmit = source === 'blank' || (source === 'sample' && Boolean(selectedPosition) && previewAvailable)
  const pendingBackend = source === 'previous' || source === 'upload'

  const submit = async () => {
    if (!isAuthenticated || user?.role !== 'candidate') {
      message.warning('Hãy đăng nhập bằng tài khoản ứng viên để tạo CV.')
      return
    }
    if (!user?.email_verified) {
      message.warning('Bạn cần xác thực email trước khi tạo CV.')
      return
    }
    setSubmitting(true)
    try {
      const cv = await createCvFromTemplate({
        title: `CV ${template.display_name}`,
        template_public_id: template.public_id,
        language: source === 'sample' ? sampleLocale : locale,
        ...(themeColor ? { theme_color: themeColor } : {}),
        ...(source === 'sample' ? { position_public_id: selectedPosition } : {}),
      })
      message.success('Đã tạo CV. Bạn có thể bắt đầu chỉnh sửa ngay.')
      onCreated?.(cv)
    } catch (error) {
      message.error(createCvErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {myCvs.length > 0 && (
          <SourceOption value="previous" current={source} onSelect={setSource} title="Nội dung CV đã tạo trước đó">
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {myCvs.map((cv) => (
                <button
                  key={cv.public_id}
                  type="button"
                  onClick={() => setSelectedCvId(cv.public_id)}
                  className={[
                    'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left cursor-pointer transition-all duration-200',
                    selectedCvId === cv.public_id
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft,#f0fdf4)]'
                      : 'border-slate-200 hover:border-[var(--brand-primary)] bg-white',
                  ].join(' ')}
                >
                  <span
                    aria-hidden
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${selectedCvId === cv.public_id ? 'border-[var(--brand-primary)]' : 'border-slate-300'}`}
                  >
                    {selectedCvId === cv.public_id && <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{cv.title}</span>
                    <span className="block text-xs text-slate-500">{cv.updated_at ? new Date(cv.updated_at).toLocaleDateString('vi-VN') : ''}</span>
                  </span>
                  <Link to={`/cvs/${cv.public_id}/view`} target="_blank" className="shrink-0 text-xs font-medium text-[#00b14f] hover:text-[#008a3e] cursor-pointer" onClick={(event) => event.stopPropagation()}>
                    (Xem CV)
                  </Link>
                </button>
              ))}
              <p className="text-xs leading-5 text-amber-600 mt-1">Sao chép nội dung từ CV có sẵn sẽ sớm được kích hoạt.</p>
            </div>
          </SourceOption>
        )}

        <SourceOption value="sample" current={source} onSelect={setSource} title={`Nội dung CV mẫu ${siteName} gợi ý`}>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Chọn ngôn ngữ</p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_LOCALES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSampleLocale(item.value)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer',
                    sampleLocale === item.value
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-xs font-semibold text-slate-700">Chọn vị trí</p>
            <Select
              showSearch
              virtual={false}
              className="w-full"
              placeholder="Nhập để tìm kiếm vị trí"
              loading={loadingPositions || loadingPreview}
              value={selectedPosition}
              onChange={(val) => setSelectedPosition(val)}
              optionFilterProp="label"
              notFoundContent={loadingPositions ? <Spin size="small" /> : 'Không tìm thấy vị trí chuyên môn'}
              options={positions.map((position) => ({
                value: position.public_id,
                label: position.name_vi,
              }))}
            />
            {previewError && <p className="mt-1.5 text-xs leading-5 text-amber-600">{previewError}</p>}
          </div>
        </SourceOption>

        <SourceOption
          value="upload"
          current={source}
          onSelect={setSource}
          title={(
            <>Nội dung CV từ máy tính của bạn hoặc <LinkedinFilled className="text-[#0a66c2]" /> LinkedIn</>
          )}
        >
          <div>
            <Upload.Dragger accept=".pdf,.doc,.docx" maxCount={1} beforeUpload={() => false}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="px-2 text-sm">Chọn hoặc kéo thả tệp CV vào đây</p>
              <p className="px-2 text-xs text-slate-500">Hỗ trợ định dạng .pdf, .doc, .docx (tối đa 5MB)</p>
            </Upload.Dragger>
            <p className="mt-2 text-xs leading-5 text-amber-600">Nhập nội dung từ tệp sẽ sớm được kích hoạt.</p>
          </div>
        </SourceOption>

        <SourceOption
          value="restore"
          current={source}
          onSelect={setSource}
          title="Khôi phục bản chưa lưu"
          note="Tiếp tục chỉnh sửa từ bản CV gần nhất bạn chưa lưu"
          disabled
        />

        <SourceOption
          value="blank"
          current={source}
          onSelect={setSource}
          title="Tạo CV từ đầu"
          note="Bắt đầu từ một khung CV trắng không có nội dung gợi ý"
        />
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        {pendingBackend && (
          <p className="mb-2 text-xs leading-5 text-amber-600">Lựa chọn này sẽ sớm được hỗ trợ. Hãy chọn nội dung mẫu hoặc tạo CV từ đầu.</p>
        )}
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={submit}
          className="w-full rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
        >
          {submitting ? 'Đang tạo…' : 'Tạo CV'}
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-lg border border-[#00b14f] bg-white py-2 text-sm font-semibold text-[#00b14f] transition hover:bg-slate-50 cursor-pointer mt-3 flex items-center justify-center gap-1.5"
          >
            ← Quay lại danh sách mẫu CV
          </button>
        )}
      </div>
    </>
  )
}
