import { m } from '@/shared/config/i18n'
import { Button } from '@/shared/ui/connect-kit'
import { useCvExport } from '../model/use-cv-export'

/** "Tải PDF" on a builder CV card: the PDF is rendered on request. */
export default function SharedCvExport({ conversation, message }) {
  const { exportPdf, exporting } = useCvExport(conversation.public_id, message)
  return (
    <Button variant="accent" loading={exporting} onClick={exportPdf} className="pc-card__action">
      {exporting ? m.connect_cv_exporting() : m.connect_cv_export()}
    </Button>
  )
}
