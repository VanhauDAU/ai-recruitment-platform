import { Button } from 'antd'
import { useConsent } from '@/entities/system/consent'
import { m } from '@/shared/config/i18n'

export default function CookieSettingsButton({ className = '' }) {
  const { isEnabled, openSettings } = useConsent()
  if (!isEnabled) return null
  return (
    <Button type="link" onClick={openSettings} className={`!h-auto !p-0 !text-xs !font-semibold !text-slate-600 hover:!text-[var(--brand-primary)] ${className}`}>
      {m.account_cookie_settings()}
    </Button>
  )
}
