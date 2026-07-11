import { FacebookFilled, LinkedinFilled, LinkOutlined, TwitterOutlined } from '@ant-design/icons'
import { message } from 'antd'

function shareUrl(network) {
  const url = encodeURIComponent(window.location.href)
  const title = encodeURIComponent(document.title)
  if (network === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${url}`
  if (network === 'twitter') return `https://twitter.com/intent/tweet?url=${url}&text=${title}`
  return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
}

export default function JobShareRail() {
  function share(network) {
    window.open(shareUrl(network), '_blank', 'noopener,noreferrer,width=640,height=520')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('Đã sao chép đường dẫn việc làm.')
    } catch {
      message.info('Bạn có thể sao chép đường dẫn trên thanh địa chỉ.')
    }
  }

  return (
    <div
      className="fixed top-56 z-20 hidden flex-col gap-2 xl:flex"
      style={{ left: 'max(1rem, calc(50% - 40rem))' }}
      aria-label="Chia sẻ việc làm"
    >
      <ShareButton label="Chia sẻ qua Facebook" onClick={() => share('facebook')}><FacebookFilled /></ShareButton>
      <ShareButton label="Chia sẻ qua Twitter" onClick={() => share('twitter')}><TwitterOutlined /></ShareButton>
      <ShareButton label="Chia sẻ qua LinkedIn" onClick={() => share('linkedin')}><LinkedinFilled /></ShareButton>
      <ShareButton label="Sao chép đường dẫn" onClick={copyLink}><LinkOutlined /></ShareButton>
    </div>
  )
}

function ShareButton({ label, onClick, children }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-[var(--brand-primary)]">{children}</button>
}
