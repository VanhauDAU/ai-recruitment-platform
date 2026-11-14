import { CheckCircleFilled, CloseCircleFilled, FilePdfOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal, Skeleton } from 'antd'
import { useState } from 'react'
import { downloadAdminTemplateTestPdf, getAdminTemplateTestPdf, requestAdminTemplateTestPdf } from '@/entities/cv-template'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

// Mục chưa đạt → sửa ở đâu trên trang chỉnh sửa.
const FIX_HINTS = {
  names: 'Nhập đủ tên ở khối Thông tin.',
  colors: 'Chọn ít nhất một màu ở khối Màu & chữ.',
  identity: 'Giữ Danh thiếp và Liên hệ ở khối Các mục trong CV.',
  core_sections: 'Giữ Mục tiêu, Kinh nghiệm, Học vấn, Kỹ năng ở khối Các mục trong CV.',
}

const TEST_PDF_TIMEOUT_MS = 90_000

// PDF thử chạy trong worker; xong thì mục "PDF thử" của checklist tự đạt. Worker
// không trả lời quá lâu thì coi như lỗi để admin bấm thử lại.
function TestPdfButton({ template, draft, onReady }) {
  const [pdfJob, setPdfJob] = useState(null)
  const token = pdfJob?.token
  const job = useQuery({
    queryKey: ['admin-cv-test-pdf', token],
    queryFn: async () => {
      const result = await getAdminTemplateTestPdf(token)
      if (result.status === 'ready') onReady()
      if (result.status === 'pending' && Date.now() - pdfJob.startedAt > TEST_PDF_TIMEOUT_MS) return { status: 'failed' }
      return result
    },
    enabled: Boolean(token),
    refetchInterval: (query) => (query.state.data?.status === 'pending' || !query.state.data ? 1500 : false),
  })
  const request = useMutation({
    mutationFn: () => requestAdminTemplateTestPdf(template.public_id, draft.id, { locale: 'vi-VN' }),
    onSuccess: (result) => setPdfJob({ token: result.token, startedAt: Date.now() }),
    onError: (error) => message.error(getApiErrorMessage(error, 'Không xuất được PDF thử.')),
  })
  const open = async () => globalThis.open(URL.createObjectURL(await downloadAdminTemplateTestPdf(token)), '_blank', 'noopener')
  const status = job.data?.status
  if (status === 'ready') return <Button size="small" type="link" icon={<FilePdfOutlined />} onClick={open}>Mở PDF</Button>
  return <span className="inline-flex items-center gap-2">
    <Button size="small" icon={<FilePdfOutlined />} loading={request.isPending || (Boolean(token) && status !== 'failed')} onClick={() => request.mutate()}>Xuất PDF thử</Button>
    {status === 'failed' && <span className="text-xs text-rose-600">Lỗi, thử lại</span>}
  </span>
}

export default function PublishModal({ open, onClose, template, draft, checklist, canPublish, publishing, onPublish }) {
  const queryClient = useQueryClient()
  const items = checklist?.items || []
  const ready = items.length > 0 && items.every((item) => item.ok)
  const refreshChecklist = () => queryClient.invalidateQueries({ queryKey: ['admin-cv-checklist', template.public_id] })
  return <Modal open={open} onCancel={onClose} destroyOnHidden title={`Xuất bản phiên bản ${draft?.version_number ?? ''}`} width={520}
    footer={[<Button key="cancel" onClick={onClose}>Để sau</Button>, canPublish && <Button key="publish" type="primary" disabled={!ready} loading={publishing} onClick={onPublish}>Xuất bản</Button>]}>
    {!checklist ? <Skeleton active paragraph={{ rows: 4 }} /> : <div className="space-y-3">
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">{items.map((item) => <li key={item.key} className="flex items-start gap-2.5 px-3 py-2.5 text-sm">
        {item.ok ? <CheckCircleFilled className="mt-0.5 !text-emerald-500" /> : <CloseCircleFilled className="mt-0.5 !text-rose-400" />}
        <span className="min-w-0 flex-1"><span className={item.ok ? 'text-slate-700' : 'font-medium text-slate-900'}>{item.label}</span>
          {!item.ok && FIX_HINTS[item.key] && <span className="block text-xs text-slate-500">{FIX_HINTS[item.key]}</span>}
        </span>
        {item.key === 'test_pdf' && draft && <TestPdfButton template={template} draft={draft} onReady={refreshChecklist} />}
      </li>)}</ul>
      {!canPublish && <Alert type="info" showIcon message="Bạn cần quyền phát hành mẫu CV để xuất bản." />}
      {template.current_published_version_id && <p className="text-xs text-slate-500">CV mới dùng phiên bản này; CV ứng viên đã tạo vẫn giữ phiên bản cũ.</p>}
    </div>}
  </Modal>
}
