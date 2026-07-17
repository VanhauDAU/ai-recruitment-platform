import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { CvSaveSuccessView } from '@/widgets/cv-save-success'

export default function CvSaveSuccess() {
  const { publicId } = useParams()
  const location = useLocation()

  useEffect(() => {
    document.title = 'Lưu CV thành công | ProCV'
  }, [])

  return (
    <CvSaveSuccessView
      publicId={publicId}
      savedCv={location.state?.savedCv}
      savedVersion={location.state?.savedVersion}
    />
  )
}
