import {
  BoldOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  RedoOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import CharacterCount from '@tiptap/extension-character-count'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button, Tooltip } from 'antd'
import { useEffect } from 'react'

function ToolbarButton({ title, active = false, disabled = false, onClick, children }) {
  return (
    <Tooltip title={title}>
      <Button
        type={active ? 'primary' : 'text'}
        size="small"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        aria-label={title}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

export default function RichTextEditor({ value = '', onChange, maxLength = 10000, placeholder = '', disabled = false, error = false }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit,
      CharacterCount.configure({ limit: maxLength }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'company-rich-editor__content',
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor: activeEditor }) => onChange?.(activeEditor.isEmpty ? '' : activeEditor.getHTML()),
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor || editor.getHTML() === value || (!value && editor.isEmpty)) return
    editor.commands.setContent(value || '', { emitUpdate: false })
  }, [editor, value])

  if (!editor) return null
  const characters = editor.storage.characterCount.characters()

  return (
    <div className={`company-rich-editor ${error ? 'company-rich-editor--error' : ''}`}>
      <div className="company-rich-editor__toolbar" role="toolbar" aria-label="Công cụ định dạng văn bản">
        <ToolbarButton title="Hoàn tác" disabled={disabled || !editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><UndoOutlined /></ToolbarButton>
        <ToolbarButton title="Làm lại" disabled={disabled || !editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><RedoOutlined /></ToolbarButton>
        <span className="company-rich-editor__divider" />
        <ToolbarButton title="In đậm" disabled={disabled} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><BoldOutlined /></ToolbarButton>
        <ToolbarButton title="In nghiêng" disabled={disabled} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicOutlined /></ToolbarButton>
        <ToolbarButton title="Gạch dưới" disabled={disabled} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineOutlined /></ToolbarButton>
        <span className="company-rich-editor__divider" />
        <ToolbarButton title="Danh sách dấu chấm" disabled={disabled} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><UnorderedListOutlined /></ToolbarButton>
        <ToolbarButton title="Danh sách đánh số" disabled={disabled} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><OrderedListOutlined /></ToolbarButton>
        <ToolbarButton title="Giảm cấp danh sách" disabled={disabled || !editor.can().liftListItem('listItem')} onClick={() => editor.chain().focus().liftListItem('listItem').run()}>−</ToolbarButton>
        <ToolbarButton title="Tăng cấp danh sách" disabled={disabled || !editor.can().sinkListItem('listItem')} onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>+</ToolbarButton>
      </div>
      <EditorContent editor={editor} />
      <div className="company-rich-editor__counter" aria-live="polite">{characters.toLocaleString('vi-VN')}/{maxLength.toLocaleString('vi-VN')}</div>
    </div>
  )
}
