import {
  FacebookFilled,
  GlobalOutlined,
  LinkedinFilled,
  MailFilled,
  MessageFilled,
  QrcodeOutlined,
  ShareAltOutlined,
  TeamOutlined,
  TikTokOutlined,
} from '@ant-design/icons'

// Biểu tượng và màu nhận diện của từng nền tảng (màu chỉ dùng cho ô biểu tượng).
const KINDS = {
  facebook_page: { icon: FacebookFilled, color: '#1877f2' },
  facebook_group: { icon: TeamOutlined, color: '#1877f2' },
  linkedin: { icon: LinkedinFilled, color: '#0a66c2' },
  zalo: { icon: MessageFilled, color: '#0068ff' },
  tiktok: { icon: TikTokOutlined, color: '#111827' },
  email: { icon: MailFilled, color: '#b45309' },
  website: { icon: GlobalOutlined, color: '#047857' },
  qr_offline: { icon: QrcodeOutlined, color: '#334155' },
  other: { icon: ShareAltOutlined, color: '#64748b' },
}

export default function ChannelIcon({ kind, size = 'md' }) {
  const meta = KINDS[kind] || KINDS.other
  const Icon = meta.icon
  return (
    <span className={`ch-icon is-${size}`} style={{ '--ch-brand': meta.color }} aria-hidden>
      <Icon />
    </span>
  )
}
