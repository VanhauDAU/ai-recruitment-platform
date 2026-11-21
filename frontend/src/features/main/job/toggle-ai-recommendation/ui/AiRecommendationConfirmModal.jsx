import { Button, Modal } from 'antd'
import { useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'
import AiPolicyLink from './AiPolicyLink'

const BUTTON = '!h-11 !rounded-full !font-bold sm:!h-12'

/**
 * Xác nhận trước khi bật hoặc tắt gợi ý việc làm bằng AI.
 * `mode` là trạng thái muốn chuyển tới: 'enable' hoặc 'disable'.
 */
export default function AiRecommendationConfirmModal({ mode, saving = false, onCancel, onConfirm }) {
  const { siteName } = useSiteSettings()
  const enabling = mode === 'enable'

  return (
    <Modal
      open={Boolean(mode)}
      centered
      width={560}
      closable={enabling}
      maskClosable={!saving}
      onCancel={onCancel}
      title={<span className="text-lg font-bold text-slate-900 sm:text-xl">
        {enabling ? m.candidate_reco_enable_title() : m.candidate_reco_disable_title()}
      </span>}
      footer={(
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {enabling ? (
            <>
              <Button className={BUTTON} onClick={onCancel} disabled={saving}>{m.candidate_reco_enable_cancel()}</Button>
              <Button className={BUTTON} type="primary" loading={saving} onClick={onConfirm}>{m.candidate_reco_enable_confirm()}</Button>
            </>
          ) : (
            <>
              <Button className={BUTTON} loading={saving} onClick={onConfirm}>{m.candidate_reco_disable_confirm()}</Button>
              <Button className={BUTTON} type="primary" onClick={onCancel} disabled={saving}>{m.candidate_reco_disable_keep()}</Button>
            </>
          )}
        </div>
      )}
    >
      <p className="text-sm leading-6 text-slate-600 sm:text-[15px]">
        {enabling ? (
          <>{m.candidate_reco_enable_text({ site: siteName })} <AiPolicyLink />.</>
        ) : (
          <>
            {m.candidate_reco_disable_text_start()}{' '}
            <b className="text-slate-800">{m.candidate_reco_disable_text_stop()}</b>{' '}
            {m.candidate_reco_disable_text_middle()}{' '}
            <b className="text-slate-800">{m.candidate_reco_disable_text_miss()}</b>
          </>
        )}
      </p>
    </Modal>
  )
}
