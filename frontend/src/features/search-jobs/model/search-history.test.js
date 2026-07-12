import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/entities/job', () => ({
  getJobs: vi.fn(() => Promise.resolve({ count: 0 })),
}))

import { clearHistory, getHistory, removeHistoryEntry, saveHistory } from './search-history'

describe('search history', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty array when storage has no history', () => {
    expect(getHistory()).toEqual([])
  })

  it('adds a search history entry', () => {
    saveHistory('React', 'company')

    expect(getHistory()).toEqual([{ q: 'React', by: 'company', count: null }])
  })

  it('does not create duplicate entries for the same keyword and search type', () => {
    saveHistory('React')
    saveHistory(' React ')

    expect(getHistory()).toEqual([{ q: 'React', by: 'title', count: null }])
  })

  it('removes a single history entry', () => {
    localStorage.setItem('search_history', JSON.stringify([
      { q: 'React', by: 'title', count: null },
      { q: 'Vue', by: 'company', count: 3 },
    ]))

    removeHistoryEntry({ q: 'React', by: 'title' })

    expect(getHistory()).toEqual([{ q: 'Vue', by: 'company', count: 3 }])
  })

  it('clears all search history', () => {
    localStorage.setItem('search_history', JSON.stringify([{ q: 'React', by: 'title', count: null }]))

    clearHistory()

    expect(getHistory()).toEqual([])
  })

  it('does not crash when storage contains invalid JSON', () => {
    localStorage.setItem('search_history', '{invalid')

    expect(getHistory()).toEqual([])
  })
})
