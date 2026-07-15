import { renderHook, waitFor } from '@testing-library/react'
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
describe('useMyCvsData', () => {
  beforeEach(() => {
    mocks.getMyCvs.mockReset()
  })

  it('tải và tách CV theo cv_type', async () => {
    mocks.getMyCvs.mockResolvedValue([builderCv, uploadedCv])

    const { result } = renderHook(() => useMyCvsData())
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.builderCvs).toEqual([builderCv])
    expect(result.current.uploadedCvs).toEqual([uploadedCv])
  })

  it('lỗi tải trả về danh sách rỗng thay vì giữ dữ liệu cũ', async () => {
    mocks.getMyCvs.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useMyCvsData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.builderCvs).toEqual([])
    expect(result.current.uploadedCvs).toEqual([])
  })

  it('refresh gọi lại API và cập nhật danh sách', async () => {
    mocks.getMyCvs.mockResolvedValue([builderCv])

    const { result } = renderHook(() => useMyCvsData())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.builderCvs).toEqual([builderCv])

    mocks.getMyCvs.mockResolvedValue([builderCv, uploadedCv])
    result.current.refresh()

    await waitFor(() => expect(result.current.uploadedCvs).toEqual([uploadedCv]))
    expect(mocks.getMyCvs).toHaveBeenCalledTimes(2)
  })

  it('không set state cho request đã bị vượt bởi refresh mới hơn', async () => {
    let resolveFirst
    mocks.getMyCvs
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValue([builderCv, uploadedCv])

    const { result } = renderHook(() => useMyCvsData())
    result.current.refresh()
    await waitFor(() => expect(result.current.loading).toBe(false))

    resolveFirst([{ public_id: 'stale', cv_type: 'builder' }])
    await waitFor(() => expect(result.current.builderCvs).toEqual([builderCv]))
  })
})
