import {
  AlertOutlined,
  BellOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  LockOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { ANNOUNCEMENT_ICONS } from '@/entities/announcement'

const ICONS = {
  [ANNOUNCEMENT_ICONS.ALERT_TRIANGLE]: AlertOutlined,
  [ANNOUNCEMENT_ICONS.BELL]: BellOutlined,
  [ANNOUNCEMENT_ICONS.CHECK_CIRCLE]: CheckCircleOutlined,
  [ANNOUNCEMENT_ICONS.INFO]: InfoCircleOutlined,
  [ANNOUNCEMENT_ICONS.LOCK]: LockOutlined,
  [ANNOUNCEMENT_ICONS.MEGAPHONE]: NotificationOutlined,
  [ANNOUNCEMENT_ICONS.SHIELD]: SafetyCertificateOutlined,
  [ANNOUNCEMENT_ICONS.SPARKLES]: NotificationOutlined,
  [ANNOUNCEMENT_ICONS.WRENCH]: ToolOutlined,
}

export default function AnnouncementIcon({ name }) {
  const Icon = ICONS[name] || InfoCircleOutlined
  return <Icon />
}
