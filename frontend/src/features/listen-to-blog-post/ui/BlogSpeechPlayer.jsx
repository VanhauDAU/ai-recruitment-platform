import {
  CloseOutlined,
  LoadingOutlined,
  PauseOutlined,
  PlayCircleFilled,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useEffect, useRef } from 'react'
import { useSiteSettings } from '@/entities/site-settings'
import { useBlogSpeechPlayer } from '../model/use-blog-speech-player'
import { SpeechMascot, SpeechWaveform } from './SpeechPlayerMascot'
import './blog-speech-player.css'

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5]

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function statusText(status) {
  if (status === 'creating') return 'Đang tạo phiên đọc…'
  if (status === 'queued') return 'Đang xếp hàng chờ giọng đọc…'
  if (status === 'buffering') return 'Đang nhận âm thanh…'
  if (status === 'rebuffering') return 'Đang đệm thêm âm thanh…'
  if (status === 'playing') return 'Đang đọc bài viết'
  if (status === 'paused') return 'Đã tạm dừng'
  if (status === 'ended') return 'Đã đọc xong'
  if (status === 'error') return 'Giọng đọc chưa sẵn sàng'
  return 'Sẵn sàng'
}

function railLabel(status) {
  if (['creating', 'queued', 'buffering'].includes(status)) return 'Đang chuẩn bị giọng đọc'
  if (status === 'rebuffering') return 'Đang đệm thêm. Bấm để tùy chỉnh'
  if (status === 'playing') return 'Đang đọc. Bấm để tùy chỉnh'
  if (status === 'paused') return 'Đã tạm dừng. Bấm để tùy chỉnh'
  if (status === 'ended') return 'Đã đọc xong. Bấm để tùy chỉnh'
  if (status === 'error') return 'Giọng đọc gặp lỗi. Bấm để thử lại'
  return 'Phát bài viết ngay'
}

export default function BlogSpeechPlayer({ defaultAsset, onTiming, postPublicId }) {
  const { settings } = useSiteSettings()
  const player = useBlogSpeechPlayer(postPublicId, { defaultAsset, onTiming })
  const { panelOpen, setPanelOpen } = player
  const rootRef = useRef(null)

  useEffect(() => {
    if (!panelOpen) return undefined
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setPanelOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setPanelOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [panelOpen, setPanelOpen])

  const busy = ['creating', 'queued', 'buffering', 'rebuffering'].includes(player.status)
  const active = [
    'creating', 'queued', 'buffering', 'rebuffering', 'playing', 'paused',
  ].includes(player.status)
  const duration = Math.max(0, Number(defaultAsset?.duration_ms) / 1000 || 0)
  const progress = duration > 0 ? Math.min(100, (player.elapsed / duration) * 100) : 0

  if (settings.speech_blog_enabled !== true) return null

  return (
    <div ref={rootRef} className="blog-speech" data-status={player.status}>
      <div className={`blog-speech__rail-shell${active ? ' is-active' : ''}`}>
        <button
          type="button"
          onClick={player.railClick}
          onFocus={player.preloadDefault}
          onPointerEnter={player.preloadDefault}
          aria-label={railLabel(player.status)}
          aria-controls="blog-speech-settings"
          aria-expanded={player.panelOpen}
          aria-haspopup="dialog"
          title={railLabel(player.status)}
          className={`blog-speech__rail-button${active ? ' is-active' : ''}`}
        >
          <span className="blog-speech__rail-mascot">
            <SpeechMascot size={44} status={player.status} />
            <span className="blog-speech__rail-action" aria-hidden="true">
              {busy
                ? <LoadingOutlined className="blog-speech__spin" />
                : player.status === 'paused'
                  ? <PauseOutlined />
                  : player.status === 'ended'
                    ? <ReloadOutlined />
                    : <PlayCircleFilled />}
            </span>
          </span>
        </button>
      </div>

      {player.panelOpen && (
        <aside
          id="blog-speech-settings"
          role="dialog"
          aria-label="Tùy chỉnh giọng đọc"
          className="blog-speech__panel"
        >
          <div className="blog-speech__header">
            <span className="blog-speech__header-mascot">
              <SpeechMascot size={68} status={player.status} />
            </span>
            <div className="blog-speech__header-copy">
              <span className="blog-speech__eyebrow">PROCV AUDIO</span>
              <h2>Robot đọc cùng bạn</h2>
              <p className="blog-speech__status" role="status">
                {player.status === 'playing' && <span className="blog-speech__status-dot" />}
                {statusText(player.status)}
                {player.elapsed > 0 && <span className="blog-speech__time">· {formatTime(player.elapsed)}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => player.setPanelOpen(false)}
              aria-label="Đóng tùy chỉnh giọng đọc"
              className="blog-speech__close"
            >
              <CloseOutlined aria-hidden="true" />
            </button>
          </div>

          {duration > 0 && player.elapsed > 0 && (
            <div className="blog-speech__progress-wrap">
              <div
                className="blog-speech__progress"
                role="progressbar"
                aria-label="Tiến độ đọc bài viết"
                aria-valuemin="0"
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(player.elapsed)}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="blog-speech__progress-time" aria-hidden="true">
                <span>{formatTime(player.elapsed)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {player.status === 'playing' && (
            <div className="blog-speech__now-playing" aria-hidden="true">
              <SpeechWaveform />
              <span>Robot đang đọc nội dung bài viết</span>
            </div>
          )}

          {['playing', 'rebuffering', 'paused'].includes(player.status) && (
            <div className="blog-speech__controls">
              <button
                type="button"
                onClick={player.togglePause}
                aria-label={player.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
                className="blog-speech__button blog-speech__button--primary"
              >
                {player.status === 'paused' ? <PlayCircleFilled /> : <PauseOutlined />}
                {player.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
              </button>
              <button
                type="button"
                onClick={() => player.stop()}
                aria-label="Dừng"
                className="blog-speech__button blog-speech__button--secondary"
              >
                <StopOutlined /> Dừng
              </button>
            </div>
          )}

          {['creating', 'queued', 'buffering'].includes(player.status) && (
            <button
              type="button"
              onClick={() => player.stop()}
              aria-label="Hủy chờ giọng đọc"
              className="blog-speech__button blog-speech__button--cancel"
            >
              <StopOutlined /> Hủy chờ
            </button>
          )}

          {player.error && (
            <div className="blog-speech__error">
              <p role="alert">{player.error}</p>
              {player.status === 'error' && (
                <button
                  type="button"
                  onClick={() => player.start()}
                  className="blog-speech__retry"
                >
                  Thử phát lại
                </button>
              )}
            </div>
          )}

          <div className="blog-speech__settings">
            <label className="blog-speech__field">
              Tốc độ
              <select
                aria-label="Tốc độ phát"
                value={player.rate}
                onChange={(event) => player.setRate(Number(event.target.value))}
                className="blog-speech__select"
              >
                {PLAYBACK_RATES.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={player.apply}
              aria-label="Áp dụng và phát"
              className="blog-speech__button blog-speech__button--apply"
            >
              <PlayCircleFilled /> Áp dụng và phát
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
