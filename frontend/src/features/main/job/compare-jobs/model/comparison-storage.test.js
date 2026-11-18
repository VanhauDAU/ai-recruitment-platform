import { describe, expect, it, vi } from 'vitest'
import {
  clearComparisonStorage,
  COMPARISON_STORAGE_KEY,
  readComparisonStorage,
  writeComparisonStorage,
} from './comparison-storage'

const item = {
  publicId: 'job-1',
  slug: 'frontend-engineer',
  title: 'Frontend Engineer',
  companyName: 'ProCV',
  companyLogoUrl: '',
}

describe('job comparison storage', () => {
  it('round-trips the versioned payload and ignores corrupt or obsolete data', () => {
    const values = new Map()
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }

    expect(writeComparisonStorage([item], storage)).toBe(true)
    expect(readComparisonStorage(storage)).toEqual([item])

    values.set(COMPARISON_STORAGE_KEY, '{broken')
    expect(readComparisonStorage(storage)).toEqual([])
    values.set(COMPARISON_STORAGE_KEY, JSON.stringify({ version: 0, items: [item] }))
    expect(readComparisonStorage(storage)).toEqual([])
  })

  it('survives private-mode storage failures and can request a clear safely', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('blocked') }),
      setItem: vi.fn(() => { throw new Error('blocked') }),
      removeItem: vi.fn(() => { throw new Error('blocked') }),
    }

    expect(readComparisonStorage(storage)).toEqual([])
    expect(writeComparisonStorage([item], storage)).toBe(false)
    expect(() => clearComparisonStorage(storage)).not.toThrow()
  })
})
