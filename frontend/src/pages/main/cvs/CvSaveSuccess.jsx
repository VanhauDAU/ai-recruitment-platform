import { useLocation, useParams } from 'react-router'
import { CvSaveSuccessView } from '@/widgets/main/cv-save-success'

export default function CvSaveSuccess() {
  const { publicId } = useParams()
  const location = useLocation()

  return (
    <CvSaveSuccessView
      publicId={publicId}
      savedCv={location.state?.savedCv}
      savedVersion={location.state?.savedVersion}
    />
  )
}
