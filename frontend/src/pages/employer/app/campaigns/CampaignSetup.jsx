import { useParams } from 'react-router'
import { CampaignSetupWizard } from '@/widgets/campaign-setup-wizard'

export default function CampaignSetup() {
  const { publicId } = useParams()
  return <CampaignSetupWizard key={publicId} publicId={publicId} />
}
