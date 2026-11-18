import { useQuery } from '@tanstack/react-query'
import { campaignKeys, getCampaignChannels } from '@/entities/campaign'

export function useCampaignChannels(publicId) {
  return useQuery({
    queryKey: campaignKeys.channels(publicId),
    queryFn: () => getCampaignChannels(publicId),
    enabled: Boolean(publicId),
  })
}
