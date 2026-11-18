import { CopyOutlined, DownloadOutlined } from '@ant-design/icons'
import { Button, QRCode } from 'antd'
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
          Dùng đúng link này khi đăng lên {channel.label}. Ứng viên vào qua link sẽ được tính cho kênh, kể cả khi
          nộp hồ sơ vài ngày sau.
        </p>
        <div className="ch-linkbox">
          <code>{channel.link}</code>
          <Button type="primary" icon={<CopyOutlined aria-hidden />} onClick={() => copyText(channel.link, 'link', message)}>
            Sao chép
          </Button>
        </div>
        <p className="ch-section-note">
          Dẫn tới {channel.target === 'job' ? `tin "${channel.job_title}"` : 'trang tuyển dụng của chiến dịch'}.
        </p>
      </div>
      <div className="ch-linkpane__qr" id={qrId}>
        <QRCode value={channel.link} size={148} bordered={false} />
        <Button size="small" icon={<DownloadOutlined aria-hidden />} onClick={downloadQr}>Tải mã QR</Button>
      </div>
    </div>
  )
}
