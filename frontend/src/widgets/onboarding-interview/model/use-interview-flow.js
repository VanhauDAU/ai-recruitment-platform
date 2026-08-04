import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAX_DESIRED_SPECIALIZATIONS, toFormValues } from '@/features/configure-job-preferences'
import { INTERVIEW_STEPS } from './interview-script'

/** Nháy cảm xúc vui khi ứng viên vừa trả lời đủ, không chặn thao tác tiếp theo. */
const CELEBRATE_MS = 900

/** Cùng bộ điều kiện với `rules` của JobPreferencesForm, chỉ tách theo bước. */
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
 * Điều phối cuộc phỏng vấn: giữ đáp án, kiểm tra từng bước, và suy ra trạng thái
 * mascot. Đáp án nằm ở đây thay vì trong antd Form vì mỗi bước là một control
 * rời — vẫn giữ nguyên tên trường để payload gửi lên khớp form một trang cũ.
 */
export function useInterviewFlow({ onSubmit, preference }) {
  // Chỉ lấy `preference` làm giá trị khởi tạo: page đã chờ tải xong mới mount
  // widget, nên không cần effect đồng bộ lại — mà có effect thì prop là object
  // dựng mới mỗi render sẽ thành vòng lặp render vô tận.
  const [values, setValues] = useState(() => toFormValues(preference))
  const [index, setIndex] = useState(0)
  const [showError, setShowError] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [saving, setSaving] = useState(false)

  const step = INTERVIEW_STEPS[index]
  const error = stepError(step, values)
  const valid = !error
  const isLast = index === INTERVIEW_STEPS.length - 1

  const wasValidRef = useRef(valid)
  useEffect(() => {
    const wasValid = wasValidRef.current
    wasValidRef.current = valid
    if (!valid || wasValid) return undefined
    setCelebrating(true)
    const timer = window.setTimeout(() => setCelebrating(false), CELEBRATE_MS)
    return () => window.clearTimeout(timer)
  }, [valid])

  const setField = useCallback((name, value) => {
    setShowError(false)
    setValues((current) => ({ ...current, [name]: value }))
  }, [])

  const back = useCallback(() => {
    setShowError(false)
    setCelebrating(false)
    setIndex((current) => Math.max(0, current - 1))
  }, [])

  /** Đưa ứng viên về đúng bước chứa trường bị backend từ chối. */
  const goToField = useCallback((name) => {
    const target = INTERVIEW_STEPS.findIndex((item) => item.fields.includes(name))
    if (target >= 0) {
      setIndex(target)
      setShowError(true)
    }
  }, [])

  const next = useCallback(async () => {
    if (stepError(INTERVIEW_STEPS[index], values)) {
      setShowError(true)
      return
    }
    setShowError(false)
    if (index < INTERVIEW_STEPS.length - 1) {
      setCelebrating(false)
      setIndex(index + 1)
      return
    }
    setSaving(true)
    try {
      // `onSubmit` trả về tên trường bị backend từ chối (nếu có) để nhảy về
      // đúng bước chứa nó — bề mặt gọi không cần biết bước nào chứa trường nào.
      const rejectedField = await onSubmit(values)
      if (rejectedField) goToField(rejectedField)
    } finally {
      setSaving(false)
    }
  }, [goToField, index, onSubmit, values])

  return useMemo(() => ({
    back,
    celebrating,
    error,
    goToField,
    index,
    isLast,
    next,
    saving,
    setField,
    showError,
    step,
    total: INTERVIEW_STEPS.length,
    valid,
    values,
  }), [back, celebrating, error, goToField, index, isLast, next, saving, setField, showError, step, valid, values])
}
