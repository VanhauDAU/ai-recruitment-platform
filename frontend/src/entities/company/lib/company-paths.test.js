import { describe, expect, it } from 'vitest'
import {
  COMPANY_DIRECTORY_PATH,
  COMPANY_SEARCH_PATH,
  companyDirectoryPath,
  companyJobsPath,
  companySearchPath,
} from './company-paths'

describe('company paths', () => {
  it('builds a shareable company-directory query', () => {
    expect(companyDirectoryPath()).toBe(COMPANY_DIRECTORY_PATH)
    expect(companyDirectoryPath(' Công ty Alpha & Đối tác '))
      .toBe('/cong-ty/tim-kiem?keyword=C%C3%B4ng+ty+Alpha+%26+%C4%90%E1%BB%91i+t%C3%A1c')
    expect(companySearchPath(' Frontend ')).toBe(`${COMPANY_SEARCH_PATH}?keyword=Frontend`)
    expect(companySearchPath('   ')).toBe(COMPANY_SEARCH_PATH)
  })

  it('builds the existing job search contract from a company object', () => {
    expect(companyJobsPath({ company_name: 'Công ty Alpha & Đối tác' }))
      .toBe('/viec-lam?search=C%C3%B4ng+ty+Alpha+%26+%C4%90%E1%BB%91i+t%C3%A1c&search_by=company')
    expect(companyJobsPath(null)).toBe('/viec-lam')
  })
})
