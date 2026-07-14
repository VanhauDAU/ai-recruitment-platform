import { useParams } from 'react-router-dom'
import { CvPdfExportControl } from '@/features/export-cv-pdf'
import { OwnerCvVersionPage } from '@/features/view-cv-version'

export default function CvOwnerView() {
  const { publicId } = useParams()
  return <><CvPdfExportControl publicId={publicId} /><OwnerCvVersionPage publicId={publicId} /></>
}
