import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('./client', () => ({
  default: { post: mocks.post, defaults: { baseURL: '/api' } },
}))

class FakeSocket {
  static instances = []

  constructor(url) {
    this.url = url
    this.readyState = 0
    this.sent = []
    FakeSocket.instances.push(this)
  }

  send(data) { this.sent.push(data) }

  close(code = 1000) {
    this.readyState = 3
    this.onclose?.({ code })
  }

  open() {
    this.readyState = 1
    this.onopen?.()
    this.message({ type: 'ready' })
  }

  message(payload) { this.onmessage?.({ data: JSON.stringify(payload) }) }
}

async function loadSocket() {
  vi.resetModules()
  return import('./realtime-socket')
}

const flush = () => vi.advanceTimersByTimeAsync(0)

describe('realtime socket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.instances = []
    vi.stubGlobal('WebSocket', FakeSocket)
    mocks.post.mockReset().mockResolvedValue({ data: { ticket: 'one-time' } })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('builds the socket URL from the API base, never carrying a token', async () => {
    const { socketUrl } = await loadSocket()
    const page = new URL('https://procv.site/tuyendung/app')
    expect(socketUrl('/api', page)).toBe('wss://procv.site/ws/notifications/')
    expect(socketUrl('http://localhost:8000/api', page)).toBe('ws://localhost:8000/ws/notifications/')
  })

  it('backs off exponentially with jitter, capped at 30 seconds', async () => {
    const { retryDelay } = await loadSocket()
    expect(retryDelay(1, () => 0)).toBe(500)
    expect(retryDelay(1, () => 1)).toBe(1000)
    expect(retryDelay(4, () => 1)).toBe(8000)
    expect(retryDelay(20, () => 1)).toBe(30_000)
  })

  it('opens one shared socket with a ticket, announces the connection and forwards events', async () => {
    const realtime = await loadSocket()
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = realtime.subscribeRealtime(first)
    realtime.subscribeRealtime(second)
    await flush()

    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(FakeSocket.instances).toHaveLength(1)
    const socket = FakeSocket.instances[0]
    expect(socket.url).toBe(`ws://${window.location.host}/ws/notifications/?ticket=one-time`)
    socket.open()
    expect(realtime.getRealtimeStatus()).toBe('open')
    expect(first).toHaveBeenCalledWith({ type: 'connected' })

    socket.message({ type: 'notification.created', scope: 'employer' })
    socket.message({ type: 'pong' })
    expect(second).toHaveBeenLastCalledWith({ type: 'notification.created', scope: 'employer' })
    expect(second).toHaveBeenCalledTimes(2)

    stopFirst()
    expect(socket.readyState).toBe(1)
  })

  it('pings every 25 seconds and replaces a socket that went silent', async () => {
    const realtime = await loadSocket()
    realtime.subscribeRealtime(() => {})
    await flush()
    const socket = FakeSocket.instances[0]
    socket.open()

    await vi.advanceTimersByTimeAsync(25_000)
    expect(socket.sent).toEqual(['{"type":"ping"}'])

    await vi.advanceTimersByTimeAsync(50_000)
    expect(socket.readyState).toBe(3)
    expect(realtime.getRealtimeStatus()).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(FakeSocket.instances).toHaveLength(2)
  })

  it('fetches a fresh ticket when the server refuses the old one', async () => {
    const realtime = await loadSocket()
    realtime.subscribeRealtime(() => {})
    await flush()

    FakeSocket.instances[0].close(4401)
    await flush()

    expect(mocks.post).toHaveBeenCalledTimes(2)
    expect(FakeSocket.instances).toHaveLength(2)
  })

  it('stops quietly when the session is gone instead of retrying forever', async () => {
    mocks.post.mockRejectedValue({ response: { status: 401 } })
    const realtime = await loadSocket()
    realtime.subscribeRealtime(() => {})
    await flush()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(FakeSocket.instances).toHaveLength(0)
    expect(realtime.getRealtimeStatus()).toBe('idle')
  })

  it('closes the socket when the last subscriber leaves', async () => {
    const realtime = await loadSocket()
    const stop = realtime.subscribeRealtime(() => {})
    await flush()
    const socket = FakeSocket.instances[0]
    socket.open()

    stop()

    expect(socket.readyState).toBe(3)
    expect(realtime.getRealtimeStatus()).toBe('idle')
  })

  it('sends client messages only while the socket is open', async () => {
    const realtime = await loadSocket()
    expect(realtime.sendRealtime({ type: 'typing', conversation: 'cnv_1' })).toBe(false)
    realtime.subscribeRealtime(() => {})
    await flush()
    const socket = FakeSocket.instances[0]
    expect(realtime.sendRealtime({ type: 'typing', conversation: 'cnv_1' })).toBe(false)

    socket.open()
    expect(realtime.sendRealtime({ type: 'typing', conversation: 'cnv_1' })).toBe(true)
    expect(socket.sent).toEqual(['{"type":"typing","conversation":"cnv_1"}'])
  })
})
