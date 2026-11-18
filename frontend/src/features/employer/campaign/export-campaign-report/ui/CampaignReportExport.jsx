import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button } from 'antd'
import { downloadCampaignReport } from '@/entities/campaign/campaign'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
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
      ? 'Chưa tạo được PDF, hãy thử lại sau ít phút.'
      : 'Chưa tải được báo cáo, hãy thử lại.'),
  })

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Tải báo cáo chiến dịch">
      {FORMATS.map(({ type, label, icon: Icon }) => (
        <Button
          key={type}
          icon={<Icon aria-hidden />}
          loading={mutation.isPending && mutation.variables === type}
          disabled={mutation.isPending && mutation.variables !== type}
          onClick={() => mutation.mutate(type)}
        >
          Tải {label}
        </Button>
      ))}
    </div>
  )
}
