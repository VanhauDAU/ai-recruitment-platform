import { PlayCircleFilled } from '@ant-design/icons'
import { useState } from 'react'

const PROVIDER_LABELS = { youtube: 'YouTube', vimeo: 'Vimeo' }

/**
 * Mặt tiền nhấp-để-tải: trang không tải iframe (và cookie, script của nhà cung
 * cấp) cho tới khi người xem bấm phát. `video` đã được `companyVideoEmbed` kiểm.
 */
export default function CompanyVideo({ video, title }) {
  const [playing, setPlaying] = useState(false)
  const provider = PROVIDER_LABELS[video.provider]

  if (playing) {
    return (
      <div className="company-profile-video">
        <iframe
          src={`${video.embed_url}?autoplay=1`}
          title={title}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className="company-profile-video company-profile-video__facade"
      onClick={() => setPlaying(true)}
      aria-label={`Phát ${title} trên ${provider}`}
    >
      {video.provider === 'youtube' && (
        <img src={`https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />
      )}
      <PlayCircleFilled className="company-profile-video__play" aria-hidden="true" />
      <span className="company-profile-video__provider">{provider}</span>
    </button>
  )
}
