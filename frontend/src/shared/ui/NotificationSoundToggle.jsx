import { MutedOutlined, SoundOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useNotificationSound } from '@/shared/lib/incoming-notice'
import { m } from '@/shared/config/i18n'

/** Bật/tắt chuông thông báo mới; lựa chọn lưu trên trình duyệt, áp cho mọi tab. */
export default function NotificationSoundToggle() {
  const [on, setOn] = useNotificationSound()
  const label = on ? m.notification_sound_turn_off() : m.notification_sound_turn_on()
  return (
    <Tooltip title={label}>
      <Button
        type="text"
        size="small"
        aria-label={label}
        aria-pressed={on}
        icon={on ? <SoundOutlined /> : <MutedOutlined />}
        onClick={() => setOn(!on)}
      />
    </Tooltip>
  )
}
