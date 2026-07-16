import { EyeOutlined, MoreOutlined, RedoOutlined, SaveOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import { Button, Dropdown } from 'antd'
import InlineText from './canvas/InlineText'
import EditorSaveState from './EditorSaveState'

export default function BuilderTopBar({ editor, onPreview }) {
  return <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 shadow-sm md:px-5">
    <InlineText value={editor.cv.title || 'CV chưa đặt tên'} placeholder="CV chưa đặt tên" ariaLabel="Tên CV" className="max-w-64 truncate text-base font-bold text-slate-900" onCommit={(title) => editor.rename(title || 'CV chưa đặt tên')} registerPendingEdit={editor.registerPendingEdit} />
    <div className="flex items-center gap-1.5">
      <EditorSaveState phase={editor.phase} error={editor.error} onRetry={editor.retryAutosave} onReload={editor.reloadDraft} />
      <Button aria-label="Hoàn tác" icon={<UndoOutlined />} disabled={!editor.canUndo || editor.phase === 'conflict'} onClick={editor.undo} />
      <Button aria-label="Làm lại" icon={<RedoOutlined />} disabled={!editor.canRedo || editor.phase === 'conflict'} onClick={editor.redo} />
      <Button aria-label="Xem trước" icon={<EyeOutlined />} onClick={onPreview} className="hidden sm:inline-flex">Xem trước</Button>
      <Button aria-label="Lưu phiên bản" type="primary" icon={<SaveOutlined />} loading={editor.phase === 'saving'} disabled={editor.phase === 'conflict'} onClick={editor.saveVersion}>Lưu CV</Button>
      <Dropdown menu={{ items: [{ key: 'publish', label: 'Xuất bản CV', icon: <SendOutlined />, onClick: editor.publishVersion }] }}><Button aria-label="Thao tác khác" icon={<MoreOutlined />} /></Dropdown>
    </div>
  </header>
}
