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
import { getIntlLocale, m } from '@/shared/config/i18n'

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

function ProductLinkControl({ disabled, links, onInsert }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover
      trigger="click"
      placement="bottom"
      open={open}
      onOpenChange={(next) => { if (!disabled) setOpen(next) }}
      content={(
        <div className="flex min-w-48 flex-col gap-1 p-1" aria-label={m.ui_rich_insert_product_link()}>
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{m.ui_rich_quick_links()}</p>
          {links.map((item) => (
            <Button
              key={item.href}
              type="text"
              className="!justify-start"
              disabled={disabled}
              onClick={() => {
                onInsert(item)
                setOpen(false)
              }}
            >
              {item.label}
              <span className="ml-2 text-xs text-slate-400">{item.href}</span>
            </Button>
          ))}
        </div>
      )}
    >
      <span>
        <ToolbarButton title={m.ui_rich_insert_product_link()} disabled={disabled} onClick={() => setOpen(true)}>
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold"><LinkOutlined />+</span>
        </ToolbarButton>
      </span>
    </Popover>
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
    <div className="rich-table-insert" aria-label={m.ui_rich_table_options()}>
      <p className="rich-table-insert__title">{m.ui_rich_table_size()}</p>
      <div className="rich-table-insert__fields">
        <div className="rich-table-insert__field">
          <label htmlFor="rich-table-rows">{m.ui_rich_table_rows()}</label>
          <InputNumber id="rich-table-rows" aria-label={m.ui_rich_table_rows()} min={1} max={20} precision={0} value={rows} onChange={(value) => setRows(value || 1)} />
        </div>
        <span aria-hidden="true">×</span>
        <div className="rich-table-insert__field">
          <label htmlFor="rich-table-cols">{m.ui_rich_table_cols()}</label>
          <InputNumber id="rich-table-cols" aria-label={m.ui_rich_table_cols()} min={1} max={20} precision={0} value={cols} onChange={(value) => setCols(value || 1)} />
        </div>
      </div>
      <Checkbox checked={withHeaderRow} onChange={(event) => setWithHeaderRow(event.target.checked)}>{m.ui_rich_table_header_row()}</Checkbox>
      <Button type="primary" block onClick={insert}>{m.ui_rich_insert_table({ rows, cols })}</Button>
      <p className="rich-table-insert__hint">{m.ui_rich_table_hint()}</p>
    </div>
  )

  return (
    <Popover content={content} trigger="click" placement="bottom" open={open} onOpenChange={(next) => { if (!disabled) setOpen(next) }}>
      <span>
        <ToolbarButton title={m.ui_rich_insert_custom_table()} disabled={disabled} onClick={() => setOpen(true)}><TableOutlined /></ToolbarButton>
      </span>
    </Popover>
  )
}

const BLOG_PRODUCT_LINKS = [
  { label: m.ui_rich_link_jobs(), href: '/viec-lam' },
  { label: m.ui_rich_link_cv_templates(), href: '/mau-cv' },
  { label: m.ui_rich_link_help(), href: '/tro-giup' },
]

