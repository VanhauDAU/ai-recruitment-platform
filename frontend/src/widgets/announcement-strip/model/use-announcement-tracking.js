import { useEffect } from 'react'
import {
  ANNOUNCEMENT_DISMISS_MODES,
  setAnnouncementState,
} from '@/entities/announcement'
import { queueAnnouncementEvent } from './announcement-events'

export function useAnnouncementTracking({
  active,
  analyticsEnabled,
  surface,
  user,
}) {
  useEffect(() => {
    if (active && analyticsEnabled) {
      queueAnnouncementEvent(active, surface, 'impression')
    }
  }, [active, analyticsEnabled, surface])

  function track(event) {
    if (analyticsEnabled) queueAnnouncementEvent(active, surface, event)
  }

  function persistDismissal() {
    if (active.source === 'remote' && user) {
      void setAnnouncementState(active.id, {
        revision: active.revision,
        dismissal_version: active.dismiss.version,
        action: active.dismiss.mode === ANNOUNCEMENT_DISMISS_MODES.SNOOZE
          ? 'snooze'
          : 'dismiss',
      }).catch(() => {
        // Local state keeps the interaction responsive when persistence fails.
      })
    }
    track('dismiss')
  }

  return {
    persistDismissal,
    trackCta: analyticsEnabled ? () => track('click') : undefined,
  }
}
