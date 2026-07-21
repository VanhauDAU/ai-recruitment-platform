import { InboxOutlined } from '@ant-design/icons'
import { Select, Spin, Upload } from 'antd'
import { Link } from 'react-router-dom'
import { useSiteSettings } from '@/entities/site-settings'
import { useCvSource } from '../model/use-cv-source'

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

export default function CvSourcePanel({ template, locale = 'vi-VN', themeColor, onCreated, onBack, onPreviewChange, onRequireLogin }) {
  const { siteName } = useSiteSettings()
  const {
    locales,
    source,
    setSource,
    myCvs,
    selectedCvId,
    setSelectedCvId,
    recoverable,
    sampleLocale,
    setSampleLocale,
    positions,
    loadingPositions,
    loadingPreview,
    previewError,
    selectedPosition,
    setSelectedPosition,
    submitting,
    setUploadFile,
    importCvId,
    importError,
    setImportError,
    canSubmit,
    retryUpload,
    submit,
  } = useCvSource({ template, locale, themeColor, onCreated, onPreviewChange, onRequireLogin })

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
            </div>
          </SourceOption>
        )}

        <SourceOption value="sample" current={source} onSelect={setSource} title={`Nội dung CV mẫu ${siteName} gợi ý`}>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Chọn ngôn ngữ</p>
            <div className="flex flex-wrap gap-1.5">
              {locales.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setSampleLocale(item.code)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer',
                    sampleLocale === item.code
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  ].join(' ')}
                >
                  {item.label_vi}
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
                label: position.display_name || position.name_vi,
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
            <>Nội dung CV từ máy tính của bạn</>
          )}
        >
          <div>
            <Upload.Dragger
              accept=".pdf,.docx"
              maxCount={1}
              beforeUpload={(file) => { setUploadFile(file); setImportError(''); return false }}
              onRemove={() => { setUploadFile(null); setImportCvId(null); setImportError('') }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="px-2 text-sm">Chọn hoặc kéo thả tệp CV vào đây</p>
              <p className="px-2 text-xs text-slate-500">Hỗ trợ .pdf hoặc .docx, tối đa 5MB và 20 trang</p>
            </Upload.Dragger>
            {submitting && <p className="mt-2 text-xs leading-5 text-slate-500">Đang trích xuất và chuẩn hóa nội dung CV…</p>}
            {importError && <p className="mt-2 text-xs leading-5 text-amber-600">{importError}</p>}
            {importCvId && importError && (
              <div className="mt-2 flex gap-3">
                <button type="button" className="text-xs font-semibold text-[var(--brand-primary)]" onClick={retryUpload}>Thử phân tích lại</button>
                <button type="button" className="text-xs font-semibold text-slate-600" onClick={() => setSource('blank')}>Tạo CV trống</button>
              </div>
            )}
          </div>
        </SourceOption>

        <SourceOption
          value="restore"
          current={source}
          onSelect={setSource}
          title="Khôi phục bản chưa lưu"
          note={recoverable?.cv?.draft_updated_at
            ? `Tiếp tục bản gần nhất lúc ${new Date(recoverable.cv.draft_updated_at).toLocaleString('vi-VN')}`
            : 'Không có bản đang chỉnh sửa cần khôi phục'}
          disabled={!recoverable}
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
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={submit}
          className="w-full rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
        >
          {submitting ? 'Đang xử lý…' : (source === 'restore' ? 'Tiếp tục chỉnh sửa' : (source === 'upload' ? 'Phân tích và tạo CV' : 'Tạo CV'))}
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
