import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  DeleteColumnOutlined,
  DeleteOutlined,
  DeleteRowOutlined,
  FileImageOutlined,
  InsertRowAboveOutlined,
  LinkOutlined,
  ItalicOutlined,
  InsertRowBelowOutlined,
  InsertRowLeftOutlined,
  InsertRowRightOutlined,
  MergeCellsOutlined,
  FileTextOutlined,
  OrderedListOutlined,
  RedoOutlined,
  SplitCellsOutlined,
  TableOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import CharacterCount from '@tiptap/extension-character-count'
import { TableKit } from '@tiptap/extension-table'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button, Checkbox, InputNumber, Popover, Tooltip } from 'antd'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import RichTextImageLibrary from './RichTextImageLibrary'
import { RichTextImage } from './rich-text-image'
import './rich-text-editor.css'

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

function TableInsertControl({ editor, disabled }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [withHeaderRow, setWithHeaderRow] = useState(true)

  const insert = () => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow }).run()
    setOpen(false)
  }

  const content = (
    <div className="rich-table-insert" aria-label="Tùy chọn chèn bảng">
      <p className="rich-table-insert__title">Kích thước bảng</p>
      <div className="rich-table-insert__fields">
        <div className="rich-table-insert__field">
          <label htmlFor="rich-table-rows">Số hàng</label>
          <InputNumber id="rich-table-rows" aria-label="Số hàng" min={1} max={20} precision={0} value={rows} onChange={(value) => setRows(value || 1)} />
        </div>
        <span aria-hidden="true">×</span>
        <div className="rich-table-insert__field">
          <label htmlFor="rich-table-cols">Số cột</label>
          <InputNumber id="rich-table-cols" aria-label="Số cột" min={1} max={20} precision={0} value={cols} onChange={(value) => setCols(value || 1)} />
        </div>
      </div>
      <Checkbox checked={withHeaderRow} onChange={(event) => setWithHeaderRow(event.target.checked)}>Hàng đầu là tiêu đề</Checkbox>
      <Button type="primary" block onClick={insert}>Chèn bảng {rows} × {cols}</Button>
      <p className="rich-table-insert__hint">Có thể thêm, xóa hàng/cột sau khi chèn.</p>
    </div>
  )

  return (
    <Popover content={content} trigger="click" placement="bottom" open={open} onOpenChange={(next) => { if (!disabled) setOpen(next) }}>
      <span>
        <ToolbarButton title="Chèn bảng tùy chỉnh" disabled={disabled} onClick={() => setOpen(true)}><TableOutlined /></ToolbarButton>
      </span>
    </Popover>
  )
}

