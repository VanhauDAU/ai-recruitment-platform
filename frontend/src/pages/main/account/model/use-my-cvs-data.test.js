import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMyCvsData } from './use-my-cvs-data'

const mocks = vi.hoisted(() => ({
  getMyCvs: vi.fn(),
}))

vi.mock('@/entities/cv', () => ({
  getMyCvs: mocks.getMyCvs,
}))

const builderCv = { public_id: 'cv_1', cv_type: 'builder', title: 'CV builder' }
const uploadedCv = { public_id: 'cv_2', cv_type: 'uploaded', title: 'CV uploaded' }

function renderMyCvs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => createElement(QueryClientProvider, { client }, children)
  return { client, ...renderHook(() => useMyCvsData(), { wrapper }) }
}

describe('useMyCvsData', () => {
  beforeEach(() => {
    mocks.getMyCvs.mockReset()
  })

  it('tải và tách CV theo cv_type', async () => {
    mocks.getMyCvs.mockResolvedValue([builderCv, uploadedCv])

    const { result } = renderMyCvs()
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.builderCvs).toEqual([builderCv])
    expect(result.current.uploadedCvs).toEqual([uploadedCv])
  })

  it('lỗi tải trả về danh sách rỗng', async () => {
    mocks.getMyCvs.mockRejectedValue(new Error('network'))

    const { result } = renderMyCvs()
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.builderCvs).toEqual([])
    expect(result.current.uploadedCvs).toEqual([])
  })

  it('refresh và việc làm mới key my-cvs đều tải lại danh sách', async () => {
    mocks.getMyCvs.mockResolvedValue([builderCv])

    const { result, client } = renderMyCvs()
    await waitFor(() => expect(result.current.builderCvs).toEqual([builderCv]))

    mocks.getMyCvs.mockResolvedValue([builderCv, uploadedCv])
    result.current.refresh()
    await waitFor(() => expect(result.current.uploadedCvs).toEqual([uploadedCv]))

    mocks.getMyCvs.mockResolvedValue([])
    await client.invalidateQueries({ queryKey: ['my-cvs'] })
    await waitFor(() => expect(result.current.builderCvs).toEqual([]))
    expect(mocks.getMyCvs).toHaveBeenCalledTimes(3)
  })
})
