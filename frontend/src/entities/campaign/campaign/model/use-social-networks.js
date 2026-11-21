import { useQuery } from '@tanstack/react-query'
import { getSocialNetworks } from '../api/campaign.api'
import { campaignKeys } from '../api/campaign.keys'

// Mạng xã hội tự đăng được và giới hạn bài của từng mạng; đổi theo cấu hình máy chủ, không theo phiên.
export function useSocialNetworks({ enabled = true } = {}) {
  return useQuery({ queryKey: campaignKeys.socialNetworks, queryFn: getSocialNetworks, staleTime: Infinity, enabled })
}

export const networkForKind = (networks = [], kind) => networks.find((network) => network.channel_kind === kind)
