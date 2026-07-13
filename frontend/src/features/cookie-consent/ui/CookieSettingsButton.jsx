import { Button } from 'antd'
import { useConsent } from '@/entities/consent'

export default function CookieSettingsButton({ className = '' }) {
  const { isEnabled, openSettings } = useConsent()
  if (!isEnabled) return null
  return (
    <Button type="link" onClick={openSettings} className={`!h-auto !p-0 !text-xs !font-semibold !text-slate-600 hover:!text-[var(--brand-primary)] ${className}`}>
      Cài đặt cookie
    </Button>
  )
}
