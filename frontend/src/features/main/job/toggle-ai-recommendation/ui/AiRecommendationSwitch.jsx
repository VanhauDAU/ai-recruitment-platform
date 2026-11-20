import { Switch } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import { useAiRecommendation } from '../model/use-ai-recommendation'
import AiRecommendationConfirmModal from './AiRecommendationConfirmModal'

// Công tắc "Gợi ý việc làm": bật hay tắt đều hỏi lại bằng popup trước khi lưu.
export default function AiRecommendationSwitch() {
  const { enabled, loading, saving, setEnabled } = useAiRecommendation()
  const [pending, setPending] = useState(null)

  async function confirm() {
    try {
      await setEnabled(pending === 'enable')
      setPending(null)
    } catch {
      // Lỗi đã báo bằng toast; giữ popup để người dùng thử lại hoặc hủy.
    }
  }

  return (
    <>
      <Switch
        aria-label={m.candidate_reco_toggle_label()}
        checked={enabled}
        disabled={loading}
        loading={saving}
        onChange={(next) => setPending(next ? 'enable' : 'disable')}
      />
      <AiRecommendationConfirmModal mode={pending} saving={saving} onCancel={() => setPending(null)} onConfirm={confirm} />
    </>
  )
}
