import { UserOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'

const DEFAULT_MESSAGES = [
  { from: 'recruiter', text: 'Chào bạn! AI vừa gợi ý hồ sơ của bạn cho vị trí Frontend Developer.' },
  { from: 'candidate', text: 'Dạ, em rất quan tâm vị trí này ạ!' },
  { from: 'recruiter', text: 'Tuyệt vời. Mình mời bạn phỏng vấn tuần này nhé?' },
  { from: 'candidate', text: 'Vâng, em luôn sẵn sàng. Cảm ơn anh ạ!' },
]

const TYPING_MS = 950
const READ_MS = 900
const RESTART_MS = 3600

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function ChatShowcase({
  messages = DEFAULT_MESSAGES,
  avatarInitials = 'MA',
  headerName = 'Minh Anh',
  headerStatus = 'Nhà tuyển dụng đang hoạt động',
  matchPercentage,
  dark = true,
}) {
  const [count, setCount] = useState(0)
  const [typingSide, setTypingSide] = useState(null)
  const timers = useRef([])

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    
    if (prefersReduced()) {
      setCount(messages.length)
      return undefined
    }

    let cancelled = false
    const schedule = (fn, ms) => timers.current.push(setTimeout(fn, ms))

    function play(i) {
      if (cancelled) return
      if (i >= messages.length) {
        schedule(() => {
          if (cancelled) return
          setCount(0)
          play(0)
        }, RESTART_MS)
        return
      }
      setTypingSide(messages[i].from)
      schedule(() => {
        if (cancelled) return
        setTypingSide(null)
        setCount(i + 1)
        schedule(() => play(i + 1), READ_MS)
      }, TYPING_MS)
    }

    setCount(0)
    schedule(() => play(0), 400)
    
    return () => {
      cancelled = true
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [messages])

  return (
    <div className="w-full max-w-[440px]">
      <style>{`
        @keyframes chatIn { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .chat-in { animation: chatIn 0.34s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes chatDot { 0%,60%,100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        .chat-dot { width: 5px; height: 5px; border-radius: 9999px; background: ${dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,177,79,0.75)'}; animation: chatDot 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .chat-in, .chat-dot { animation: none !important; } }
      `}</style>

      <div
        className={`overflow-hidden rounded-2xl border transition-all duration-300 shadow-xl ${
          dark
            ? 'border-white/10 bg-[#0b3320]/75 shadow-black/30 backdrop-blur-md text-white'
            : 'border-emerald-100 bg-white shadow-emerald-950/5 text-gray-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-2.5 px-4 py-3 ${
            dark ? 'border-b border-white/10 bg-white/[0.03]' : 'border-b border-gray-50 bg-gray-50/50'
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00b14f] to-[#008a3e] text-xs font-bold text-white">
            {avatarInitials}
          </div>
          <div className="min-w-0">
            <p className={`text-[13px] font-semibold leading-tight ${dark ? 'text-white' : 'text-gray-800'}`}>
              {headerName}
            </p>
            <p className={`flex items-center gap-1.5 text-[11px] ${dark ? 'text-green-100/60' : 'text-gray-400'}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
              {headerStatus}
            </p>
          </div>
          {matchPercentage && (
            <span
              className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                dark ? 'bg-[#00b14f]/20 text-[#4ade80]' : 'bg-emerald-50 text-[#00b14f]'
              }`}
            >
              {matchPercentage}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex h-[250px] flex-col justify-end gap-2.5 px-4 py-4 overflow-hidden">
          {messages.slice(0, count).map((m, i) => (
            <Bubble key={`${i}-${m.from}`} from={m.from} text={m.text} dark={dark} />
          ))}
          {typingSide && <TypingBubble side={typingSide} dark={dark} />}
        </div>
      </div>
    </div>
  )
}

function Avatar({ from }) {
  const isCandidate = from === 'candidate'
  return (
    <div
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] text-white ${
        isCandidate ? 'bg-[#00b14f]' : 'bg-gray-400/20'
      }`}
    >
      <UserOutlined className="text-[11px]" />
    </div>
  )
}

function Bubble({ from, text, dark }) {
  const isCandidate = from === 'candidate'
  return (
    <div className={`chat-in flex items-end gap-2 ${isCandidate ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar from={from} />
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug shadow-sm ${
          isCandidate
            ? 'rounded-br-sm bg-[#00b14f] text-white'
            : dark
            ? 'rounded-bl-sm bg-white/12 text-green-50'
            : 'rounded-bl-sm bg-gray-100 text-gray-700'
        }`}
      >
        {text}
      </div>
    </div>
  )
}

function TypingBubble({ side, dark }) {
  const isCandidate = side === 'candidate'
  return (
    <div className={`chat-in flex items-end gap-2 ${isCandidate ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar from={side} />
      <div
        className={`flex items-center gap-1 rounded-2xl px-3.5 py-3 ${
          isCandidate
            ? 'rounded-br-sm bg-[#00b14f]/80'
            : dark
            ? 'rounded-bl-sm bg-white/12'
            : 'rounded-bl-sm bg-gray-100'
        }`}
      >
        <span className="chat-dot" />
        <span className="chat-dot" style={{ animationDelay: '0.18s' }} />
        <span className="chat-dot" style={{ animationDelay: '0.36s' }} />
      </div>
    </div>
  )
}
