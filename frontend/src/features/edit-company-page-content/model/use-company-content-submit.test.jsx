import { QueryClient } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import { useCompanyContentSubmit } from './use-company-content-submit'

const { pageApi, mediaApi } = vi.hoisted(() => ({
  pageApi: {
    employerCompanyPageKeys: { page: ['employer', 'company', 'page', 'workspace'] },
    getEmployerCompanyPage: vi.fn(),
    submitEmployerCompanyPageContent: vi.fn(),
  },
  mediaApi: {
    uploadEmployerCompanyCover: vi.fn(),
    uploadEmployerCompanyImage: vi.fn(),
    uploadEmployerCompanyLogo: vi.fn(),
  },
}))

vi.mock('@/entities/employer-company-page', () => pageApi)
vi.mock('@/entities/employer-profile', () => mediaApi)

const KEY = pageApi.employerCompanyPageKeys.page
const SUBMITTED = { content_form: { request: { public_id: 'cur_9', status: 'submitted' } }, version: 'after-post' }
const REFETCHED = { content_form: { request: { public_id: 'cur_9', status: 'submitted' } }, version: 'after-upload' }

function renderSubmit() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(KEY, { version: 'before' })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => useCompanyContentSubmit(), { wrapper: ({ children }) => withQueryClient(children, client) })
  return { result, client, invalidate }
}

describe('useCompanyContentSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pageApi.submitEmployerCompanyPageContent.mockResolvedValue(SUBMITTED)
    pageApi.getEmployerCompanyPage.mockResolvedValue(REFETCHED)
  })

  it('sends text changes once and stores the returned workspace', async () => {
    const { result, client } = renderSubmit()

    await act(() => result.current.mutateAsync({ changes: { headline: 'Mới' } }))

    expect(pageApi.submitEmployerCompanyPageContent).toHaveBeenCalledWith({ headline: 'Mới' })
    expect(mediaApi.uploadEmployerCompanyLogo).not.toHaveBeenCalled()
    expect(pageApi.getEmployerCompanyPage).not.toHaveBeenCalled()
    expect(client.getQueryData(KEY)).toEqual(SUBMITTED)
  })

  it('posts media markers, uploads into the returned request, then refetches the workspace', async () => {
    const logo = new File(['l'], 'logo.png')
    const cover = new File(['c'], 'cover.png')
    const photos = [new File(['1'], '1.png'), new File(['2'], '2.png')]
    const { result, client } = renderSubmit()

    await act(() => result.current.mutateAsync({ changes: { gallery_deletions: [3] }, files: { logo, cover, gallery: photos } }))

    expect(pageApi.submitEmployerCompanyPageContent).toHaveBeenCalledWith({
      gallery_deletions: [3], logo_pending: true, cover_pending: true, gallery_pending: true,
    })
    expect(mediaApi.uploadEmployerCompanyLogo).toHaveBeenCalledWith(logo, { updateRequest: 'cur_9' })
    expect(mediaApi.uploadEmployerCompanyCover).toHaveBeenCalledWith(cover, { updateRequest: 'cur_9' })
    expect(mediaApi.uploadEmployerCompanyImage.mock.calls.map(([file, options]) => [file.name, options]))
      .toEqual([['1.png', { updateRequest: 'cur_9' }], ['2.png', { updateRequest: 'cur_9' }]])
    expect(pageApi.submitEmployerCompanyPageContent.mock.invocationCallOrder[0])
      .toBeLessThan(mediaApi.uploadEmployerCompanyLogo.mock.invocationCallOrder[0])
    expect(pageApi.getEmployerCompanyPage).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(KEY)).toEqual(REFETCHED)
  })

  it('flags a failed upload and reloads the workspace', async () => {
    mediaApi.uploadEmployerCompanyLogo.mockRejectedValue(new Error('upload failed'))
    const { result, invalidate } = renderSubmit()

    await expect(act(() => result.current.mutateAsync({ changes: {}, files: { logo: new File(['l'], 'logo.png') } })))
      .rejects.toMatchObject({ mediaFailed: true })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY })
  })

  it('reloads the workspace after an in-review conflict or a lost permission', async () => {
    pageApi.submitEmployerCompanyPageContent
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'COMPANY_UPDATE_IN_REVIEW' } } })
      .mockRejectedValueOnce({ response: { status: 400, data: { headline: ['Sai.'] } } })
    const { result, invalidate } = renderSubmit()

    await expect(act(() => result.current.mutateAsync({ changes: { headline: 'A' } }))).rejects.toBeTruthy()
    expect(invalidate).toHaveBeenCalledTimes(1)
    await expect(act(() => result.current.mutateAsync({ changes: { headline: 'B' } }))).rejects.toBeTruthy()
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})
