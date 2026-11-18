import { useParams } from 'react-router'
import { SharedCvVersionPage } from '@/features/main/cv/view-cv-version'

export default function CvSharedView() {
  const { token } = useParams()
  return <SharedCvVersionPage token={token} />
}
