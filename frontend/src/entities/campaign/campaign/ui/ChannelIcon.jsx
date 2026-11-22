import {
  FacebookFilled,
  GlobalOutlined,
  InstagramFilled,
  LinkedinFilled,
  MailFilled,
  MessageFilled,
  QrcodeOutlined,
  ShareAltOutlined,
  TeamOutlined,
  ThreadsFilled,
  TikTokOutlined,
} from '@ant-design/icons'

// Biểu tượng và màu nhận diện của từng nền tảng (màu chỉ dùng cho ô biểu tượng).
const KINDS = {
  facebook_page: { icon: FacebookFilled, color: '#1877f2' },
  facebook_group: { icon: TeamOutlined, color: '#1877f2' },
  instagram: { icon: InstagramFilled, color: '#d62976' },
  threads: { icon: ThreadsFilled, color: '#111827' },
  linkedin: { icon: LinkedinFilled, color: '#0a66c2' },
  zalo: { icon: MessageFilled, color: '#0068ff' },
  tiktok: { icon: TikTokOutlined, color: '#111827' },
  email: { icon: MailFilled, color: '#b45309' },
  website: { icon: GlobalOutlined, color: '#047857' },
  qr_offline: { icon: QrcodeOutlined, color: '#334155' },
  other: { icon: ShareAltOutlined, color: '#64748b' },
}

const SIZES = {
  sm: { width: 24, height: 24, borderRadius: 7, fontSize: 13 },
  md: { width: 36, height: 36, borderRadius: 10, fontSize: 18 },
  lg: { width: 44, height: 44, borderRadius: 12, fontSize: 22 },
}

// Style nội tuyến: entity có thể nằm trong chunk khởi tạo, không thêm CSS toàn cục.
export default function ChannelIcon({ kind, size = 'md' }) {
  const meta = KINDS[kind] || KINDS.other
  const Icon = meta.icon
  return (
    <span
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        background: `color-mix(in srgb, ${meta.color} 12%, #fff)`,
        color: meta.color,
        ...SIZES[size],
      }}
      aria-hidden
    >
      <Icon />
    </span>
  )
}
