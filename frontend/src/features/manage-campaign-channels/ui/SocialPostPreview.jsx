import { GlobalOutlined, LikeOutlined, MessageOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { isPublicLink } from '../lib/channel-kinds'

const CLAMP = 320

// Bản xem trước theo khung một bài mạng xã hội: tên trang, giờ, nội dung, thẻ link.
export default function SocialPostPreview({ name, avatarUrl, meta, text, link, linkTitle }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > CLAMP
  const shown = long && !expanded ? `${text.slice(0, CLAMP).trimEnd()}…` : text
  const host = (() => {
    try { return new URL(link).host } catch { return '' }
  })()

  return (
    <figure className="ch-post" aria-label="Xem trước bài đăng">
      <header className="ch-post__head">
        {avatarUrl
          ? <img className="ch-post__avatar" src={avatarUrl} alt="" />
          : <span className="ch-post__avatar is-letter" aria-hidden>{(name || 'P').slice(0, 1)}</span>}
        <div>
          <strong>{name}</strong>
          <span className="ch-post__meta">{meta} <GlobalOutlined aria-hidden /></span>
        </div>
      </header>
      {text ? (
        <p className="ch-post__text">
          {shown}
          {long && (
            <button type="button" className="ch-post__more" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Thu gọn' : 'Xem thêm'}
            </button>
          )}
        </p>
      ) : <p className="ch-post__text is-empty">Nội dung bài sẽ hiện ở đây.</p>}
      {link && (isPublicLink(link) ? (
        <div className="ch-post__card">
          <span>{host}</span>
          <strong>{linkTitle}</strong>
        </div>
      ) : (
        <p className="ch-post__note">Link đang là địa chỉ máy cục bộ nên Facebook sẽ hiện dạng chữ, không có thẻ xem trước.</p>
      ))}
      <footer className="ch-post__bar" aria-hidden>
        <span><LikeOutlined /> Thích</span>
        <span><MessageOutlined /> Bình luận</span>
        <span><ShareAltOutlined /> Chia sẻ</span>
      </footer>
    </figure>
  )
}
