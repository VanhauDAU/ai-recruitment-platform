import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ info: vi.fn() }))
vi.mock('./toast', () => ({ message: { info: mocks.info } }))

async function load() {
  vi.resetModules()
  return import('./incoming-notice')
}

describe('incoming notice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    mocks.info.mockReset()
  })

  afterEach(() => vi.useRealTimers())

  it('rings with the incoming sound and links only to in-app paths', async () => {
    const { announceNotice } = await load()
    const onOpen = vi.fn()
    const shown = announceNotice({ id: 'eno_1', title: 'Có hồ sơ mới', path: '/tuyendung/app/ho-so-ung-tuyen', onOpen })
    await vi.advanceTimersByTimeAsync(100)

    expect(await shown).toBe(true)
    const [title, options] = mocks.info.mock.calls[0]
    expect(title).toBe('Có hồ sơ mới')
    expect(options.className).toBe('app-toast--sound-incoming')
    options.action.onClick()
    expect(onOpen).toHaveBeenCalledWith('/tuyendung/app/ho-so-ung-tuyen')

    announceNotice({ id: 'eno_2', title: 'x', path: '//evil.example', onOpen })
    await vi.advanceTimersByTimeAsync(100)
    expect(mocks.info.mock.calls[1][1].action).toBeUndefined()
  })

  it('uses the sound the caller names', async () => {
    const { announceNotice } = await load()
    announceNotice({ id: 'msg_1', title: 'Tin nhắn mới', sound: 'message' })
    await vi.advanceTimersByTimeAsync(100)

    expect(mocks.info.mock.calls[0][1].className).toBe('app-toast--sound-message')
  })

  it('stays silent after the user mutes notifications', async () => {
    const { announceNotice, setNotificationSoundOn } = await load()
    const { isSoundOn } = await import('./sound-effects')
    setNotificationSoundOn(false)
    expect(isSoundOn()).toBe(false)

    announceNotice({ id: 'cno_1', title: 'Kết quả ứng tuyển' })
    await vi.advanceTimersByTimeAsync(100)

    expect(mocks.info.mock.calls[0][1].className).toBe('app-toast--silent')
  })

  it('lets only one tab announce the same notice', async () => {
    const { claimNotice } = await load()
    localStorage.setItem('procv:notice-claim:cno_9', 'another-tab')

    const claimed = claimNotice('cno_9')
    await vi.advanceTimersByTimeAsync(500)

    expect(await claimed).toBe(false)
  })
})
