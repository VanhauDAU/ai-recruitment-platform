import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import useApplicationCvDownload from '../model/use-application-cv-download'

function safeFilename(name) {
  return `CV - ${(name || 'ung-vien').replace(/[\\/:*?"<>|]+/g, ' ').trim()}.pdf`
}

export default function DownloadApplicationCvButton({ publicId, candidateName }) {
  const { download, working, failed } = useApplicationCvDownload(publicId, safeFilename(candidateName))
  return (
    <Tooltip title="Ứng viên sẽ được thông báo khi bạn tải CV lần đầu.">
      <Button
        size="small"
        icon={failed ? <ReloadOutlined /> : <DownloadOutlined />}
        loading={working}
        disabled={!publicId}
        onClick={download}
      >
        {working ? 'Đang tạo PDF…' : failed ? 'Thử lại' : 'Tải PDF'}
      </Button>
    </Tooltip>
  )
}
