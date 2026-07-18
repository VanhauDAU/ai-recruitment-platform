import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { CvSaveSuccessView } from '@/widgets/cv-save-success'
import { setDocumentTitle } from '@/shared/config/document-title'

export default function CvSaveSuccess() {
  const { publicId } = useParams()
  const location = useLocation()

  useEffect(() => {
    setDocumentTitle('Lưu CV thành công')
  }, [])

  return (
    <CvSaveSuccessView
      publicId={publicId}
      savedCv={location.state?.savedCv}
      savedVersion={location.state?.savedVersion}
    />
  )
}