export default function RichTextEditor({ value = '', onChange, maxLength = 10000, minHeight = 140, placeholder = '', disabled = false, error = false, contentClassName = '', mode = 'basic', onLoadImages, onUploadImage, allowExternalImage = false, acceptedImageTypes, imageUploadHint, linkShortcuts }) {
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
    const href = window.prompt(m.ui_rich_link_prompt(), previous)
    if (href === null) return
    if (!href.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim(), target: '_blank' }).run()
  }

  const productLinks = Array.isArray(linkShortcuts)
    ? linkShortcuts
    : (mode === 'blog' ? BLOG_PRODUCT_LINKS : [])

  const insertProductLink = (item) => {
    if (!item?.href || disabled) return
    const { from, to, empty } = editor.state.selection
    const selected = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
    const label = (selected || item.label || item.href).trim()
    if (empty) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: label,
          marks: [{ type: 'link', attrs: { href: item.href, target: '_blank' } }],
        })
        .run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: item.href, target: '_blank' }).run()
  }

  const imageAttributes = editor.getAttributes('image')
  const updateImage = (attributes) => editor.chain().focus().updateAttributes('image', attributes).run()
  const insertImage = ({ src, alt }) => {
    if (editor.isActive('image')) updateImage({ src, alt })
    else editor.chain().focus().setImage({ src, alt, width: '100%', alignment: 'center' }).run()
  }

  return (
    <div className={`company-rich-editor ${mode === 'blog' ? 'company-rich-editor--blog' : ''} ${error ? 'company-rich-editor--error' : ''}`}>
      <div className="company-rich-editor__toolbar" role="toolbar" aria-label={m.ui_rich_toolbar()}>
        <ToolbarButton title={m.ui_rich_undo()} disabled={disabled || !editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><UndoOutlined /></ToolbarButton>
        <ToolbarButton title={m.ui_rich_redo()} disabled={disabled || !editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><RedoOutlined /></ToolbarButton>
        <span className="company-rich-editor__divider" />
        <ToolbarButton title={m.ui_rich_bold()} disabled={disabled} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><BoldOutlined /></ToolbarButton>
        <ToolbarButton title={m.ui_rich_italic()} disabled={disabled} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicOutlined /></ToolbarButton>
        <ToolbarButton title={m.ui_rich_underline()} disabled={disabled} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineOutlined /></ToolbarButton>
        {mode === 'blog' && (
          <>
            <span className="company-rich-editor__divider" />
            <ToolbarButton title={m.ui_rich_paragraph()} disabled={disabled} active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>P</ToolbarButton>
            <ToolbarButton title={m.ui_rich_heading_2()} disabled={disabled} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
            <ToolbarButton title={m.ui_rich_heading_3()} disabled={disabled} active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
            <ToolbarButton title={m.ui_rich_blockquote()} disabled={disabled} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><FileTextOutlined /></ToolbarButton>
            <ToolbarButton title={m.ui_rich_link()} disabled={disabled} active={editor.isActive('link')} onClick={setLink}><LinkOutlined /></ToolbarButton>
            {productLinks.length > 0 && (
              <ProductLinkControl
                disabled={disabled}
                links={productLinks}
                onInsert={insertProductLink}
              />
            )}
          </>
        )}
        <span className="company-rich-editor__divider" />
        <ToolbarButton title={m.ui_rich_bullet_list()} disabled={disabled} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><UnorderedListOutlined /></ToolbarButton>
        <ToolbarButton title={m.ui_rich_ordered_list()} disabled={disabled} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><OrderedListOutlined /></ToolbarButton>
        <ToolbarButton title={m.ui_rich_outdent()} disabled={disabled || !editor.can().liftListItem('listItem')} onClick={() => editor.chain().focus().liftListItem('listItem').run()}>−</ToolbarButton>
        <ToolbarButton title={m.ui_rich_indent()} disabled={disabled || !editor.can().sinkListItem('listItem')} onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>+</ToolbarButton>
        {mode === 'blog' && (
          <>
            <span className="company-rich-editor__divider" />
            <ToolbarButton title={m.ui_rich_insert_image()} disabled={disabled || (!onUploadImage && !allowExternalImage)} onClick={() => setImageLibraryOpen(true)}><FileImageOutlined /></ToolbarButton>
            <TableInsertControl editor={editor} disabled={disabled} />
          </>
        )}
      </div>
      {mode === 'blog' && editor.isActive('image') && (
        <div className="company-rich-editor__image-toolbar" role="toolbar" aria-label={m.ui_rich_image_toolbar()}>
          <span className="company-rich-editor__image-label">{m.ui_rich_image_size()}</span>
          {['25%', '50%', '75%', '100%'].map((width) => (
            <Button key={width} type={imageAttributes.width === width ? 'primary' : 'default'} size="small" onClick={() => updateImage({ width })}>{width}</Button>
          ))}
          <span className="company-rich-editor__divider" />
          <ToolbarButton title={m.ui_rich_align_left()} active={imageAttributes.alignment === 'left'} onClick={() => updateImage({ alignment: 'left' })}><AlignLeftOutlined /></ToolbarButton>
          <ToolbarButton title={m.ui_rich_align_center()} active={!imageAttributes.alignment || imageAttributes.alignment === 'center'} onClick={() => updateImage({ alignment: 'center' })}><AlignCenterOutlined /></ToolbarButton>
          <ToolbarButton title={m.ui_rich_align_right()} active={imageAttributes.alignment === 'right'} onClick={() => updateImage({ alignment: 'right' })}><AlignRightOutlined /></ToolbarButton>
          <span className="company-rich-editor__divider" />
          <Button size="small" onClick={() => setImageLibraryOpen(true)}>{m.ui_rich_replace_image()}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => editor.chain().focus().deleteSelection().run()}>{m.ui_rich_delete()}</Button>
        </div>
      )}
      {mode === 'blog' && editor.isActive('table') && !editor.isActive('image') && (
        <div className="company-rich-editor__table-toolbar" role="toolbar" aria-label={m.ui_rich_table_toolbar()}>
          <span className="company-rich-editor__context-label">{m.ui_rich_table()}</span>
          <ToolbarButton title={m.ui_rich_add_row_above()} disabled={disabled} onClick={() => editor.chain().focus().addRowBefore().run()}><InsertRowAboveOutlined /></ToolbarButton>
          <ToolbarButton title={m.ui_rich_add_row_below()} disabled={disabled} onClick={() => editor.chain().focus().addRowAfter().run()}><InsertRowBelowOutlined /></ToolbarButton>
          <ToolbarButton title={m.ui_rich_delete_row()} disabled={disabled} onClick={() => editor.chain().focus().deleteRow().run()}><DeleteRowOutlined /></ToolbarButton>
          <span className="company-rich-editor__divider" />
          <ToolbarButton title={m.ui_rich_add_col_left()} disabled={disabled} onClick={() => editor.chain().focus().addColumnBefore().run()}><InsertRowLeftOutlined /></ToolbarButton>
          <ToolbarButton title={m.ui_rich_add_col_right()} disabled={disabled} onClick={() => editor.chain().focus().addColumnAfter().run()}><InsertRowRightOutlined /></ToolbarButton>
          <ToolbarButton title={m.ui_rich_delete_col()} disabled={disabled} onClick={() => editor.chain().focus().deleteColumn().run()}><DeleteColumnOutlined /></ToolbarButton>
          <span className="company-rich-editor__divider" />
          <ToolbarButton title={m.ui_rich_merge_cells()} disabled={disabled || !editor.can().chain().focus().mergeCells().run()} onClick={() => editor.chain().focus().mergeCells().run()}><MergeCellsOutlined /></ToolbarButton>
          <ToolbarButton title={m.ui_rich_split_cell()} disabled={disabled || !editor.can().chain().focus().splitCell().run()} onClick={() => editor.chain().focus().splitCell().run()}><SplitCellsOutlined /></ToolbarButton>
          <ToolbarButton title={m.ui_rich_toggle_header_row()} disabled={disabled} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>TH</ToolbarButton>
          <span className="company-rich-editor__divider" />
          <Button size="small" danger icon={<DeleteOutlined />} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}>{m.ui_rich_delete_table()}</Button>
        </div>
      )}
      <EditorContent editor={editor} />
      <div className="company-rich-editor__counter" aria-live="polite">{characters.toLocaleString(getIntlLocale())}/{maxLength.toLocaleString(getIntlLocale())}</div>
      {mode === 'blog' && (
        <RichTextImageLibrary
          open={imageLibraryOpen}
          onCancel={() => setImageLibraryOpen(false)}
          onInsert={insertImage}
          onLoadImages={onLoadImages}
          onUploadImage={onUploadImage}
          allowExternalImage={allowExternalImage}
          acceptedImageTypes={acceptedImageTypes}
          uploadHint={imageUploadHint}
        />
      )}
    </div>
  )
}
