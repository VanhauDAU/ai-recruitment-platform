import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { m } from '@/shared/config/i18n'
import useApplicationCvDownload from '../model/use-application-cv-download'

function safeFilename(name) {
  return `CV - ${(name || 'ung-vien').replace(/[\\/:*?"<>|]+/g, ' ').trim()}.pdf`
}

export default function DownloadApplicationCvButton({ publicId, candidateName, sourceFile = false }) {
  const { download, working, failed } = useApplicationCvDownload(publicId, safeFilename(candidateName), { sourceFile })
  return (
    <Tooltip title={m.employer_workspace_download_tooltip()}>
      <Button
        size="small"
        icon={failed ? <ReloadOutlined /> : <DownloadOutlined />}
        loading={working}
        disabled={!publicId}
        onClick={download}
      >
        {working
          ? (sourceFile ? m.employer_workspace_download_downloading() : m.employer_workspace_download_generating())
          : failed ? m.employer_workspace_retry() : m.employer_workspace_download_pdf()}
      </Button>
    </Tooltip>
  )
}
