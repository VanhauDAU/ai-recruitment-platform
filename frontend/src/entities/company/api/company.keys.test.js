import { describe, expect, it } from 'vitest'
import { companyKeys } from './company.keys'

describe('company query keys', () => {
  it('separates shuffled featured requests from stable search pages', () => {
    expect(companyKeys.featured(1)).toEqual([
      'companies',
      'directory',
      'featured',
      { requestKey: 1 },
    ])
    expect(companyKeys.featured(2)).not.toEqual(companyKeys.featured(1))
    expect(companyKeys.search('Alpha')).toEqual([
      'companies',
      'directory',
      'search',
      { keyword: 'Alpha' },
    ])
  })

  it('keys the company page by slug and its lazy blocks by public id', () => {
    expect(companyKeys.detail('fpt-software')).toEqual(['companies', 'detail', 'fpt-software'])
    expect(companyKeys.similar('co_ab12')).toEqual(['companies', 'similar', 'co_ab12'])
    expect(companyKeys.jobFacets('co_ab12')).toEqual(['companies', 'job-facets', 'co_ab12'])
    expect(companyKeys.detail('fpt-software').slice(0, 2)).not.toEqual(companyKeys.directoryRoot)
  })
})
