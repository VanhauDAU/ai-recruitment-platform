import { ShoppingOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useCvRecruiterSearch } from '../model/use-cv-recruiter-search'
import RecruiterConsentModal from './RecruiterConsentModal'

/** Mời bật tìm việc cho CV mới nhất chưa mở với NTD. */
export default function EnableCvSearchBanner({ cv }) {
  const { busy, setSearchable, consentModalProps } = useCvRecruiterSearch(cv, { source: 'cv_library_banner' })

  return (
    <section className="flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--brand-primary-soft)] via-[var(--brand-primary-soft)] to-white p-5 shadow-sm sm:p-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-[#00a848] sm:text-xl">Bật tìm việc cho CV</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-700">
          <strong className="break-all">{cv.title}</strong> của bạn vừa mới được tạo.
          {' '}Bật tìm việc để <strong>NTD tìm thấy CV này</strong> khi tính năng tìm ứng viên ra mắt.
        </p>
        <Button
          type="primary"
          shape="round"
          loading={busy}
          onClick={() => setSearchable(true)}
          className="mt-3 !bg-[var(--brand-primary)] !font-semibold hover:!bg-[#009643]"
        >
          Bật tìm việc ngay
        </Button>
      </div>
      {/* Minh họa công tắc đang bật, dựng bằng CSS để không phải tải ảnh. */}
      <div aria-hidden="true" className="hidden h-16 w-32 shrink-0 items-center justify-between rounded-full bg-gradient-to-r from-[#2fbf71] to-[#00a848] px-3 shadow-[0_8px_20px_rgba(0,168,72,0.3)] sm:flex">
        <ShoppingOutlined className="text-2xl text-white/90" />
        <span className="h-11 w-11 rounded-full border-4 border-[var(--brand-primary)]/20 bg-white shadow-inner" />
      </div>
      <RecruiterConsentModal {...consentModalProps} />
    </section>
  )
}
