import { describe, expect, it } from 'vitest'
import {
  COMPANY_DETAIL_ROUTE,
  COMPANY_DIRECTORY_PATH,
  COMPANY_JOBS_TAB,
  COMPANY_SEARCH_PATH,
  companyDetailPath,
  companySearchPath,
  isCompanyDetailPath,
  jobCompanyPath,
  parseCompanyDetailQuery,
} from './company-paths'

describe('company paths', () => {
  it('builds a shareable company-directory search query', () => {
    expect(companySearchPath(' Frontend ')).toBe(`${COMPANY_SEARCH_PATH}?keyword=Frontend`)
    expect(companySearchPath('   ')).toBe(COMPANY_SEARCH_PATH)
  })

  it('builds the company page from a slug or a company DTO', () => {
    expect(COMPANY_DETAIL_ROUTE).toBe('/cong-ty/:slug')
    expect(companyDetailPath('fpt-software')).toBe('/cong-ty/fpt-software')
    expect(companyDetailPath({ slug: 'fpt-software', company_name: 'FPT' })).toBe('/cong-ty/fpt-software')
    expect(companyDetailPath('a/b?c')).toBe('/cong-ty/a%2Fb%3Fc')
  })

  it('keeps tab, keyword, location and page as URL state of the jobs tab only', () => {
    expect(companyDetailPath('fpt', { tab: COMPANY_JOBS_TAB })).toBe('/cong-ty/fpt?tab=viec-lam')
    expect(companyDetailPath('fpt', { tab: COMPANY_JOBS_TAB, q: ' React & Node ', location: 1, page: 3 }))
      .toBe('/cong-ty/fpt?tab=viec-lam&q=React+%26+Node&location=1&page=3')
    expect(companyDetailPath('fpt', { tab: COMPANY_JOBS_TAB, q: '', location: '', page: 1 }))
      .toBe('/cong-ty/fpt?tab=viec-lam')
    expect(companyDetailPath('fpt', { q: 'React', location: 1, page: 2 })).toBe('/cong-ty/fpt')
    expect(companyDetailPath('fpt', { tab: 'khac', q: 'React' })).toBe('/cong-ty/fpt')
  })

  it('falls back to the name-filtered directory only when no slug is available', () => {
    expect(companyDetailPath({ company_name: ' Công ty Alpha & Đối tác ' }))
      .toBe('/cong-ty/tim-kiem?keyword=C%C3%B4ng+ty+Alpha+%26+%C4%90%E1%BB%91i+t%C3%A1c')
    expect(companyDetailPath({ slug: '  ', trade_name: 'Alpha' })).toBe('/cong-ty/tim-kiem?keyword=Alpha')
    expect(companyDetailPath(null)).toBe(COMPANY_DIRECTORY_PATH)
    expect(companyDetailPath('')).toBe(COMPANY_DIRECTORY_PATH)
  })

  it('links a job to its company page through company_slug, never the job slug', () => {
    expect(jobCompanyPath({ slug: 'backend-jb-1', company_slug: 'fpt-software', company_name: 'FPT' }))
      .toBe('/cong-ty/fpt-software')
    expect(jobCompanyPath({ slug: 'backend-jb-1', company_slug: null, company_name: 'Công ty Alpha' }))
      .toBe('/cong-ty/tim-kiem?keyword=C%C3%B4ng+ty+Alpha')
    expect(jobCompanyPath(null)).toBe(COMPANY_DIRECTORY_PATH)
  })

  it('normalises the company page query back into view state', () => {
    const parse = (query) => parseCompanyDetailQuery(new URLSearchParams(query))

    expect(parse('')).toEqual({ tab: '', q: '', location: '', page: 1 })
    expect(parse('tab=khac&q=React&location=1&page=2')).toEqual({ tab: '', q: '', location: '', page: 1 })
    expect(parse('tab=viec-lam&q=%20React%20&location=12&page=3'))
      .toEqual({ tab: 'viec-lam', q: 'React', location: '12', page: 3 })
    expect(parse('tab=viec-lam&location=ha-noi&page=0')).toEqual({ tab: 'viec-lam', q: '', location: '', page: 1 })
    expect(parse(`tab=viec-lam&q=${'a'.repeat(200)}&page=1.5`))
      .toEqual({ tab: 'viec-lam', q: 'a'.repeat(120), location: '', page: 1 })
  })

  it('recognises the detail route without swallowing the search route', () => {
    expect(isCompanyDetailPath('/cong-ty/fpt-software')).toBe(true)
    expect(isCompanyDetailPath('/cong-ty/tim-kiem')).toBe(false)
    expect(isCompanyDetailPath('/cong-ty')).toBe(false)
    expect(isCompanyDetailPath('/cong-ty/')).toBe(false)
    expect(isCompanyDetailPath('/cong-ty/fpt-software/viec-lam')).toBe(false)
    expect(isCompanyDetailPath('/cong-ty-khac/fpt')).toBe(false)
  })
})
