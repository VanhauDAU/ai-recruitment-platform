import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicCompanies } from '@/entities/company'
import { nextCompanyCursor, useCompanyDirectory } from './use-company-directory'

vi.mock('@/entities/company', async (importOriginal) => ({
  ...(await importOriginal()),
  getPublicCompanies: vi.fn(),
}))

function company(publicId) {
  return { public_id: publicId, company_name: publicId }
}

function renderCompanyDirectoryHook(initialProps) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(
    ({ featuredRequestKey, mode, query }) => useCompanyDirectory(query, {
      featuredRequestKey,
      mode,
    }),
    { initialProps, wrapper },
  )
}

afterEach(() => vi.clearAllMocks())

describe('nextCompanyCursor', () => {
  it('extracts the opaque cursor without depending on the API host', () => {
    expect(nextCompanyCursor({ next: 'https://api.example.com/api/companies/?cursor=cD0xOA%3D%3D' }))
      .toBe('cD0xOA==')
    expect(nextCompanyCursor({ next: null })).toBeUndefined()
    expect(nextCompanyCursor({ next: 'not a valid url' })).toBeUndefined()
  })
})

describe('useCompanyDirectory', () => {
  it('keeps blank search mode idle without featured or search requests', () => {
    const { result } = renderCompanyDirectoryHook({
      featuredRequestKey: 0,
      mode: 'search',
      query: '   ',
    })

    expect(result.current.isSearch).toBe(true)
    expect(result.current.hasSearchKeyword).toBe(false)
    expect(result.current.isPending).toBe(false)
    expect(result.current.companies).toEqual([])
    expect(result.current.featuredCompanies).toEqual([])
    expect(result.current.totalCount).toBeUndefined()
    expect(getPublicCompanies).not.toHaveBeenCalled()
  })

  it('loads featured companies once as a finite envelope and ignores next', async () => {
    getPublicCompanies.mockResolvedValue({
      next: 'https://api.example.com/api/companies/?cursor=must-not-follow',
      previous: null,
      results: [company('featured_1')],
    })

    const { result } = renderCompanyDirectoryHook({ featuredRequestKey: 0, query: '' })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.companies).toEqual([company('featured_1')])
    expect(result.current.isSearch).toBe(false)
    expect(result.current.hasNextPage).toBe(false)
    expect(getPublicCompanies).toHaveBeenCalledOnce()
    expect(getPublicCompanies).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    )
  })

  it('follows cursor pages only for a nonblank search', async () => {
    getPublicCompanies.mockImplementation((params) => {
      if (!params.q) {
        return Promise.resolve({
          next: null,
          previous: null,
          results: [company('featured_sidebar')],
        })
      }
      if (!params.cursor) {
        return Promise.resolve({
          count: 2,
          next: 'https://api.example.com/api/companies/?q=Alpha&cursor=page-two',
          previous: null,
          results: [company('search_1')],
        })
      }
      return Promise.resolve({
        count: 99,
        next: null,
        previous: 'https://api.example.com/api/companies/?q=Alpha',
        results: [company('search_2')],
      })
    })

    const { result } = renderCompanyDirectoryHook({ featuredRequestKey: 0, query: ' Alpha ' })

    await waitFor(() => expect(result.current.companies).toEqual([company('search_1')]))
    await act(async () => result.current.fetchNextPage())
    await waitFor(() => expect(result.current.companies).toEqual([
      company('search_1'),
      company('search_2'),
    ]))

    expect(result.current.featuredCompanies).toEqual([company('featured_sidebar')])
    expect(result.current.totalCount).toBe(2)
    expect(getPublicCompanies).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    )
    expect(getPublicCompanies).toHaveBeenCalledWith(
      { q: 'Alpha' },
      { signal: expect.any(AbortSignal) },
    )
    expect(getPublicCompanies).toHaveBeenCalledWith(
      { q: 'Alpha', cursor: 'page-two' },
      { signal: expect.any(AbortSignal) },
    )
    expect(getPublicCompanies).toHaveBeenCalledTimes(3)
  })

  it('uses a fresh featured key instead of exposing the previous shuffle', async () => {
    let resolveSecondRequest
    getPublicCompanies
      .mockResolvedValueOnce({ next: null, previous: null, results: [company('featured_old')] })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecondRequest = resolve
      }))

    const { result, rerender } = renderCompanyDirectoryHook({ featuredRequestKey: 0, query: '' })
    await waitFor(() => expect(result.current.companies).toEqual([company('featured_old')]))

    rerender({ featuredRequestKey: 1, query: '' })
    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(result.current.companies).toEqual([])

    await act(async () => resolveSecondRequest({
      next: null,
      previous: null,
      results: [company('featured_new')],
    }))
    await waitFor(() => expect(result.current.companies).toEqual([company('featured_new')]))
    expect(getPublicCompanies).toHaveBeenCalledTimes(2)
  })
})
