import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useConsent } from '@/entities/consent'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useVisualViewportBottomInset } from '@/shared/hooks/use-visual-viewport-bottom-inset'
import AssistantLauncher from './ui/AssistantLauncher'

const AssistantPanel = lazy(() => import('./ui/AssistantPanel'))
const GREETING_KEY = 'procv-assistant-greeting-seen'

function readGreetingSeen() {
  try {
    return window.sessionStorage.getItem(GREETING_KEY) === '1'
  } catch {
    return false
  }
}

function storeGreetingSeen() {
  try {
    window.sessionStorage.setItem(GREETING_KEY, '1')
  } catch {
    // Storage có thể bị chặn; greeting vẫn tự ẩn trong lượt xem hiện tại.
  }
}

export default function CandidateAssistant() {
  const { pathname } = useLocation()
  const { isDecided, isEnabled } = useConsent()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const viewportBottomInset = useVisualViewportBottomInset()
  const [open, setOpen] = useState(false)
  const [greetingVisible, setGreetingVisible] = useState(false)
  const [cookieMetrics, setCookieMetrics] = useState({ height: 0, viewportHeight: 0 })

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    close()
  }, [close, pathname])

  useEffect(() => {
    if (readGreetingSeen()) return undefined
    const showTimer = window.setTimeout(() => {
      setGreetingVisible(true)
      storeGreetingSeen()
    }, 2500)
    const hideTimer = window.setTimeout(() => setGreetingVisible(false), 10500)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [])

  const cookieVisible = isEnabled && !isDecided
  const jobDetailMobile = /^\/viec-lam\/[^/]+\/?$/.test(pathname)

  useEffect(() => {
    if (!cookieVisible) {
      setCookieMetrics({ height: 0, viewportHeight: 0 })
      return undefined
    }

    const banner = document.querySelector('.cookie-consent-banner')
    const update = () => {
      const height = Math.ceil(banner?.getBoundingClientRect().height || 144)
      const viewportHeight = window.innerHeight
      setCookieMetrics((current) => (
        current.height === height && current.viewportHeight === viewportHeight
          ? current
          : { height, viewportHeight }
      ))
    }
    update()
    const observer = banner && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(banner)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [cookieVisible])

  function toggle() {
    setGreetingVisible(false)
    setOpen((current) => !current)
  }

  const bottom = cookieVisible
    ? `${(cookieMetrics.height || 144) + 16}px`
    : jobDetailMobile
      ? `${isMobile ? 96 : 32}px`
      : 'clamp(1.25rem, 3vw, 2rem)'
  const rootStyle = {
    '--assistant-panel-max-height': cookieVisible && cookieMetrics.height
      ? `${Math.max(220, cookieMetrics.viewportHeight - cookieMetrics.height - 164)}px`
      : '540px',
    bottom: `calc(${bottom} + ${viewportBottomInset}px + env(safe-area-inset-bottom, 0px))`,
    position: 'fixed',
    right: 'clamp(1rem, 2vw, 1.5rem)',
    zIndex: 40,
  }

  return (
    <div data-testid="candidate-assistant" style={rootStyle}>
      <div style={{ position: 'relative' }}>
        {open && (
          <Suspense fallback={(
            <div
              aria-label="Đang mở trợ lý"
              style={{
                background: 'white',
                borderRadius: '1rem',
                bottom: 'calc(100% + 12px)',
                boxShadow: '0 20px 25px -5px rgb(15 23 42 / 12%)',
                height: 96,
                position: 'absolute',
                right: 0,
                width: 256,
              }}
            />
          )}>
            <AssistantPanel onClose={close} />
          </Suspense>
        )}
        <AssistantLauncher greetingVisible={greetingVisible} onClick={toggle} open={open} />
      </div>
    </div>
  )
}