export default function RichTextEditor({ value = '', onChange, maxLength = 10000, minHeight = 140, placeholder = '', disabled = false, error = false, contentClassName = '', mode = 'basic', onLoadImages, onUploadImage, acceptedImageTypes, imageUploadHint }) {
  // `Form.setFieldsValue` có thể chạy trước khi TipTap hoàn tất khởi tạo. Giữ
  // content ban đầu rỗng và đồng bộ ở layout effect để editor luôn lấy đúng
  // giá trị controlled sau khi mở trang sửa tin.
  const hasUserInteraction = useRef(false)
  const [characters, setCharacters] = useState(0)
  const [imageLibraryOpen, setImageLibraryOpen] = useState(false)
  const [, setSelectionVersion] = useState(0)
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
        ...(mode === 'blog' ? { heading: { levels: [2, 3, 4] } } : {}),
      }),
      CharacterCount.configure({ limit: maxLength }),
      ...(mode === 'blog' ? [RichTextImage, TableKit.configure({ table: { resizable: true } })] : []),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: `company-rich-editor__content ${contentClassName}`.trim(),
        'data-placeholder': placeholder,
        style: `min-height: ${minHeight}px`,
      },
      handleDOMEvents: {
        focus: () => {
          hasUserInteraction.current = true
          return false
        },
      },
    },
    // TipTap có thể phát một update rỗng khi khởi tạo. Không để update nội bộ
    // đó ghi đè nội dung vừa được Form nạp cho ba trường rich text.
    onUpdate: ({ editor: activeEditor }) => {
      setCharacters(activeEditor.storage.characterCount.characters())
      if (!hasUserInteraction.current && !activeEditor.isFocused) return
      onChange?.(activeEditor.isEmpty ? '' : activeEditor.getHTML())
    },
    onSelectionUpdate: () => setSelectionVersion((current) => current + 1),
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useLayoutEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value && (value || !editor.isEmpty)) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
    setCharacters(editor.storage.characterCount.characters())
  }, [editor, value])

  if (!editor) return null

  const setLink = () => {
    const previous = editor.getAttributes('link').href || ''
    const href = window.prompt('Đường dẫn liên kết', previous)
    if (href === null) return
    if (!href.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim(), target: '_blank' }).run()
  }

  const imageAttributes = editor.getAttributes('image')
  const updateImage = (attributes) => editor.chain().focus().updateAttributes('image', attributes).run()
  const insertImage = ({ src, alt }) => {
    if (editor.isActive('image')) updateImage({ src, alt })
    else editor.chain().focus().setImage({ src, alt, width: '100%', alignment: 'center' }).run()
  }

  return (
    <div className={`company-rich-editor ${mode === 'blog' ? 'company-rich-editor--blog' : ''} ${error ? 'company-rich-editor--error' : ''}`}>
      <div className="company-rich-editor__toolbar" role="toolbar" aria-label="Công cụ định dạng văn bản">
        <ToolbarButton title="Hoàn tác" disabled={disabled || !editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><UndoOutlined /></ToolbarButton>
        <ToolbarButton title="Làm lại" disabled={disabled || !editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><RedoOutlined /></ToolbarButton>
        <span className="company-rich-editor__divider" />
        <ToolbarButton title="In đậm" disabled={disabled} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><BoldOutlined /></ToolbarButton>
        <ToolbarButton title="In nghiêng" disabled={disabled} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicOutlined /></ToolbarButton>
        <ToolbarButton title="Gạch dưới" disabled={disabled} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineOutlined /></ToolbarButton>
        {mode === 'blog' && (
          <>
            <span className="company-rich-editor__divider" />
            <ToolbarButton title="Văn bản thường" disabled={disabled} active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>P</ToolbarButton>
            <ToolbarButton title="Tiêu đề cấp 2" disabled={disabled} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
            <ToolbarButton title="Tiêu đề cấp 3" disabled={disabled} active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
            <ToolbarButton title="Trích dẫn" disabled={disabled} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><FileTextOutlined /></ToolbarButton>
            <ToolbarButton title="Liên kết" disabled={disabled} active={editor.isActive('link')} onClick={setLink}><LinkOutlined /></ToolbarButton>
          </>
        )}
        <span className="company-rich-editor__divider" />
        <ToolbarButton title="Danh sách dấu chấm" disabled={disabled} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><UnorderedListOutlined /></ToolbarButton>
        <ToolbarButton title="Danh sách đánh số" disabled={disabled} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><OrderedListOutlined /></ToolbarButton>
        <ToolbarButton title="Giảm cấp danh sách" disabled={disabled || !editor.can().liftListItem('listItem')} onClick={() => editor.chain().focus().liftListItem('listItem').run()}>−</ToolbarButton>
        <ToolbarButton title="Tăng cấp danh sách" disabled={disabled || !editor.can().sinkListItem('listItem')} onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>+</ToolbarButton>
        {mode === 'blog' && (
          <>
            <span className="company-rich-editor__divider" />
            <ToolbarButton title="Chèn ảnh từ kho" disabled={disabled || !onUploadImage} onClick={() => setImageLibraryOpen(true)}><FileImageOutlined /></ToolbarButton>
            <TableInsertControl editor={editor} disabled={disabled} />
          </>
        )}
      </div>
      {mode === 'blog' && editor.isActive('image') && (
        <div className="company-rich-editor__image-toolbar" role="toolbar" aria-label="Tùy chỉnh hình ảnh đang chọn">
          <span className="company-rich-editor__image-label">Kích thước</span>
          {['25%', '50%', '75%', '100%'].map((width) => (
            <Button key={width} type={imageAttributes.width === width ? 'primary' : 'default'} size="small" onClick={() => updateImage({ width })}>{width}</Button>
          ))}
          <span className="company-rich-editor__divider" />
          <ToolbarButton title="Căn trái" active={imageAttributes.alignment === 'left'} onClick={() => updateImage({ alignment: 'left' })}><AlignLeftOutlined /></ToolbarButton>
          <ToolbarButton title="Căn giữa" active={!imageAttributes.alignment || imageAttributes.alignment === 'center'} onClick={() => updateImage({ alignment: 'center' })}><AlignCenterOutlined /></ToolbarButton>
          <ToolbarButton title="Căn phải" active={imageAttributes.alignment === 'right'} onClick={() => updateImage({ alignment: 'right' })}><AlignRightOutlined /></ToolbarButton>
          <span className="company-rich-editor__divider" />
          <Button size="small" onClick={() => setImageLibraryOpen(true)}>Thay ảnh</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => editor.chain().focus().deleteSelection().run()}>Xóa</Button>
        </div>
      )}
      {mode === 'blog' && editor.isActive('table') && !editor.isActive('image') && (
        <div className="company-rich-editor__table-toolbar" role="toolbar" aria-label="Tùy chỉnh bảng đang chọn">
          <span className="company-rich-editor__context-label">Bảng</span>
          <ToolbarButton title="Thêm hàng phía trên" disabled={disabled} onClick={() => editor.chain().focus().addRowBefore().run()}><InsertRowAboveOutlined /></ToolbarButton>
          <ToolbarButton title="Thêm hàng phía dưới" disabled={disabled} onClick={() => editor.chain().focus().addRowAfter().run()}><InsertRowBelowOutlined /></ToolbarButton>
          <ToolbarButton title="Xóa hàng hiện tại" disabled={disabled} onClick={() => editor.chain().focus().deleteRow().run()}><DeleteRowOutlined /></ToolbarButton>
          <span className="company-rich-editor__divider" />
          <ToolbarButton title="Thêm cột bên trái" disabled={disabled} onClick={() => editor.chain().focus().addColumnBefore().run()}><InsertRowLeftOutlined /></ToolbarButton>
          <ToolbarButton title="Thêm cột bên phải" disabled={disabled} onClick={() => editor.chain().focus().addColumnAfter().run()}><InsertRowRightOutlined /></ToolbarButton>
          <ToolbarButton title="Xóa cột hiện tại" disabled={disabled} onClick={() => editor.chain().focus().deleteColumn().run()}><DeleteColumnOutlined /></ToolbarButton>
          <span className="company-rich-editor__divider" />
          <ToolbarButton title="Gộp các ô đã chọn" disabled={disabled || !editor.can().chain().focus().mergeCells().run()} onClick={() => editor.chain().focus().mergeCells().run()}><MergeCellsOutlined /></ToolbarButton>
          <ToolbarButton title="Tách ô hiện tại" disabled={disabled || !editor.can().chain().focus().splitCell().run()} onClick={() => editor.chain().focus().splitCell().run()}><SplitCellsOutlined /></ToolbarButton>
          <ToolbarButton title="Bật hoặc tắt hàng tiêu đề" disabled={disabled} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>TH</ToolbarButton>
          <span className="company-rich-editor__divider" />
          <Button size="small" danger icon={<DeleteOutlined />} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}>Xóa bảng</Button>
        </div>
      )}
      <EditorContent editor={editor} />
      <div className="company-rich-editor__counter" aria-live="polite">{characters.toLocaleString('vi-VN')}/{maxLength.toLocaleString('vi-VN')}</div>
      {mode === 'blog' && (
        <RichTextImageLibrary
          open={imageLibraryOpen}
          onCancel={() => setImageLibraryOpen(false)}
          onInsert={insertImage}
          onLoadImages={onLoadImages}
          onUploadImage={onUploadImage}
          acceptedImageTypes={acceptedImageTypes}
          uploadHint={imageUploadHint}
        />
      )}
    </div>
  )
}
