import { useParams } from 'react-router-dom'
import { EmployerCampaignWorkspace } from '@/widgets/employer-campaign-workspace'

export default function CampaignDetail() {
  const { publicId } = useParams()
  return <EmployerCampaignWorkspace publicId={publicId} />
}
