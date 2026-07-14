import { useParams } from 'react-router-dom'
import { OwnerCvVersionPage } from '@/features/view-cv-version'

export default function CvOwnerView() {
  const { publicId } = useParams()
  return <OwnerCvVersionPage publicId={publicId} />
}
