import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { INTERVIEW_STEPS } from './interview-script'
import { useInterviewChat } from './use-interview-chat'

const ANSWERS = [
  { desired_specialization_ids: [1] },
  { experience_level: '2' },
  { desired_salary_vnd: 15_000_000 },
  { preferred_province_ids: [3] },
  undefined,
]

function start(result) {
  act(() => { result.current.start() })
}

/** Trả lời trọn năm lượt: lượt cuối (cho phép) không bắt buộc tick gì. */
async function answerAll(result) {
  start(result)
  for (const patch of ANSWERS) {
    await act(async () => { await result.current.send(patch) })
  }
}

describe('useInterviewChat', () => {
  it('mở đầu bằng lời chào, chỉ vào câu hỏi khi ứng viên bắt chuyện', () => {
    const { result } = renderHook(() => useInterviewChat({ onSubmit: vi.fn(), preference: null }))

    expect(result.current.phase).toBe('greeting')
    start(result)
    expect(result.current.phase).toBe('asking')
    expect(result.current.step.id).toBe('specialization')
  })

  it('nhắc lại ngay trong hội thoại khi ứng viên gửi thiếu', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() => useInterviewChat({ onSubmit, preference: null }))

    start(result)
    await act(async () => { await result.current.send() })

    expect(result.current.index).toBe(0)
    expect(result.current.nagged.specialization).toContain('ít nhất một vị trí chuyên môn')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('chọn xong là sang câu kế, không cần nút tiếp tục', () => {
    const { result } = renderHook(() => useInterviewChat({ onSubmit: vi.fn(), preference: null }))

    start(result)
    act(() => { result.current.send({ desired_specialization_ids: [1] }) })

    expect(result.current.index).toBe(1)
    expect(result.current.step.id).toBe('experience')
    expect(result.current.values.desired_specialization_ids).toEqual([1])
  })

  it('trả lời hết năm lượt thì gửi đúng payload của form một trang', async () => {
    const onSubmit = vi.fn().mockResolvedValue(null)
    const { result } = renderHook(() => useInterviewChat({ onSubmit, preference: null }))

    await answerAll(result)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      ai_recommendation_consent: false,
      desired_position_others: [],
      desired_salary_vnd: 15_000_000,
      desired_specialization_ids: [1],
      experience_level: '2',
      preferred_province_ids: [3],
      recruiter_visibility_consent: false,
      preferred_skill_ids: [],
      willing_to_relocate: false,
    }))
    await waitFor(() => expect(result.current.phase).toBe('ready'), { timeout: 5000 })
  })

  it('sửa đáp án cũ tại chỗ mà không tua lại cuộc trò chuyện', () => {
    const { result } = renderHook(() => useInterviewChat({ onSubmit: vi.fn(), preference: null }))

    start(result)
    act(() => { result.current.send({ desired_specialization_ids: [1] }) })
    act(() => { result.current.edit('specialization') })
    act(() => { result.current.setField('desired_specialization_ids', [1, 2]) })
    act(() => { result.current.send() })

    expect(result.current.editing).toBe(null)
    expect(result.current.index).toBe(1)
    expect(result.current.values.desired_specialization_ids).toEqual([1, 2])
  })

  it('chấp nhận vị trí tự nhập mà không bắt buộc chọn taxonomy', () => {
    const { result } = renderHook(() => useInterviewChat({ onSubmit: vi.fn(), preference: null }))

    start(result)
    act(() => { result.current.send({ desired_position_others: ['Kỹ sư dữ liệu'] }) })

    expect(result.current.index).toBe(1)
    expect(result.current.values.desired_position_others).toEqual(['Kỹ sư dữ liệu'])
  })

  it('huỷ sửa thì trả lại đáp án trước đó', () => {
    const { result } = renderHook(() => useInterviewChat({ onSubmit: vi.fn(), preference: null }))

    start(result)
    act(() => { result.current.send({ desired_specialization_ids: [1] }) })
    act(() => { result.current.edit('specialization') })
    act(() => { result.current.setField('desired_specialization_ids', []) })
    act(() => { result.current.cancelEdit() })

    expect(result.current.values.desired_specialization_ids).toEqual([1])
  })

  it('mở lại đúng lượt hỏi chứa trường bị backend từ chối để gửi lại', async () => {
    const onSubmit = vi.fn()
      .mockResolvedValueOnce({ field: 'desired_salary_vnd', text: 'Mức lương chưa hợp lệ.' })
      .mockResolvedValueOnce(null)
    const { result } = renderHook(() => useInterviewChat({ onSubmit, preference: null }))

    await answerAll(result)

    await waitFor(() => expect(result.current.phase).toBe('retry'), { timeout: 5000 })
    expect(result.current.step.id).toBe('salary')
    expect(result.current.failure.text).toBe('Mức lương chưa hợp lệ.')

    await act(async () => { await result.current.send({ desired_salary_vnd: 20_000_000 }) })

    expect(onSubmit).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.phase).toBe('ready'), { timeout: 5000 })
  })

  it('nạp sẵn nhu cầu đã lưu để ứng viên quay lại không phải nhập lại', () => {
    const preference = {
      desired_salary_vnd: 20_000_000,
      desired_specializations: [{ id: 7, name: 'Kế toán' }],
      experience_level: '3',
      preferred_provinces: [{ id: 1, name: 'Hà Nội' }],
      preferred_skills: [{ id: 11, name: 'Python' }],
    }
    const { result } = renderHook(() => useInterviewChat({ onSubmit: vi.fn(), preference }))

    expect(result.current.values.desired_specialization_ids).toEqual([7])
    expect(result.current.values.preferred_skill_ids).toEqual([11])
    expect(result.current.total).toBe(INTERVIEW_STEPS.length)
  })
})
