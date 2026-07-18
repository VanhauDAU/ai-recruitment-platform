import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import ConsultationForm from './ConsultationForm'

export default function ConsultationModal({ open, onClose, initialValues }) {
  const { t } = useTranslation('employer')

  return (
    <Modal open={open} onCancel={onClose} footer={null} destroyOnHidden width={560}>
      <div className="pt-2">
        <h2 className="text-xl font-bold text-gray-900">{t('consultation.title')}</h2>
        <p className="mt-1 mb-5 text-sm leading-6 text-gray-500">{t('consultation.subtitle')}</p>
        <ConsultationForm initialValues={initialValues} onSuccess={onClose} />
      </div>
    </Modal>
  )
}
