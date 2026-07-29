import { CloseOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ANNOUNCEMENT_ANIMATIONS,
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_KINDS,
  announcementAudienceKey,
} from '@/entities/announcement'
import { useConsent } from '@/entities/consent'
import { useSession } from '@/entities/session'
import { flushAnnouncementEvents } from '../model/announcement-events'
import { isAnnouncementSurfaceEnabled } from '../model/announcement-rollout'
import {
  readLocalDismissal,
  storeLocalDismissal,
} from '../model/local-dismissal'
import { resolveAnnouncementQueue } from '../model/priority-resolver'
import { buildSystemAnnouncements } from '../model/system-announcements'
import { useAnnouncementTracking } from '../model/use-announcement-tracking'
import { useAnnouncementFeed } from '../model/use-announcement-feed'
import { useReducedMotion } from '../model/use-reduced-motion'
import AnnouncementCta from './AnnouncementCta'
import AnnouncementIcon from './AnnouncementIcon'
import AnnouncementStripBoundary from './AnnouncementStripBoundary'
import './announcement-strip.css'

function AnnouncementStripRuntime({
  employerProfile,
  employerProfileReady = false,
  locale = 'vi',
  path,
  stickyOffset = '0px',
  surface,
  user,
  verificationPath,
}) {
  const rootRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pageHidden, setPageHidden] = useState(document.visibilityState === 'hidden')
  const [dismissals, setDismissals] = useState({})
  const [dismissalClock, setDismissalClock] = useState(Date.now())
  const [manualAnnouncement, setManualAnnouncement] = useState('')
  const reducedMotion = useReducedMotion()
  const { consent, status: consentStatus } = useConsent()
  const analyticsEnabled = consentStatus === 'ready' && consent.analytics
  const audienceKey = announcementAudienceKey(user)
  const { feed, refetchFeed } = useAnnouncementFeed({
    audienceKey,
    locale,
    path,
    surface,
  })
  const systemItems = useMemo(() => buildSystemAnnouncements({
    employerProfile,
    employerProfileReady,
    locale,
    surface,
    user,
    verificationPath,
  }), [
    employerProfile,
    employerProfileReady,
    locale,
    surface,
    user,
    verificationPath,
  ])
  const queue = useMemo(
    () => resolveAnnouncementQueue([
      ...systemItems,
      ...(feed?.items || []),
    ]),
    [feed?.items, systemItems],
  )
  const queueSignature = queue.map((item) => item.id).join('|')

  useEffect(() => {
    setDismissals((current) => {
      const next = { ...current }
      for (const item of queue) {
        if (!(item.id in next)) next[item.id] = readLocalDismissal(item)
      }
      return next
    })
  }, [queue])

  const visibleQueue = queue.filter((item) => (dismissals[item.id] || 0) <= dismissalClock)
  const active = visibleQueue[activeIndex % Math.max(visibleQueue.length, 1)]
  const paused = hovered || focused || pageHidden || reducedMotion
  const { persistDismissal, trackCta } = useAnnouncementTracking({
    active,
    analyticsEnabled,
    surface,
    user,
  })

  useEffect(() => {
    setActiveIndex(0)
  }, [queueSignature])

  useEffect(() => {
    const upcoming = Object.values(dismissals)
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((left, right) => left - right)[0]
    if (!upcoming) return undefined
    const timer = window.setTimeout(
      () => setDismissalClock(Date.now()),
      Math.min(upcoming - Date.now() + 50, 2_147_000_000),
    )
    return () => window.clearTimeout(timer)
  }, [dismissals, dismissalClock])

  useEffect(() => {
    if (paused || visibleQueue.length < 2 || !active) return undefined
    const timer = window.setInterval(
      () => {
        setManualAnnouncement('')
        setActiveIndex((current) => (current + 1) % visibleQueue.length)
      },
      active.displaySeconds * 1000,
    )
    return () => window.clearInterval(timer)
  }, [active, paused, visibleQueue.length])

  useEffect(() => {
    const transitionAt = Date.parse(feed?.nextTransitionAt)
    if (!Number.isFinite(transitionAt)) return undefined
    const timer = window.setTimeout(
      () => refetchFeed(),
      Math.min(Math.max(transitionAt - Date.now() + 250, 250), 2_147_000_000),
    )
    return () => window.clearTimeout(timer)
  }, [feed?.nextTransitionAt, refetchFeed])

  useEffect(() => {
    const update = () => {
      const hidden = document.visibilityState === 'hidden'
      setPageHidden(hidden)
      if (hidden) flushAnnouncementEvents()
      if (!hidden) refetchFeed()
    }
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [refetchFeed])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refetchFeed()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [refetchFeed])

  useLayoutEffect(() => {
    const element = rootRef.current
    const parent = element?.parentElement
    if (!element || !parent) return undefined
    const update = () => {
      parent.style.setProperty(
        '--announcement-strip-height',
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
      )
    }
    update()
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(update)
    observer?.observe(element)
    return () => {
      observer?.disconnect()
      parent.style.removeProperty('--announcement-strip-height')
    }
  }, [active?.id])

  if (!active) return null

  const animation = reducedMotion
    ? ANNOUNCEMENT_ANIMATIONS.STATIC
    : active.animation
  const dismissible = active.dismiss?.mode !== ANNOUNCEMENT_DISMISS_MODES.LOCKED

  function dismissActive() {
    if (!dismissible) return
    const remainingQueue = visibleQueue.filter((item) => item.id !== active.id)
    const nextIndex = remainingQueue.length ? activeIndex % remainingQueue.length : 0
    const hiddenUntil = active.dismiss.mode === ANNOUNCEMENT_DISMISS_MODES.SNOOZE
      ? Date.now() + active.dismiss.snoozeSeconds * 1000
      : Number.POSITIVE_INFINITY
    storeLocalDismissal(active, hiddenUntil)
    setDismissals((current) => ({ ...current, [active.id]: hiddenUntil }))
    setDismissalClock(Date.now())
    setActiveIndex(nextIndex)
    setManualAnnouncement(remainingQueue[nextIndex]?.message || '')
    persistDismissal()
  }

  function handleBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
  }

  function moveManually(delta) {
    const nextIndex = (
      activeIndex + delta + visibleQueue.length
    ) % visibleQueue.length
    setActiveIndex(nextIndex)
    setManualAnnouncement(visibleQueue[nextIndex].message)
  }

  return (
    <section
      ref={rootRef}
      className={`announcement-strip announcement-strip--${active.kind}`}
      style={{
        '--announcement-motion-period': `${active.displaySeconds}s`,
        '--announcement-motion-play-state': paused ? 'paused' : 'running',
        '--announcement-strip-sticky-top': stickyOffset,
      }}
      data-announcement-count={visibleQueue.length}
      data-announcement-surface={surface}
      data-announcement-source={active.source}
      data-announcement-remote-enabled={feed?.remoteEnabled ? 'true' : 'false'}
      aria-label="Thông báo hệ thống"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={handleBlur}
    >
      <div className="announcement-strip__inner">
        <div
          key={`${active.id}:${activeIndex}`}
          className={[
            'announcement-strip__content',
            `announcement-strip__item--${animation}`,
            visibleQueue.length === 1 ? 'announcement-strip__item--single' : '',
          ].filter(Boolean).join(' ')}
          role={active.kind === ANNOUNCEMENT_KINDS.CRITICAL ? 'alert' : undefined}
          aria-live={active.kind === ANNOUNCEMENT_KINDS.CRITICAL ? 'assertive' : undefined}
          aria-atomic="true"
        >
          <span className="announcement-strip__icon" aria-hidden>
            <AnnouncementIcon name={active.icon} />
          </span>
          {active.badge && <span className="announcement-strip__badge">{active.badge}</span>}
          <span className="announcement-strip__message">{active.message}</span>
          <AnnouncementCta
            cta={active.cta}
            onActivate={trackCta}
          />
        </div>
        <div className="announcement-strip__controls">
          {visibleQueue.length > 1 && (
            <>
              <button
                type="button"
                className="announcement-strip__button"
                aria-label="Thông báo trước"
                onClick={() => moveManually(-1)}
              >
                <LeftOutlined />
              </button>
              <span className="announcement-strip__position" aria-hidden>
                {`${(activeIndex % visibleQueue.length) + 1}/${visibleQueue.length}`}
              </span>
              <button
                type="button"
                className="announcement-strip__button"
                aria-label="Thông báo tiếp theo"
                onClick={() => moveManually(1)}
              >
                <RightOutlined />
              </button>
            </>
          )}
          {dismissible && (
            <button
              type="button"
              className="announcement-strip__button"
              aria-label={active.dismiss.mode === ANNOUNCEMENT_DISMISS_MODES.SNOOZE
                ? 'Tạm ẩn thông báo'
                : 'Đóng thông báo'}
              onClick={dismissActive}
            >
              <CloseOutlined />
            </button>
          )}
        </div>
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {manualAnnouncement}
        </span>
      </div>
    </section>
  )
}

function AnnouncementStripSessionGate(props) {
  const { loading, user } = useSession()
  if (loading) return null
  return <AnnouncementStripRuntime {...props} user={user} />
}

export default function AnnouncementStrip({
  enabled,
  legacy = null,
  surface,
  ...props
}) {
  const rolloutEnabled = enabled ?? isAnnouncementSurfaceEnabled(surface)
  if (!rolloutEnabled) return legacy
  return (
    <AnnouncementStripBoundary
      fallback={legacy}
      surface={surface}
    >
      <AnnouncementStripSessionGate {...props} surface={surface} />
    </AnnouncementStripBoundary>
  )
}
