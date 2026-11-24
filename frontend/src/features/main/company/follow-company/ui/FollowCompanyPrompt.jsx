import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useCandidateAudience } from '@/entities/account/session'
import { CompanyLogo } from '@/entities/company/company'
import { m } from '@/shared/config/i18n'
import { useCompanyFollow } from '../model/use-company-follow'
import '../follow-company.css'

/**
 * Lời mời theo dõi dính giữa đáy màn hình khi `visible` (nút trong hero đã cuộn khỏi
 * màn hình). Ẩn khi đã theo dõi, khi người dùng đóng, và với vai trò khác ứng viên.
 * `company`: `{ public_id, name, logo_url }`.
 */
export default function FollowCompanyPrompt({ company, visible, onRequireLogin }) {
  const audience = useCandidateAudience()
  const follow = useCompanyFollow(company.public_id)
  const [dismissed, setDismissed] = useState(false)
  if (!audience || !visible || dismissed || follow.isLoading || follow.following) return null

  function followNow() {
    if (audience === 'guest') onRequireLogin(() => follow.setFollowing(true))
    else follow.setFollowing(true)
  }

  return (
    <aside className="follow-company-prompt" aria-label={m.company_follow_prompt_label()}>
      <CompanyLogo company={{ trade_name: company.name, logo_url: company.logo_url }} width={56} height={56} className="follow-company-prompt__logo" imageClassName="p-1" />
      <p className="follow-company-prompt__text">
        {m.company_follow_prompt_lead()} <strong>{m.company_follow_prompt_highlight()}</strong>{' '}
        {m.company_follow_prompt_from()}{' '}
        <span className="follow-company-prompt__name">{company.name}</span>
      </p>
      <button type="button" className="follow-company__toggle" disabled={follow.isPending} onClick={followNow}>
        <PlusOutlined aria-hidden="true" /> {m.company_follow_prompt_cta()}
      </button>
      <button
        type="button"
        className="follow-company-prompt__close"
        aria-label={m.company_follow_prompt_close()}
        onClick={() => setDismissed(true)}
      >
        <CloseOutlined aria-hidden="true" />
      </button>
    </aside>
  )
}
