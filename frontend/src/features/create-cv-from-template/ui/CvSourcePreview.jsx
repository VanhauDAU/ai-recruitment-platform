import { useMemo } from 'react'
import { FittedCvPreview } from '@/entities/cv'

const NOTES = {
  empty: 'Chưa có nội dung CV mẫu cho ngôn ngữ này.',
  error: 'Không tải được bản xem trước.',
  unavailable: 'CV từ tệp tải lên sẽ hiện sau khi phân tích xong.',
}

// Bản xem trước của lựa chọn hiện tại. Màu chủ đạo áp phía client nên đổi màu
// tức thì, không gọi lại API; bản cũ mờ nhẹ trong lúc tải bản mới.
export default function CvSourcePreview({ preview, themeColor }) {
  const document = useMemo(() => (preview.document && themeColor
    ? { ...preview.document, style_json: { ...preview.document.style_json, theme_color: themeColor } }
    : preview.document), [preview.document, themeColor])
  const note = ['empty', 'error', 'unavailable'].find((key) => preview[key])
  if (document) return <FittedCvPreview document={document} rendererKey={preview.rendererKey} updating={preview.updating} />
  return <div className="mx-auto flex aspect-[210/297] w-full max-w-[794px] items-center justify-center bg-white p-8 shadow-sm">
    {note
      ? <p className="text-center text-sm text-slate-500">{NOTES[note]}</p>
      : <div aria-label="Đang tải bản xem trước" className="h-full w-full animate-pulse space-y-3"><div className="h-6 w-1/2 rounded bg-slate-100" /><div className="h-3 w-1/3 rounded bg-slate-100" /><div className="mt-8 h-40 rounded bg-slate-50" /></div>}
  </div>
}
