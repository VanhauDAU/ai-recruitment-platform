import { settingText, useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'

// "công nghệ AI" trỏ tới chính sách dữ liệu AI do quản trị cấu hình; chưa có thì chỉ là chữ.
export default function AiPolicyLink() {
  const { settings } = useSiteSettings()
  const url = settingText(settings.ai_data_policy_url)
  const label = m.candidate_reco_toggle_policy()
  if (!url) return label
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline">
      {label}
    </a>
  )
}
