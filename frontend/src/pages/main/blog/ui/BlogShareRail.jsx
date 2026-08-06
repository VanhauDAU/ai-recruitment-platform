import {
  FacebookFilled,
  LinkOutlined,
  PrinterOutlined,
  ShareAltOutlined,
  TwitterOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { message } from '@/shared/lib/toast'
import {
  absoluteBlogShareUrl,
  buildBlogShareTargets,
  canUseWebShare,
  openShareWindow,
  shareViaWebApi,
} from './blog-share'
import './blog-share-rail.css'

/**
 * Cột công cụ bài viết: robot TTS + chia sẻ + mục lục.
 * Desktop: sticky dưới header+category (z thấp hơn category nav).
 * Mobile: không sticky — cuộn theo nội dung, không che thanh danh mục.
 */
export default function BlogShareRail({
  onToggleToc,
  hasToc,
  speechControl,
  sharePath,
  title = '',
  description = '',
}) {
  const shareUrl = useMemo(
    () => absoluteBlogShareUrl(sharePath || (typeof window !== 'undefined' ? window.location.pathname : '')),
    [sharePath],
  )
  const targets = useMemo(
    () => buildBlogShareTargets({ url: shareUrl, title }),
    [shareUrl, title],
  )
  const webShare = canUseWebShare()

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      message.success('Đã sao chép đường dẫn bài viết.')
    } catch {
      message.info('Bạn có thể sao chép đường dẫn trên thanh địa chỉ.')
    }
  }

  function shareFacebook() {
    openShareWindow(targets.facebook)
  }

  function shareTwitter() {
    openShareWindow(targets.twitter)
  }

  async function shareNative() {
    const shared = await shareViaWebApi({
      url: shareUrl,
      title,
      text: description || title,
    })
    if (!shared) {
      // Fallback khi Web Share không dùng được: copy link.
      await copyLink()
    }
  }

  return (
    <div className="blog-share-rail" aria-label="Công cụ bài viết">
      {speechControl}
      <div className="blog-share-rail__group" aria-label="Chia sẻ">
        <RailButton label="Sao chép liên kết" onClick={copyLink}>
          <LinkOutlined aria-hidden />
        </RailButton>
        {webShare && (
          <RailButton label="Chia sẻ thiết bị" onClick={shareNative}>
            <ShareAltOutlined aria-hidden />
          </RailButton>
        )}
        <RailButton label="Chia sẻ qua Facebook" onClick={shareFacebook}>
          <FacebookFilled aria-hidden />
        </RailButton>
        <RailButton label="Chia sẻ qua X (Twitter)" onClick={shareTwitter}>
          <TwitterOutlined aria-hidden />
        </RailButton>
        <RailButton label="In bài viết" onClick={() => window.print()}>
          <PrinterOutlined aria-hidden />
        </RailButton>
      </div>
      {hasToc && (
        <div className="blog-share-rail__group" aria-label="Mục lục">
          <RailButton label="Mở mục lục" onClick={onToggleToc}>
            <UnorderedListOutlined aria-hidden />
          </RailButton>
        </div>
      )}
    </div>
  )
}

function RailButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      className="blog-share-rail__button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
