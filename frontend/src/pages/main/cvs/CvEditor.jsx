import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CvDraftEditor } from '@/features/edit-cv-draft'

export default function CvEditor() {
  const { publicId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const saveType = searchParams.get('mode') === 'create' ? 'create' : 'edit'
  return <CvDraftEditor publicId={publicId} onSaved={({ cv, version }) => navigate(
    `/save-cv-success/${publicId}?type=${saveType}`,
    { state: { savedCv: cv, savedVersion: version } },
  )} />
}
