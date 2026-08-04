import { useCallback, useEffect, useRef, useState } from 'react'
import { ASSISTANT_SCRIPT, DEFAULT_REPLY, INITIAL_MESSAGE } from './assistant-script'

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .trim()
}

export function findAssistantReply(input) {
  const normalized = normalize(input)
  return ASSISTANT_SCRIPT.find((entry) => (
    entry.match instanceof RegExp
      ? entry.match.test(normalized)
      : entry.match.some((keyword) => normalized.includes(keyword))
  )) || DEFAULT_REPLY
}

export function useAssistantScript() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [typing, setTyping] = useState(false)
  const [emotion, setEmotion] = useState('happy')
  const timers = useRef([])
  const sequence = useRef(0)

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
  }, [])

  const sendMessage = useCallback((input) => {
    const text = input.trim()
    if (!text || typing) return false

    sequence.current += 1
    const requestId = sequence.current
    const response = findAssistantReply(text)
    setMessages((current) => [...current, { id: `user-${requestId}`, from: 'user', text }])
    setTyping(true)
    setEmotion('thinking')

    const delay = Math.min(1100, Math.max(700, response.reply.length * 9))
    const timer = window.setTimeout(() => {
      setMessages((current) => [...current, {
        id: `assistant-${requestId}`,
        from: 'assistant',
        text: response.reply,
        actions: response.actions,
        progressive: true,
      }])
      setEmotion(response.emotion)
      setTyping(false)
      timers.current = timers.current.filter((item) => item !== timer)
    }, delay)
    timers.current.push(timer)
    return true
  }, [typing])

  return { emotion, messages, sendMessage, typing }
}
