import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAX_DESIRED_SPECIALIZATIONS, toFormValues } from '@/features/configure-job-preferences'
import { INTERVIEW_STEPS, stepById } from './interview-script'

/** Robot "lọc việc" đủ lâu để câu chốt không nhảy ra ngay sau cú bấm cuối. */
export const MIN_SAVING_MS = 2400

const LAST_INDEX = INTERVIEW_STEPS.length - 1

/** Cùng bộ điều kiện với `rules` của JobPreferencesForm, chỉ tách theo lượt hỏi. */
const STEP_VALIDATORS = {
  specialization: ({ desired_specialization_ids: ids }) => {
    if (!ids?.length) return 'Vui lòng chọn ít nhất một vị trí chuyên môn.'
    if (ids.length > MAX_DESIRED_SPECIALIZATIONS) return `Chỉ được chọn tối đa ${MAX_DESIRED_SPECIALIZATIONS} vị trí chuyên môn.`
    return ''
  },
  experience: ({ experience_level: level }) => (level ? '' : 'Vui lòng chọn kinh nghiệm.'),
  salary: ({ desired_salary_vnd: salary }) => {
    if (salary == null) return 'Vui lòng nhập mức lương mong muốn.'
    if (salary < 1) return 'Mức lương phải lớn hơn 0.'
    return ''
  },
  location: ({ preferred_province_ids: ids }) => (ids?.length ? '' : 'Vui lòng chọn ít nhất một tỉnh/thành.'),
  consent: () => '',
}

export function stepError(step, values) {
  return STEP_VALIDATORS[step?.id]?.(values) ?? ''
}

/**
 * Điều phối cuộc trò chuyện onboarding.
 *
 * Toàn bộ luồng nằm trên một trang nên không còn "tiếp tục / quay lại": trả lời
 * xong là robot hỏi câu kế, và sửa đáp án cũ thì mở lại đúng bong bóng đó tại
 * chỗ (`editing`) chứ không tua ngược cả cuộc hội thoại. Đáp án giữ ở đây thay
 * vì trong antd Form vì mỗi lượt là một control rời — tên trường vẫn y hệt để
 * payload gửi lên khớp form một trang cũ.
 */
export function useInterviewChat({ onSubmit, preference }) {
  // Chỉ lấy `preference` làm giá trị khởi tạo: page đã chờ tải xong mới mount
  // widget, nên không cần effect đồng bộ lại — mà có effect thì prop là object
  // dựng mới mỗi render sẽ thành vòng lặp render vô tận.
  const [values, setValues] = useState(() => toFormValues(preference))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('greeting')
  const [editing, setEditing] = useState(null)
  // Câu robot nhắc khi ứng viên gửi thiếu; giữ luôn trong lịch sử chat vì đó
  // cũng là một lượt nói thật của robot.
  const [nagged, setNagged] = useState({})
  const [failure, setFailure] = useState(null)

  const snapshotRef = useRef(values)
  // Phải bật lại trong thân effect: StrictMode chạy mount → cleanup → mount,
  // chỉ gán ở cleanup thì cờ tắt vĩnh viễn và câu chốt không bao giờ hiện.
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const step = editing
    ? stepById(editing)
    : (phase === 'retry' ? stepById(failure?.stepId) : INTERVIEW_STEPS[index])
  const answering = phase === 'asking' || phase === 'retry'

  const start = useCallback(() => setPhase('asking'), [])

  const setField = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
  }, [])

  const submit = useCallback(async (payload) => {
    setPhase('saving')
    setFailure(null)
    const startedAt = Date.now()
    const rejected = await onSubmit(payload)
    await new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, MIN_SAVING_MS - (Date.now() - startedAt)))
    })
    if (!aliveRef.current) return
    if (!rejected) {
      setPhase('ready')
      return
    }
    // Nhảy về đúng lượt hỏi chứa trường bị backend từ chối — bề mặt gọi không
    // cần biết lượt nào chứa trường nào.
    const target = INTERVIEW_STEPS.find((item) => item.fields.includes(rejected.field))
    setFailure({ stepId: (target || INTERVIEW_STEPS[LAST_INDEX]).id, text: rejected.text })
    setPhase('retry')
  }, [onSubmit])

  /** Gửi đáp án của lượt đang mở; `patch` dành cho lựa chọn bấm phát gửi luôn. */
  const send = useCallback((patch) => {
    if (!step) return
    const next = patch ? { ...values, ...patch } : values
    if (patch) setValues(next)

    const error = stepError(step, next)
    if (error) {
      setNagged((current) => ({ ...current, [step.id]: step.retry || error }))
      return
    }
    if (editing) {
      setEditing(null)
      return
    }
    if (phase === 'retry') {
      submit(next)
      return
    }
    if (index < LAST_INDEX) {
      setIndex(index + 1)
      return
    }
    submit(next)
  }, [editing, index, phase, step, submit, values])

  const edit = useCallback((stepId) => {
    snapshotRef.current = values
    setEditing(stepId)
  }, [values])

  const cancelEdit = useCallback(() => {
    setValues(snapshotRef.current)
    setEditing(null)
  }, [])

  return useMemo(() => ({
    answering,
    cancelEdit,
    edit,
    editing,
    failure,
    index,
    nagged,
    phase,
    send,
    setField,
    start,
    step,
    total: INTERVIEW_STEPS.length,
    values,
  }), [answering, cancelEdit, edit, editing, failure, index, nagged, phase, send, setField, start, step, values])
}
