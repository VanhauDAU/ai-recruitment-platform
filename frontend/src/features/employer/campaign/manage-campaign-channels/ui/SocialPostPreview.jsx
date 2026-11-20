import { GlobalOutlined, LikeOutlined, MessageOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import { isPublicLink } from '../lib/channel-kinds'

const CLAMP = 320

// Bản xem trước theo khung một bài mạng xã hội: tên trang, giờ, nội dung, thẻ link.
// Instagram (``variant``) đặt ảnh lên đầu và không có thẻ link vì link trong chú thích
// không bấm được. ``imageRatio`` [hẹp nhất, rộng nhất] là khoảng tỷ lệ mạng nhận: ảnh
// ngoài khoảng hiện kèm viền trắng như bản được thêm viền khi đăng.
export default function SocialPostPreview({ name, avatarUrl, meta, text, link, linkTitle, images = [], variant, imageRatio }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > CLAMP
  const shown = long && !expanded ? `${text.slice(0, CLAMP).trimEnd()}…` : text
  const host = (() => {
    try { return new URL(link).host } catch { return '' }
  })()
  const mediaFirst = variant === 'instagram'
  const imageAlt = (index) => m.employer_campaign_posts_image_alt({ index: index + 1 })
  const media = images.length > 0 && (mediaFirst ? (
    <div className="ch-post__media is-fit" style={imageRatio && { '--fit-narrow': imageRatio[0], '--fit-wide': imageRatio[1] }}>
      <img src={images[0]} alt={imageAlt(0)} />
      {images.length > 1 && <span className="ch-post__count">1/{images.length}</span>}
    </div>
  ) : (
    <div className={`ch-post__media is-${Math.min(images.length, 4)}`}>
      {images.slice(0, 4).map((url, index) => <img key={url} src={url} alt={imageAlt(index)} />)}
    </div>
  ))

  return (
    <figure className="ch-post" aria-label={m.employer_campaign_preview_aria()}>
      <header className="ch-post__head">
        {avatarUrl
          ? <img className="ch-post__avatar" src={avatarUrl} alt="" />
          : <span className="ch-post__avatar is-letter" aria-hidden>{(name || 'P').slice(0, 1)}</span>}
        <div>
          <strong>{name}</strong>
          <span className="ch-post__meta">{meta} <GlobalOutlined aria-hidden /></span>
        </div>
      </header>
      {mediaFirst && media}
      {text ? (
        <p className="ch-post__text">
          {shown}
          {long && (
            <button type="button" className="ch-post__more" onClick={() => setExpanded(!expanded)}>
              {expanded ? m.employer_campaign_preview_less() : m.employer_campaign_preview_more()}
            </button>
          )}
        </p>
      ) : <p className="ch-post__text is-empty">{m.employer_campaign_preview_empty()}</p>}
      {!mediaFirst && media}
      {link && !mediaFirst && images.length === 0 && (isPublicLink(link) ? (
        <div className="ch-post__card">
          <span>{host}</span>
          <strong>{linkTitle}</strong>
        </div>
      ) : (
        <p className="ch-post__note">{m.employer_campaign_preview_local_link()}</p>
      ))}
      <footer className="ch-post__bar" aria-hidden>
        <span><LikeOutlined /> {m.employer_campaign_preview_like()}</span>
        <span><MessageOutlined /> {m.employer_campaign_preview_comment()}</span>
        <span><ShareAltOutlined /> {m.employer_campaign_preview_share()}</span>
      </footer>
    </figure>
  )
}
