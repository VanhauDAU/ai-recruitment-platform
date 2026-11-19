import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button } from 'antd'
import { downloadCampaignReport } from '@/entities/campaign/campaign'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

const FORMATS = [
  { type: 'xlsx', label: 'Excel', icon: FileExcelOutlined },
  { type: 'pdf', label: 'PDF', icon: FilePdfOutlined },
]

// Báo cáo chỉ gồm số liệu tổng hợp; tải qua API có xác thực rồi lưu bằng blob.
export default function CampaignReportExport({ campaign }) {
  const mutation = useMutation({
    mutationFn: (type) => downloadCampaignReport(campaign.public_id, type),
    onSuccess: (blob, type) => triggerBlobDownload(blob, `bao-cao-${campaign.public_id}.${type}`),
    onError: (_, type) => message.error(type === 'pdf'
      ? m.employer_campaign_export_pdf_error()
      : m.employer_campaign_export_error()),
  })

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={m.employer_campaign_export_aria()}>
      {FORMATS.map(({ type, label, icon: Icon }) => (
        <Button
          key={type}
          icon={<Icon aria-hidden />}
          loading={mutation.isPending && mutation.variables === type}
          disabled={mutation.isPending && mutation.variables !== type}
          onClick={() => mutation.mutate(type)}
        >
          {m.employer_campaign_export_download({ format: label })}
        </Button>
      ))}
    </div>
  )
}
