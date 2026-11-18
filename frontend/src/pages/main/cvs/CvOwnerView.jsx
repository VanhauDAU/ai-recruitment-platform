import { useParams } from 'react-router'
import { OwnerCvVersionPage } from '@/features/main/cv/view-cv-version'
import OwnerCvActions from './ui/OwnerCvActions'

export default function CvOwnerView() {
  const { publicId } = useParams()
  return <OwnerCvVersionPage publicId={publicId} renderActions={({ cv, version }) => <OwnerCvActions cv={cv} version={version} />} />
}
