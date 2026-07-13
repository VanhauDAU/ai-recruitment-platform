import { Button } from 'antd'
import { Link } from 'react-router-dom'

export default function CookieConsentBanner({ onAcceptAll, onCustomize, onRejectOptional, saving }) {
  return (
    <section className="cookie-consent-banner" aria-label="Lựa chọn cookie">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <p className="text-base font-bold text-white">Trải nghiệm của bạn là ưu tiên của chúng tôi</p>
          <p className="mt-1 text-sm leading-5 text-slate-200">
            ProCV sử dụng cookie cần thiết để vận hành website và các cookie tùy chọn để cải thiện trải nghiệm của bạn.{' '}
            <Link to="/chinh-sach-cookie" className="font-semibold text-white underline underline-offset-2">Tìm hiểu thêm</Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button onClick={onRejectOptional} loading={saving} className="!border-slate-400 !bg-transparent !text-white hover:!border-white hover:!text-white">
            Chỉ cookie thiết yếu
          </Button>
          <Button onClick={onCustomize} disabled={saving} className="!border-slate-400 !bg-transparent !text-white hover:!border-white hover:!text-white">
            Tùy chỉnh cookie
          </Button>
          <Button type="primary" onClick={onAcceptAll} loading={saving} className="!border-white !bg-white !font-semibold !text-slate-800 hover:!border-slate-100 hover:!bg-slate-100">
            Chấp nhận tất cả
          </Button>
        </div>
      </div>
    </section>
  )
}
