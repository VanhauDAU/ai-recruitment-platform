import { CopyOutlined, DownloadOutlined } from '@ant-design/icons'
import { Button, QRCode, Select } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { copyText } from '../lib/channel-kinds'

const PAGE_LABELS = {
  landing: () => m.employer_campaign_post_target_landing(),
  company: () => m.employer_campaign_post_target_company(),
}
const linkLabel = (link) => PAGE_LABELS[link.key]?.() || m.employer_campaign_link_job({ title: link.label })

// Mọi link theo dõi của kênh: trang chiến dịch, trang công ty và từng tin. Bấm hay
// quét link nào cũng được tính cho kênh này.
export default function ChannelLinkSection({ channel }) {
  const [qrKey, setQrKey] = useState(channel.links[0]?.key)
  const qrLink = channel.links.find((link) => link.key === qrKey) || channel.links[0]
  const qrId = `qr-${channel.public_id}`

  function downloadQr() {
    const canvas = document.getElementById(qrId)?.querySelector('canvas')
    if (!canvas) return
    const anchor = document.createElement('a')
    anchor.href = canvas.toDataURL('image/png')
    anchor.download = `qr-${channel.label}-${qrLink.key}.png`
    anchor.click()
  }

  return (
    <div className="ch-linkpane">
      <div className="ch-linkpane__main">
        <p className="ch-section-note">{m.employer_campaign_link_note({ label: channel.label })}</p>
        <ul className="ch-links">
          {channel.links.map((link) => (
            <li key={link.key}>
              <span className="ch-links__label">{linkLabel(link)}</span>
              <div className="ch-linkbox">
                <code>{link.url}</code>
                <Button
                  icon={<CopyOutlined aria-hidden />}
                  aria-label={m.employer_campaign_link_copy_aria({ label: linkLabel(link) })}
                  onClick={() => copyText(link.url, 'link', message)}
                >
                  {m.employer_campaign_link_copy()}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {qrLink && (
        <div className="ch-linkpane__qr" id={qrId}>
          <Select
            size="small"
            value={qrLink.key}
            onChange={setQrKey}
            aria-label={m.employer_campaign_link_qr_for()}
            options={channel.links.map((link) => ({ value: link.key, label: linkLabel(link) }))}
            popupMatchSelectWidth={false}
            className="ch-linkpane__qr-select"
          />
          <QRCode value={qrLink.url} size={148} bordered={false} />
          <Button size="small" icon={<DownloadOutlined aria-hidden />} onClick={downloadQr}>{m.employer_campaign_link_download_qr()}</Button>
        </div>
      )}
    </div>
  )
}
