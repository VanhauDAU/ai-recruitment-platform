import { CloseOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { ProcvMascot } from '@/shared/ui/mascot'

export default function AssistantLauncher({ greetingVisible, onClick, open }) {
  const [hovered, setHovered] = useState(false)
  const launcherSize = 'clamp(56px, 10vw, 60px)'

  return (
    <div style={{ position: 'relative' }}>
      {greetingVisible && !open && (
        <div
          role="status"
          style={{
            background: 'white',
            border: '1px solid rgb(209 250 229)',
            borderRadius: '1rem 1rem 0.125rem 1rem',
            bottom: 'calc(100% + 12px)',
            boxShadow: '0 20px 25px -5px rgb(2 44 34 / 10%)',
            color: 'rgb(51 65 85)',
            fontSize: 14,
            fontWeight: 600,
            lineHeight: '1.25rem',
            padding: '0.75rem 1rem',
            position: 'absolute',
            right: 0,
            width: 240,
          }}
        >
          Chào bạn! Mình là trợ lý ProCV 👋
        </div>
      )}
      <button
        type="button"
        aria-controls="candidate-assistant-panel"
        aria-expanded={open}
        aria-label={open ? 'Đóng trợ lý ProCV' : 'Mở trợ lý ProCV'}
        onBlur={() => setHovered(false)}
        onClick={onClick}
        onFocus={() => setHovered(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          alignItems: 'center',
          background: 'white',
          border: `1px solid ${hovered ? 'var(--brand-primary)' : 'rgb(110 231 183)'}`,
          borderRadius: '9999px',
          boxShadow: '0 20px 25px -5px rgb(2 44 34 / 15%)',
          cursor: 'pointer',
          display: 'grid',
          height: launcherSize,
          justifyItems: 'center',
          overflow: 'hidden',
          transform: hovered ? 'translateY(-2px)' : undefined,
          transition: '150ms ease',
          width: launcherSize,
        }}
      >
        {open
          ? <CloseOutlined style={{ color: 'var(--brand-primary)', fontSize: 20 }} />
          : <ProcvMascot size={56} pose={hovered ? 'wave' : 'neutral'} float blink shadow="floating" />}
      </button>
      {!open && (
        <span
          aria-hidden="true"
          style={{
            background: 'rgb(52 211 153)',
            border: '2px solid white',
            borderRadius: '9999px',
            boxShadow: '0 1px 2px rgb(0 0 0 / 5%)',
            height: 14,
            position: 'absolute',
            right: 0,
            top: 0,
            width: 14,
          }}
        />
      )}
    </div>
  )
}
