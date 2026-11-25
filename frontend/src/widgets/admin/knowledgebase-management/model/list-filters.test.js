// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  activeKnowledgeView,
  knowledgeListParams,
  knowledgeViewPatch,
  knowledgeSummaryParams,
  updateKnowledgeListParams,
} from './list-filters'

describe('knowledge list URL filters', () => {
  it('keeps only API-supported values', () => {
    expect(knowledgeListParams(new URLSearchParams('q=cv&page=2&tab=ignored'))).toEqual({ q: 'cv', page: '2' })
  })

  it('resets pagination when a filter changes', () => {
    expect(updateKnowledgeListParams(new URLSearchParams('page=4&q=cv'), { q: 'email' }).toString()).toBe('q=email')
  })

  it('keeps aggregate filters but drops pagination and ordering', () => {
    expect(knowledgeSummaryParams({
      q: 'cv',
      category: 'ho-so',
      ordering: '-category',
      page: '3',
      page_size: '40',
    })).toEqual({ q: 'cv', category: 'ho-so' })
  })

  it('keeps the tile filters out of the summary so tile counts stay put', () => {
    expect(knowledgeSummaryParams({ q: 'cv', revision_status: 'DRAFT', review_due: 'overdue', published: 'true' }))
      .toEqual({ q: 'cv' })
  })

  it('switches between tiles by replacing their filters', () => {
    expect(activeKnowledgeView({ q: 'cv' })).toBe('all')
    expect(activeKnowledgeView({ revision_status: 'DRAFT' })).toBe('drafts')
    expect(activeKnowledgeView({ review_due: 'due_soon' })).toBe('')
    const next = updateKnowledgeListParams(new URLSearchParams('revision_status=DRAFT&q=cv'), knowledgeViewPatch('overdue'))
    expect(next.toString()).toBe('q=cv&review_due=overdue')
  })
})
