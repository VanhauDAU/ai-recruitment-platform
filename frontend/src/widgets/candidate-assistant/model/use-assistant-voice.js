import { useCallback, useEffect, useState } from 'react'
import { useSpeak } from '@/features/speak-text'

/** Click-to-listen controller: never starts audio when a message arrives. */
export function useAssistantVoice(available) {
  const {
    speak,
    speaking,
    status = 'idle',
    stop,
  } = useSpeak({ surface: 'chatbot' })
  const [activeMessageId, setActiveMessageId] = useState(null)

  useEffect(() => {
    if (available) return
    stop()
    setActiveMessageId(null)
  }, [available, stop])

  const toggleMessage = useCallback((messageId, text) => {
    if (!available || !text) return
    if (activeMessageId === messageId && speaking) {
      stop()
      return
    }
    setActiveMessageId(messageId)
    speak(text)
  }, [activeMessageId, available, speak, speaking, stop])

  return {
    activeMessageId,
    available,
    speaking,
    status,
    toggleMessage,
  }
}
