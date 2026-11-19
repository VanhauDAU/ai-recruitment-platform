import { Button } from 'antd'
import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'

export default function CookieConsentBanner({ onAcceptAll, onCustomize, onRejectOptional, saving }) {
  return (
    <section className="cookie-consent-banner" aria-label={m.account_cookie_banner_aria()}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <p className="text-base font-bold text-white">{m.account_cookie_banner_title()}</p>
          <p className="mt-1 text-sm leading-5 text-slate-200">
            {m.account_cookie_banner_desc()}{' '}
            <Link to="/chinh-sach-cookie" className="font-semibold text-white underline underline-offset-2">{m.account_cookie_learn_more()}</Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button onClick={onRejectOptional} loading={saving} className="!border-slate-400 !bg-transparent !text-white hover:!border-white hover:!text-white">
            {m.account_cookie_reject_optional()}
          </Button>
          <Button onClick={onCustomize} disabled={saving} className="!border-slate-400 !bg-transparent !text-white hover:!border-white hover:!text-white">
            {m.account_cookie_customize()}
          </Button>
          <Button type="primary" onClick={onAcceptAll} loading={saving} className="!border-white !bg-white !font-semibold !text-slate-800 hover:!border-slate-100 hover:!bg-slate-100">
            {m.account_cookie_accept_all()}
          </Button>
        </div>
      </div>
    </section>
  )
}
