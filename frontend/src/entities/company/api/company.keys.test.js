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
})
