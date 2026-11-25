import { MessageOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useStartConversation } from '@/entities/messaging/conversation'
import { useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'

/**
 * Mở (hoặc mở lại) hội thoại ProCV Connect của hồ sơ đang xem. Ẩn khi admin tắt
 * tính năng, ứng viên đã rút hồ sơ hoặc đang bị công ty chặn (máy chủ cũng từ chối).
 */
export default function MessageCandidateButton({ application }) {
  const start = useStartConversation('employer')
  const enabled = useSiteSettings().settings.connect_enabled === true
  if (!enabled || !application || application.status === 'withdrawn' || application.candidate_blocked) return null
  return (
    <Button
      size="small"
      type="primary"
      icon={<MessageOutlined />}
      loading={start.isPending}
      onClick={() => start.mutate({ application: application.public_id })}
    >
      {m.connect_message_action()}
    </Button>
  )
}
