import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { withQueryClient } from '@/test/render-with-query-client'
import { useCompanyLayoutDraft } from './use-company-layout-draft'

const { api, toast } = vi.hoisted(() => ({
  api: {
    employerCompanyPageKeys: { page: ['employer', 'company', 'page', 'workspace'] },
    updateEmployerCompanyPageLayout: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/entities/employer-company-page', () => api)
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const LAYOUT = {
  section_order: ['about', 'jobs', 'benefits'],
  hidden_sections: [],
  accent: 'brand',
  pinned_job_public_ids: ['jb_1'],
  lock_version: 4,
}
const PAGE = { layout: LAYOUT, pinned_jobs: [{ public_id: 'jb_1', title: 'Kế toán trưởng' }] }

function apiError(status, data) {
  return Object.assign(new Error('request failed'), { response: { status, data } })
}

function renderDraft(page = PAGE) {
  // gcTime mặc định: cache không có observer vẫn phải còn để kiểm tra ghi đè.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(api.employerCompanyPageKeys.page, page)
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const view = renderHook((props) => useCompanyLayoutDraft(props.page), {
    initialProps: { page },
    wrapper: ({ children }) => withQueryClient(children, client),
  })
  return { ...view, client, invalidate }
}

describe('useCompanyLayoutDraft', () => {
  beforeEach(() => vi.clearAllMocks())

  it('tracks unsaved edits, ignores hidden-set ordering and undoes back to the server layout', () => {
    const { result } = renderDraft({ ...PAGE, layout: { ...LAYOUT, hidden_sections: ['about', 'benefits'] } })
    expect(result.current.dirty).toBe(false)

    act(() => result.current.update({ hidden_sections: ['benefits', 'about'] }))
    expect(result.current.dirty).toBe(false)

    act(() => result.current.update({ accent: 'ocean', section_order: ['jobs', 'about', 'benefits'] }))
    expect(result.current.dirty).toBe(true)
    expect(result.current.draft.accent).toBe('ocean')

    act(() => result.current.reset())
    expect(result.current.dirty).toBe(false)
    expect(result.current.draft.section_order).toEqual(LAYOUT.section_order)
  })

  it('resolves pinned jobs picked from search before they are saved', () => {
    const { result } = renderDraft()

    act(() => result.current.pinJob({ public_id: 'jb_2', title: 'Lập trình viên' }))
    act(() => result.current.pinJob({ public_id: 'jb_2', title: 'Lập trình viên' }))

    expect(result.current.draft.pinned_job_public_ids).toEqual(['jb_1', 'jb_2'])
    expect(result.current.pinnedJobs.map((job) => job.title)).toEqual(['Kế toán trưởng', 'Lập trình viên'])
  })

  it('saves only the changed fields with the lock version and adopts the response', async () => {
    const saved = { ...PAGE, layout: { ...LAYOUT, hidden_sections: ['benefits'], lock_version: 5 } }
    api.updateEmployerCompanyPageLayout.mockResolvedValue(saved)
    const { result, client } = renderDraft()

    act(() => result.current.save())
    expect(api.updateEmployerCompanyPageLayout).not.toHaveBeenCalled()

    act(() => result.current.update({ hidden_sections: ['benefits'] }))
    act(() => result.current.save())

    await waitFor(() => expect(result.current.dirty).toBe(false))
    expect(api.updateEmployerCompanyPageLayout.mock.calls[0][0]).toEqual({ lock_version: 4, hidden_sections: ['benefits'] })
    expect(client.getQueryData(api.employerCompanyPageKeys.page)).toEqual(saved)
    expect(result.current.draft.lock_version).toBe(5)
    expect(toast.success).toHaveBeenCalledWith('Đã lưu bố cục trang công ty.')
  })

  it('reloads the server layout and explains why when the lock version is stale', async () => {
    const latest = { ...LAYOUT, accent: 'sunset', lock_version: 9 }
    api.updateEmployerCompanyPageLayout.mockRejectedValue(
      apiError(409, { code: 'COMPANY_PAGE_LAYOUT_STALE', detail: 'stale', layout: latest }),
    )
    const { result, client, invalidate } = renderDraft()

    act(() => result.current.update({ accent: 'ocean' }))
    act(() => result.current.save())

    await waitFor(() => expect(result.current.notice?.type).toBe('warning'))
    expect(result.current.notice.text).toMatch(/Đã tải lại bản mới nhất/)
    expect(result.current.draft).toEqual(latest)
    expect(result.current.dirty).toBe(false)
    expect(client.getQueryData(api.employerCompanyPageKeys.page).layout).toEqual(latest)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: api.employerCompanyPageKeys.page })

    act(() => result.current.dismissNotice())
    expect(result.current.notice).toBeNull()
  })

  it('shows the server message, drops the edits and refreshes permissions on 403', async () => {
    api.updateEmployerCompanyPageLayout.mockRejectedValue(
      apiError(403, { code: 'COMPANY_PAGE_EDIT_FORBIDDEN', detail: 'Quyền biên tập của bạn đã bị thu hồi.' }),
    )
    const { result, invalidate } = renderDraft()

    act(() => result.current.update({ accent: 'ocean' }))
    act(() => result.current.save())

    await waitFor(() => expect(result.current.notice).toEqual({ type: 'error', text: 'Quyền biên tập của bạn đã bị thu hồi.' }))
    expect(result.current.draft.accent).toBe('brand')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: api.employerCompanyPageKeys.page })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('resets the draft to the returned layout even when the server did not bump the version', async () => {
    api.updateEmployerCompanyPageLayout.mockResolvedValue({ ...PAGE, layout: { ...LAYOUT } })
    const { result } = renderDraft()

    act(() => result.current.update({ accent: 'ocean' }))
    act(() => result.current.save())

    await waitFor(() => expect(result.current.dirty).toBe(false))
    expect(result.current.draft.accent).toBe('brand')
  })

  it('replaces an English lock_version error with a Vietnamese sentence and keeps field messages', async () => {
    api.updateEmployerCompanyPageLayout
      .mockRejectedValueOnce(apiError(400, { lock_version: ['This field is required.'] }))
      .mockRejectedValueOnce(apiError(400, { lock_version: ['A valid integer is required.'], accent: ['Màu nhấn không hợp lệ.'] }))
    const { result } = renderDraft()

    act(() => result.current.update({ accent: 'neon' }))
    act(() => result.current.save())
    await waitFor(() => expect(toast.error).toHaveBeenLastCalledWith('Phiên bản bố cục không hợp lệ. Vui lòng tải lại trang rồi thử lại.'))

    act(() => result.current.save())
    await waitFor(() => expect(toast.error).toHaveBeenLastCalledWith('Màu nhấn không hợp lệ.'))
    expect(result.current.dirty).toBe(true)
  })

  it('follows a newer server layout only while there are no unsaved edits', () => {
    const { result, rerender } = renderDraft()
    const newer = { ...PAGE, layout: { ...LAYOUT, accent: 'ocean', lock_version: 5 } }

    act(() => result.current.update({ hidden_sections: ['about'] }))
    rerender({ page: newer })
    expect(result.current.draft.accent).toBe('brand')

    act(() => result.current.reset())
    expect(result.current.draft).toEqual(newer.layout)
  })
})
