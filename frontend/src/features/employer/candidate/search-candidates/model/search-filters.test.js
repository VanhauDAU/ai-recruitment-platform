import { describe, expect, it } from 'vitest'
import { activeFilterCount, EMPTY_FILTERS, filtersToParams } from './search-filters'

describe('search filters', () => {
  it('sends only filled fields, lists as comma text and years as months', () => {
    const params = filtersToParams({
      ...EMPTY_FILTERS,
      q: '  ReactJS ',
      all_keywords: ['typescript', 'a,b'],
      language: 'en',
      language_level: 'working',
      min_years: 1.5,
      max_years: 3,
      province: 48,
    })

    expect(params).toEqual({
      q: 'ReactJS',
      all_keywords: 'typescript,a b',
      language: 'en',
      language_level: 'working',
      min_months: 18,
      max_months: 36,
      province: 48,
    })
    expect(activeFilterCount({ ...EMPTY_FILTERS, min_years: 1, max_years: 2, language: 'en', language_level: 'basic' })).toBe(2)
    expect(activeFilterCount({ ...EMPTY_FILTERS, max_years: 2 })).toBe(1)
  })

  it('drops a language level without a language', () => {
    expect(filtersToParams({ ...EMPTY_FILTERS, language_level: 'native' })).toEqual({})
  })
})
