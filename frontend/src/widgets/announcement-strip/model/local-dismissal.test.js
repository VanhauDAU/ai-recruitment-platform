import { beforeEach, describe, expect, it } from 'vitest'
import { readLocalDismissal, storeLocalDismissal } from './local-dismissal'

const ITEM = { id: 'ann_guest', dismiss: { version: 2 } }

describe('guest announcement state', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('persists close across browser sessions by dismissal version', () => {
    storeLocalDismissal(ITEM, Number.POSITIVE_INFINITY)

    expect(window.localStorage.getItem('announcement-strip:ann_guest:v2')).toBe('closed')
    expect(readLocalDismissal(ITEM)).toBe(Number.POSITIVE_INFINITY)
  })

  it('reads the P2 session fallback during the compatibility window', () => {
    const hiddenUntil = Date.now() + 60_000
    window.sessionStorage.setItem(
      'announcement-strip:ann_guest:v2',
      String(hiddenUntil),
    )

    expect(readLocalDismissal(ITEM)).toBe(hiddenUntil)
  })
})
