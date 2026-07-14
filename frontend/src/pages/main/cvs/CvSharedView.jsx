import { useParams } from 'react-router-dom'
import { SharedCvVersionPage } from '@/features/view-cv-version'

export default function CvSharedView() {
  const { token } = useParams()
  return <SharedCvVersionPage token={token} />
}
