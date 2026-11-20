import { ThunderboltOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import { useAiRecommendation } from '../model/use-ai-recommendation'
import AiRecommendationConfirmModal from './AiRecommendationConfirmModal'

// Nút "Bật gợi ý việc làm" trên trang việc làm phù hợp khi ứng viên đang tắt.
export default function EnableAiRecommendationButton({ source = 'account_settings' }) {
  const { saving, setEnabled } = useAiRecommendation({ source })
  const [open, setOpen] = useState(false)

  async function confirm() {
    try {
      await setEnabled(true)
      setOpen(false)
    } catch {
      // Lỗi đã báo bằng toast.
    }
  }

  return (
    <>
      <Button type="primary" shape="round" icon={<ThunderboltOutlined />} onClick={() => setOpen(true)} className="!font-bold">
        {m.candidate_reco_enable_action()}
      </Button>
      <AiRecommendationConfirmModal mode={open ? 'enable' : null} saving={saving} onCancel={() => setOpen(false)} onConfirm={confirm} />
    </>
  )
}
