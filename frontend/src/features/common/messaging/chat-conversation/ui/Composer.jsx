import { PaperClipOutlined, PlusOutlined, SendOutlined, SmileOutlined } from '@ant-design/icons'
import { lazy, Suspense, useRef, useState } from 'react'
import { lockedReasonText, useSendMessage } from '@/entities/messaging/conversation'
import { useSiteSettings } from '@/entities/system/site-settings'
import { sendRealtime } from '@/shared/api/realtime-socket'
import { m } from '@/shared/config/i18n'
import { message as toast } from '@/shared/lib/toast'
import { IconButton, MenuList, Popover } from '@/shared/ui/connect-kit'
import { shouldSendTyping } from '../model/realtime-sync'

const EmojiPicker = lazy(() => import('./EmojiPicker'))

const MAX_TEXT_LENGTH = 2000
// Năm dòng 20px + đệm trên/dưới của ô soạn.
const MAX_TEXTAREA_PX = 116
const ACCEPTED_FILES = '.pdf,.docx,.png,.jpg,.jpeg,.webp'
const ACCEPTED_EXTENSIONS = new Set(ACCEPTED_FILES.split(','))
const DEFAULT_ATTACHMENT_MB = 10

function autosize(element) {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_PX)}px`
}

/**
 * Message box: Enter sends, Shift+Enter breaks the line (IME composition is
 * left alone), emoji panel loads on first open, one "+" menu holds the portal
 * attach items and "send a file". A locked conversation shows one line instead.
 */
export default function Composer({ portal, conversation, attachItems = [] }) {
  const conversationId = conversation.public_id
  const { send } = useSendMessage(portal, conversationId)
  const { settings } = useSiteSettings()
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const textareaRef = useRef(null)
  const fileRef = useRef(null)
  const typingSentRef = useRef(0)
  const maxMb = Number(settings.connect_attachment_max_mb) || DEFAULT_ATTACHMENT_MB
  const remaining = conversation.candidate_limit_remaining

  if (!conversation.can_send || remaining === 0) {
    return (
      <p className="pc-composer pc-composer--locked" role="status">
        {conversation.can_send ? m.connect_limit_reached() : lockedReasonText(conversation.locked_reason)}
      </p>
    )
  }

  const submit = () => {
    const body = text.trim()
    if (!body) return
    if (body.length > MAX_TEXT_LENGTH) {
      toast.error(m.connect_text_too_long({ max: MAX_TEXT_LENGTH }))
      return
    }
    setText('')
    window.requestAnimationFrame(() => autosize(textareaRef.current))
    send({ kind: 'text', body })
  }

  const handleChange = (event) => {
    setText(event.target.value)
    autosize(event.target)
    const now = Date.now()
    if (event.target.value && shouldSendTyping(typingSentRef.current, now)) {
      typingSentRef.current = now
      sendRealtime({ type: 'typing', conversation: conversationId })
    }
  }

  const insertEmoji = (emoji) => {
    const element = textareaRef.current
    const start = element?.selectionStart ?? text.length
    const end = element?.selectionEnd ?? text.length
    setText(`${text.slice(0, start)}${emoji}${text.slice(end)}`)
    window.requestAnimationFrame(() => {
      if (!element) return
      element.focus()
      element.setSelectionRange(start + emoji.length, start + emoji.length)
      autosize(element)
    })
  }

  const handleFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      toast.error(m.connect_file_type_invalid())
      return
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(m.connect_file_too_large({ max: maxMb }))
      return
    }
    send({ file })
  }

  const menuItems = [
    ...attachItems.map(({ key, icon, label, disabled }) => ({ key, icon, label, disabled })),
    { key: 'file', icon: <PaperClipOutlined />, label: m.connect_attach_file() },
  ]
  const handleMenu = ({ key }) => {
    setMenuOpen(false)
    if (key === 'file') fileRef.current?.click()
    else attachItems.find((item) => item.key === key)?.onClick?.()
  }

  return (
    <div className="pc-composer">
      {remaining > 0 && <p className="pc-composer__hint">{m.connect_limit_remaining({ count: remaining })}</p>}
      <div className="pc-composer__row">
        <Popover
          open={menuOpen}
          onOpenChange={setMenuOpen}
          label={m.connect_attach_label()}
          trigger={({ open, toggle }) => (
            <IconButton label={m.connect_attach_label()} aria-expanded={open} aria-haspopup="menu" onClick={toggle}><PlusOutlined /></IconButton>
          )}
        >
          <MenuList items={menuItems} onSelect={handleMenu} />
        </Popover>
        <Popover
          open={emojiOpen}
          onOpenChange={setEmojiOpen}
          label={m.connect_emoji_label()}
          trigger={({ open, toggle }) => (
            <IconButton label={m.connect_emoji_label()} aria-expanded={open} onClick={toggle}><SmileOutlined /></IconButton>
          )}
        >
          <Suspense fallback={<div className="pc-emoji pc-emoji--loading" />}>
            <EmojiPicker onPick={insertEmoji} />
          </Suspense>
        </Popover>
        <input ref={fileRef} type="file" accept={ACCEPTED_FILES} hidden onChange={handleFile} />
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          maxLength={MAX_TEXT_LENGTH + 200}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder={m.connect_composer_placeholder()}
          aria-label={m.connect_composer_placeholder()}
          className="pc-composer__input"
        />
        <IconButton label={m.connect_send()} disabled={!text.trim()} onClick={submit} className="pc-composer__send">
          <SendOutlined />
        </IconButton>
      </div>
    </div>
  )
}
