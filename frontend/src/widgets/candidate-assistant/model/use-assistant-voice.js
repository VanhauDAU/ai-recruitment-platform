import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpeak } from '@/features/speak-text'

const VOICE_STORAGE_KEY = 'procv_assistant_voice_v1'

function storedVoiceEnabled() {
  try {
    return window.localStorage.getItem(VOICE_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

function storeVoiceEnabled(enabled) {
  try {
    window.localStorage.setItem(VOICE_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Storage bị chặn thì chỉ mất lựa chọn cho lượt sau, không ảnh hưởng phát.
  }
}

/**
 * Đọc to câu trả lời của trợ lý.
 *
 * Chỉ đọc câu trả lời cho tin nhắn người dùng vừa gửi. Lời chào lúc mở panel
 * không được đọc: panel lazy nên lúc nó mount thì cử chỉ mở đã kết thúc, trình
 * duyệt sẽ chặn autoplay — và tự nhiên phát tiếng khi người dùng chưa hỏi gì
 * cũng là hành vi gây khó chịu.
 */
export function useAssistantVoice(messages) {
  const { speak, speaking, stop, unlock } = useSpeak()
  const [enabled, setEnabled] = useState(storedVoiceEnabled)
  // Mốc khởi tạo là tin nhắn cuối lúc mount, tức lời chào đã coi như "đã đọc".
  const spokenIdRef = useRef(messages[messages.length - 1]?.id ?? null)

  useEffect(() => {
    const latest = messages[messages.length - 1]
    if (!latest || latest.id === spokenIdRef.current) return
    spokenIdRef.current = latest.id
    if (latest.from !== 'assistant' || !enabled) return
    speak(latest.text)
  }, [enabled, messages, speak])

  /** Mở Web Audio ngay trong cử chỉ gửi, trước khi câu trả lời kịp về. */
  const prepare = useCallback(() => {
    if (enabled) unlock()
  }, [enabled, unlock])

  const toggle = useCallback(() => {
    const next = !enabled
    setEnabled(next)
    storeVoiceEnabled(next)
    if (next) unlock()
    else stop()
  }, [enabled, stop, unlock])

  return { enabled, prepare, speaking, toggle }
}
