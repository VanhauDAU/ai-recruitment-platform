import { useNavigate, useParams } from 'react-router-dom'
import { CvDraftEditor } from '@/features/edit-cv-draft'

export default function CvEditor() {
  const { publicId } = useParams()
  const navigate = useNavigate()
  return <CvDraftEditor publicId={publicId} onSaved={() => navigate(`/save-cv-success/${publicId}?type=create`)} />
}
