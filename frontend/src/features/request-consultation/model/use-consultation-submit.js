import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { createConsultationLead } from '@/entities/consultation-lead'
import { message } from '@/shared/lib/toast'

export function useConsultationSubmit({ onSuccess } = {}) {
  const [submitting, setSubmitting] = useState(false)
  const { t } = useTranslation('employer')
  const location = useLocation()

  const submit = async (values) => {
    setSubmitting(true)
    try {
      await createConsultationLead({ ...values, source_page: location.pathname })
      message.success(t('consultation.success'))
      onSuccess?.()
      return true
    } catch {
      message.error(t('consultation.error'))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return { submit, submitting }
}
