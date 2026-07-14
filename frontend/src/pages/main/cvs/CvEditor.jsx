import { useParams } from 'react-router-dom'
import { CvDraftEditor } from '@/features/edit-cv-draft'

export default function CvEditor() {
  const { publicId } = useParams()
  return <CvDraftEditor publicId={publicId} />
}
