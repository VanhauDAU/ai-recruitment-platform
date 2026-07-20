import { lazy, Suspense } from 'react'

// Editor TipTap/ProseMirror nặng (~150KB gzip) và chỉ cần khi người dùng thực sự
// soạn thảo. Tách lazy để các trang chỉ render editor theo điều kiện (vd form sửa
// công ty) không phải tải khối này trong chunk ban đầu. API giữ nguyên.
const RichTextEditorImpl = lazy(() => import('./RichTextEditorImpl'))

export default function RichTextEditor(props) {
  return (
    <Suspense
      fallback={(
        <div
          className={`company-rich-editor ${props.error ? 'company-rich-editor--error' : ''}`}
          style={{ minHeight: 160 }}
          aria-busy="true"
        />
      )}
    >
      <RichTextEditorImpl {...props} />
    </Suspense>
  )
}
