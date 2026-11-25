import { Button } from 'antd'
import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'

const OUTLINE_CLASS = '!border-slate-400 !bg-transparent !text-white hover:!border-white hover:!text-white'

export default function CookieConsentBanner({ onAcceptAll, onCustomize, onRejectOptional, saving }) {
  return (
    <section className="cookie-consent-banner" aria-label={m.account_cookie_banner_aria()}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
        <p className="text-xs leading-5 text-slate-200 sm:text-sm">
          {m.account_cookie_banner_desc()}{' '}
          <Link to="/chinh-sach-cookie" className="font-semibold !text-white underline underline-offset-2">{m.account_cookie_learn_more()}</Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="small" onClick={onRejectOptional} loading={saving} className={OUTLINE_CLASS}>
            {m.account_cookie_reject_optional()}
          </Button>
          <Button size="small" onClick={onCustomize} disabled={saving} className={OUTLINE_CLASS}>
            {m.account_cookie_customize()}
          </Button>
          <Button size="small" type="primary" onClick={onAcceptAll} loading={saving} className="!border-white !bg-white !font-semibold !text-slate-800 hover:!border-slate-100 hover:!bg-slate-100">
            {m.account_cookie_accept_all()}
          </Button>
        </div>
      </div>
    </section>
  )
}
