import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  publishJobListRankingChanged,
  subscribeJobListRankingChanged,
} from './job-list-ranking-sync'

function installBroadcastChannelMock() {
  const channels = new Set()

  class BroadcastChannelMock {
    constructor(name) {
      this.name = name
      this.listeners = new Set()
      channels.add(this)
    }

    addEventListener(type, listener) {
      if (type === 'message') this.listeners.add(listener)
    }

    removeEventListener(type, listener) {
      if (type === 'message') this.listeners.delete(listener)
    }

    postMessage(data) {
      channels.forEach((channel) => {
        if (channel !== this && channel.name === this.name) {
          channel.listeners.forEach((listener) => listener({ data }))
        }
      })
    }

    close() {
      channels.delete(this)
    }
  }

  vi.stubGlobal('BroadcastChannel', BroadcastChannelMock)
  return channels
}

describe('job-list ranking sync', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('delivers the message to another tab and ignores the source tab', () => {
    const channels = installBroadcastChannelMock()
    const sourceCallback = vi.fn()
    const remoteCallback = vi.fn()
    const unsubscribeSource = subscribeJobListRankingChanged(sourceCallback, { sourceId: 'tab-a' })
    const unsubscribeRemote = subscribeJobListRankingChanged(remoteCallback, { sourceId: 'tab-b' })

    publishJobListRankingChanged({ sourceId: 'tab-a' })

    expect(sourceCallback).not.toHaveBeenCalled()
    expect(remoteCallback).toHaveBeenCalledOnce()
    expect(remoteCallback).toHaveBeenCalledWith({
      at: expect.any(Number),
      sourceId: 'tab-a',
    })

    unsubscribeSource()
    unsubscribeRemote()
    expect(channels.size).toBe(0)
  })
})
