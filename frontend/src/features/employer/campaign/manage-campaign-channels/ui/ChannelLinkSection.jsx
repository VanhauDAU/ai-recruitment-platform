import { CopyOutlined, DownloadOutlined } from '@ant-design/icons'
import { Button, QRCode } from 'antd'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { copyText } from '../lib/channel-kinds'

// Link theo dõi và mã QR của kênh: mỗi lượt bấm hoặc quét được tính cho kênh này.
export default function ChannelLinkSection({ channel }) {
  const qrId = `qr-${channel.public_id}`

  function downloadQr() {
    const canvas = document.getElementById(qrId)?.querySelector('canvas')
    if (!canvas) return
    const anchor = document.createElement('a')
    anchor.href = canvas.toDataURL('image/png')
    anchor.download = `qr-${channel.label}.png`
    anchor.click()
  }

  return (
    <div className="ch-linkpane">
      <div className="ch-linkpane__main">
        <p className="ch-section-note">
          {m.employer_campaign_link_note({ label: channel.label })}
        </p>
        <div className="ch-linkbox">
          <code>{channel.link}</code>
          <Button type="primary" icon={<CopyOutlined aria-hidden />} onClick={() => copyText(channel.link, 'link', message)}>
            {m.employer_campaign_link_copy()}
          </Button>
        </div>
        <p className="ch-section-note">
          {channel.target === 'job'
            ? m.employer_campaign_link_target_job({ title: channel.job_title })
            : m.employer_campaign_link_target_landing()}
        </p>
      </div>
      <div className="ch-linkpane__qr" id={qrId}>
        <QRCode value={channel.link} size={148} bordered={false} />
        <Button size="small" icon={<DownloadOutlined aria-hidden />} onClick={downloadQr}>{m.employer_campaign_link_download_qr()}</Button>
      </div>
    </div>
  )
}
