import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { INTERVIEW_STEPS } from './interview-script'
import { useInterviewFlow } from './use-interview-flow'

function answerAll(result) {
  act(() => {
    result.current.setField('desired_specialization_ids', [1])
    result.current.setField('experience_level', '2')
    result.current.setField('desired_salary_vnd', 15_000_000)
    result.current.setField('preferred_province_ids', [3])
  })
}

describe('useInterviewFlow', () => {
  it('chặn qua bước khi chưa trả lời và hiện đúng lỗi', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() => useInterviewFlow({ onSubmit, preference: null }))

    await act(async () => { await result.current.next() })

    expect(result.current.index).toBe(0)
    expect(result.current.showError).toBe(true)
    expect(result.current.error).toContain('ít nhất một vị trí chuyên môn')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('đi hết năm bước rồi gửi đúng payload của form cũ', async () => {
    const onSubmit = vi.fn().mockResolvedValue(null)
    const { result } = renderHook(() => useInterviewFlow({ onSubmit, preference: null }))

    answerAll(result)
    for (let step = 0; step < INTERVIEW_STEPS.length; step += 1) {
      await act(async () => { await result.current.next() })
    }

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      ai_recommendation_consent: false,
      desired_position_other: '',
      desired_salary_vnd: 15_000_000,
      desired_specialization_ids: [1],
      experience_level: '2',
      preferred_province_ids: [3],
      recruiter_visibility_consent: false,
      willing_to_relocate: false,
    }))
  })

  it('quay lại giữ nguyên đáp án đã chọn', async () => {
    const { result } = renderHook(() => useInterviewFlow({ onSubmit: vi.fn(), preference: null }))

    answerAll(result)
    await act(async () => { await result.current.next() })
    act(() => { result.current.back() })

    expect(result.current.index).toBe(0)
    expect(result.current.values.desired_specialization_ids).toEqual([1])
  })

  it('nhảy về đúng bước chứa trường bị backend từ chối', async () => {
    const onSubmit = vi.fn().mockResolvedValue('desired_salary_vnd')
    const { result } = renderHook(() => useInterviewFlow({ onSubmit, preference: null }))

    answerAll(result)
    for (let step = 0; step < INTERVIEW_STEPS.length; step += 1) {
      await act(async () => { await result.current.next() })
    }

    expect(result.current.step.id).toBe('salary')
    expect(result.current.showError).toBe(true)
  })

  it('nạp sẵn nhu cầu đã lưu để ứng viên quay lại không phải nhập lại', () => {
    const preference = {
      desired_salary_vnd: 20_000_000,
      desired_specializations: [{ id: 7, name: 'Kế toán' }],
      experience_level: '3',
      preferred_provinces: [{ id: 1, name: 'Hà Nội' }],
    }
    const { result } = renderHook(() => useInterviewFlow({ onSubmit: vi.fn(), preference }))

    expect(result.current.values.desired_specialization_ids).toEqual([7])
    expect(result.current.valid).toBe(true)
  })

  it('nháy cảm xúc vui ngay khi bước vừa đủ điều kiện', async () => {
    const { result } = renderHook(() => useInterviewFlow({ onSubmit: vi.fn(), preference: null }))

    expect(result.current.celebrating).toBe(false)
    act(() => { result.current.setField('desired_specialization_ids', [1]) })

    await waitFor(() => expect(result.current.celebrating).toBe(true))
  })
})
