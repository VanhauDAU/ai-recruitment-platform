import { FacebookFilled, LinkedinFilled, LinkOutlined, TwitterOutlined } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'
import { buildShareLinks, openShareWindow } from '@/shared/lib/share-links'
import { message } from '@/shared/lib/toast'

/** Nút chia sẻ trang hiện tại; container của nơi dùng quyết định bố cục dọc hay ngang. */
export default function ShareButtons({ copiedMessage = m.ui_share_link_copied() }) {
  function share(network) {
    openShareWindow(buildShareLinks({ url: window.location.href, title: document.title })[network])
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success(copiedMessage)
    } catch {
      message.info(m.ui_share_copy_manually())
    }
  }

  return (
    <>
      <ShareButton label={m.ui_share_facebook()} onClick={() => share('facebook')}><FacebookFilled /></ShareButton>
      <ShareButton label={m.ui_share_twitter()} onClick={() => share('twitter')}><TwitterOutlined /></ShareButton>
      <ShareButton label={m.ui_share_linkedin()} onClick={() => share('linkedin')}><LinkedinFilled /></ShareButton>
      <ShareButton label={m.ui_share_copy_link()} onClick={copyLink}><LinkOutlined /></ShareButton>
    </>
  )
}

function ShareButton({ label, onClick, children }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/40 hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)]">{children}</button>
}
