import { EyeOutlined, FileTextOutlined, MoreOutlined, RedoOutlined, SaveOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import { Button, Dropdown } from 'antd'
import InlineText from './canvas/InlineText'
import EditorSaveState from './EditorSaveState'

export default function BuilderTopBar({ editor, onPreview }) {
  return <header aria-label="Thanh hành động CV" className="z-40 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 md:px-5">
    <div className="flex min-w-0 items-center gap-3">
      <FileTextOutlined className="shrink-0 text-lg text-emerald-600" />
      <InlineText value={editor.cv.title || 'CV chưa đặt tên'} placeholder="CV chưa đặt tên" ariaLabel="Tên CV" className="w-[min(36vw,30rem)] min-w-40 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-lg font-extrabold text-slate-800 transition hover:border-emerald-300 hover:bg-white focus:border-emerald-500 sm:min-w-64 md:text-xl" onCommit={(title) => editor.rename(title || 'CV chưa đặt tên')} registerPendingEdit={editor.registerPendingEdit} />
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="hidden lg:block"><EditorSaveState phase={editor.phase} error={editor.error} onRetry={editor.retryAutosave} onReload={editor.reloadDraft} /></span>
      <Button type="text" aria-label="Hoàn tác" icon={<UndoOutlined />} disabled={!editor.canUndo || editor.phase === 'conflict'} onClick={editor.undo} />
      <Button type="text" aria-label="Làm lại" icon={<RedoOutlined />} disabled={!editor.canRedo || editor.phase === 'conflict'} onClick={editor.redo} />
      <Button aria-label="Xem trước" icon={<EyeOutlined />} onClick={onPreview} className="hidden rounded-full sm:inline-flex">Xem trước</Button>
      <Button aria-label="Lưu phiên bản" type="primary" shape="round" icon={<SaveOutlined />} loading={editor.phase === 'saving'} disabled={editor.phase === 'conflict'} onClick={editor.saveVersion}>Lưu CV</Button>
      <Dropdown menu={{ items: [{ key: 'publish', label: 'Xuất bản CV', icon: <SendOutlined />, onClick: editor.publishVersion }] }}><Button type="text" aria-label="Thao tác khác" icon={<MoreOutlined />} /></Dropdown>
    </div>
  </header>
}
