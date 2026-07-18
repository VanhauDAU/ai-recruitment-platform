import { useState } from 'react'
import { PhoneOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import ConsultationModal from './ConsultationModal'

export default function FloatingConsultButton() {
  const { t } = useTranslation('employer')
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('common.consult')}
        className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 text-white shadow-lg shadow-[var(--brand-primary)]/30 transition hover:bg-[var(--brand-primary-hover)] md:bottom-8 md:right-8"
      >
        <PhoneOutlined className="text-xl" />
        <span className="hidden text-sm font-bold md:inline">{t('common.consult')}</span>
      </button>
      <ConsultationModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
