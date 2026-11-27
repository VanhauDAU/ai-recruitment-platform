import {
  CheckOutlined,
  FacebookFilled,
  LinkedinFilled,
  MailFilled,
  RightOutlined,
  SendOutlined,
  ShareAltOutlined,
  XFilled,
} from '@ant-design/icons'
import { Popover } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { buildShareLinks, canUseWebShare, openShareWindow, shareViaWebApi } from '@/shared/lib/share-links'
import BottomSheet from '@/shared/ui/BottomSheet'
import ShareButtons from '@/shared/ui/ShareButtons'

const NETWORKS = [
  { key: 'facebook', label: 'Facebook', icon: <FacebookFilled />, color: '#1877f2' },
  { key: 'linkedin', label: 'LinkedIn', icon: <LinkedinFilled />, color: '#0a66c2' },
  { key: 'twitter', label: 'X', icon: <XFilled />, color: '#0f1419' },
  { key: 'telegram', label: 'Telegram', icon: <SendOutlined />, color: '#229ed9' },
  { key: 'email', label: 'Email', icon: <MailFilled />, color: '#475569' },
]

// Link chia sẻ bỏ query/hash để khớp thẻ OG phía server.
function currentShareUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

/**
 * Nút chia sẻ ở đầu tin. Thanh chia sẻ bên trái chỉ có từ xl, nên dưới md nút mở tấm
 * trượt (bảng chia sẻ của máy cho Zalo/Messenger + các mạng + sao chép liên kết), từ md
 * mở popover với các nút mạng xã hội.
 */
export default function JobShareButton({ job }) {
  const compact = useMediaQuery('(max-width: 767px)')
  const [open, setOpen] = useState(false)
  const trigger = (
    <button
      type="button"
      onClick={compact ? () => setOpen(true) : undefined}
      className="job-hero__share"
      aria-label={m.candidate_job_share_title()}
      aria-haspopup="dialog"
    >
      <ShareAltOutlined />
    </button>
  )

  if (!compact) {
    return (
      <Popover
        trigger="click"
        placement="bottomRight"
        content={<div className="job-share-popover" role="group" aria-label={m.candidate_job_share_title()}><ShareButtons /></div>}
      >
        {trigger}
      </Popover>
    )
  }

  return (
    <>
      {trigger}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={m.candidate_job_share_title()}>
        {open && <JobShareSheetBody job={job} />}
      </BottomSheet>
    </>
  )
}

function JobShareSheetBody({ job }) {
  const url = currentShareUrl()
  const title = [job.title, job.company_name].filter(Boolean).join(' – ')
  const links = buildShareLinks({ url, title })
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function share(key) {
    if (key === 'email') window.location.href = links.email
    else openShareWindow(links[key])
  }

  return (
    <div className="job-share">
      <div className="job-share__job">
        <p className="job-share__job-title">{job.title}</p>
        {job.company_name && <p className="job-share__job-company">{job.company_name}</p>}
      </div>

      {canUseWebShare() && (
        <button type="button" className="job-share__native" onClick={() => shareViaWebApi({ url, title })}>
          <span className="job-share__native-icon" aria-hidden="true"><ShareAltOutlined /></span>
          <span className="job-share__native-text">
            <strong>{m.candidate_job_share_native()}</strong>
            <small>{m.candidate_job_share_native_hint()}</small>
          </span>
          <RightOutlined aria-hidden="true" />
        </button>
      )}

      <div className="job-share__grid">
        {NETWORKS.map((network) => (
          <button key={network.key} type="button" className="job-share__target" onClick={() => share(network.key)}>
            <span className="job-share__target-icon" style={{ '--share-color': network.color }} aria-hidden="true">
              {network.icon}
            </span>
            {network.label}
          </button>
        ))}
      </div>

      <div className="job-share__link">
        <span className="job-share__url">{url.replace(/^https?:\/\//, '')}</span>
        <button type="button" className={`job-share__copy${copied ? ' is-copied' : ''}`} onClick={copyLink} aria-live="polite">
          {copied ? <><CheckOutlined aria-hidden="true" /> {m.candidate_job_share_copied()}</> : m.candidate_job_share_copy()}
        </button>
      </div>
    </div>
  )
}
