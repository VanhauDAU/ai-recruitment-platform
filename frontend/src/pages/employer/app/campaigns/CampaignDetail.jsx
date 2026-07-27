import { useParams } from 'react-router'
import { EmployerCampaignWorkspace } from '@/widgets/employer-campaign-workspace'

export default function CampaignDetail() {
  const { publicId } = useParams()
  return <EmployerCampaignWorkspace publicId={publicId} />
}
