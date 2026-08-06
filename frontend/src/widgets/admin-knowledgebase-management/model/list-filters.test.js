import { describe, expect, it } from 'vitest'
import { knowledgeListParams, updateKnowledgeListParams } from './list-filters'

describe('knowledge list URL filters', () => {
  it('keeps only API-supported values', () => {
    expect(knowledgeListParams(new URLSearchParams('q=cv&page=2&tab=ignored'))).toEqual({ q: 'cv', page: '2' })
  })

  it('resets pagination when a filter changes', () => {
    expect(updateKnowledgeListParams(new URLSearchParams('page=4&q=cv'), { q: 'email' }).toString()).toBe('q=email')
  })
})
