import { useQuery } from '@tanstack/react-query'
import { campaignKeys, getCampaignLaunch } from '@/entities/campaign'

export function useCampaignLaunch(publicId) {
  return useQuery({
    queryKey: campaignKeys.launch(publicId),
    queryFn: () => getCampaignLaunch(publicId),
    enabled: Boolean(publicId),
  })
}
