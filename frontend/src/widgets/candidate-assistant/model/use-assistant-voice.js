import { useCallback, useEffect, useRef, useState } from 'react'
import { PROCV_VOICE_ID } from '@/entities/speech'
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
  const {
    elapsed = 0,
    error = '',
    speak,
    speaking,
    status = 'idle',
    stop,
    unlock,
  } = useSpeak({ voiceId: PROCV_VOICE_ID })
  const [enabled, setEnabled] = useState(storedVoiceEnabled)
  const [activeMessageId, setActiveMessageId] = useState(null)
  // Mốc khởi tạo là tin nhắn cuối lúc mount, tức lời chào đã coi như "đã đọc".
  const spokenIdRef = useRef(messages[messages.length - 1]?.id ?? null)
  const latest = messages[messages.length - 1]
  // Trả ID ngay trong render đầu có response mới để UI không chớp toàn bộ câu
  // trước khi effect bắt đầu phiên đọc.
  const pendingMessageId = latest?.from === 'assistant' && latest.id !== spokenIdRef.current
    ? latest.id
    : activeMessageId

  useEffect(() => {
    if (!latest || latest.id === spokenIdRef.current) return
    spokenIdRef.current = latest.id
    if (latest.from !== 'assistant') return
    setActiveMessageId(latest.id)
    if (!enabled) return
    speak(latest.text)
  }, [enabled, latest, speak])

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

  return {
    activeMessageId: pendingMessageId,
    elapsed,
    enabled,
    error,
    prepare,
    speaking,
    status,
    toggle,
  }
}
