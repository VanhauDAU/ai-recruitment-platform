import { FacebookFilled, LinkOutlined, PrinterOutlined, TwitterOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { message } from '@/shared/lib/toast'

function shareUrl(network) {
  const url = encodeURIComponent(window.location.href)
  const title = encodeURIComponent(document.title)
  if (network === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${url}`
  return `https://twitter.com/intent/tweet?url=${url}&text=${title}`
}

// Cột thao tác dính bên trái bài viết, gom 2 nhóm khung bo tròn riêng:
// (1) chia sẻ: copy link, FB, in, Twitter — (2) mục lục.
export default function BlogShareRail({ onToggleToc, hasToc }) {
  function share(network) {
    window.open(shareUrl(network), '_blank', 'noopener,noreferrer,width=640,height=520')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('Đã sao chép đường dẫn bài viết.')
    } catch {
      message.info('Bạn có thể sao chép đường dẫn trên thanh địa chỉ.')
    }
  }

  return (
    <div className="flex flex-row gap-3 lg:sticky lg:top-32 lg:flex-col" aria-label="Chia sẻ bài viết">
      <RailGroup label="Chia sẻ">
        <RailButton label="Sao chép liên kết" onClick={copyLink}><LinkOutlined /></RailButton>
        <RailButton label="Chia sẻ qua Facebook" onClick={() => share('facebook')}><FacebookFilled /></RailButton>
        <RailButton label="In bài viết" onClick={() => window.print()}><PrinterOutlined /></RailButton>
        <RailButton label="Chia sẻ qua Twitter" onClick={() => share('twitter')}><TwitterOutlined /></RailButton>
      </RailGroup>
      {hasToc && (
        <RailGroup label="Mục lục">
          <RailButton label="Mở mục lục" onClick={onToggleToc}><UnorderedListOutlined /></RailButton>
        </RailGroup>
      )}
    </div>
  )
}

function RailGroup({ label, children }) {
  return (
    <div
      aria-label={label}
      className="flex flex-row gap-1.5 rounded-full border border-slate-200 bg-white p-1.5 shadow-sm lg:flex-col"
    >
      {children}
    </div>
  )
}

function RailButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-all duration-200 hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)]"
    >
      {children}
    </button>
  )
}
